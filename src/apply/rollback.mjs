// src/apply/rollback.mjs — the undo button: put every file back where it was.
// [NOT-TESTED]
//
// GOAL.md §г) — «пост-сортировочный отчёт с возможностью откатки к комит-бекапу». This module is
// that possibility. It replays the RunJournal BACKWARDS, which is deliberately different from
// "re-run the plan in reverse": the journal records what actually happened, so a run that failed
// halfway, or crashed, rolls back exactly as far as it got (internal map, invariants 7 and 8).
//
// Crash tolerance is the reason the journal writes intent before the act. Three states can be found
// for one operation, and each has an unambiguous answer:
//   · 'moved' recorded          → the move happened; rename it back.
//   · 'planned-move' only       → the process died around the rename. Do NOT guess: look at the
//                                 filesystem. If the target exists and the source does not, the
//                                 rename did happen (the crash was before journalling) — restore it.
//                                 Otherwise there is nothing to undo.
//   · 'error' recorded          → the move never happened; nothing to undo.
//
// Rollback is idempotent: running it twice is harmless, because the second pass finds every source
// already in place and every target gone.
//
// RULE 1: this module writes to user files — which is why it lives under src/apply/ with the
// executor, and nowhere else.

import { mkdir, readdir, readFile, rename, rmdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readRunJournal } from '../core/journal.mjs';
import { MANIFEST_NAME } from './backup.mjs';

/** Absolute path of a journal-relative ('/'-separated) path inside the root. */
const abs = (root, rel) => join(root, ...rel.split('/'));

/**
 * Separator for the (from, to) identity key of a move. It must be a character that cannot occur
 * inside a path, and NUL is the only one: a space would make the pair («Лето 2013/a», «b») and the
 * pair («Лето», «2013/a b») produce the same key, and the owner's archive is full of directory
 * names containing spaces. Built with `fromCharCode` rather than written literally, because a raw
 * NUL byte in the source makes git classify this text file as binary and stop diffing it.
 */
const KEY_SEP = String.fromCharCode(0);

/** Identity of one move, used to match a recorded outcome back to its recorded intent. */
const moveKey = (r) => `${r.from}${KEY_SEP}${r.to}`;

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

/**
 * Roll a run back.
 *
 * Note on verification: rollback does NOT re-hash the restored files. On the real archive that
 * would mean re-reading 551 GB — hours — to check something a rename cannot break: a rename moves a
 * directory entry, it never touches content. The backup manifest keeps the hashes, so a paranoid
 * check remains possible after the fact; making it the default would turn a 30-second undo into an
 * afternoon and, in practice, into an undo the owner avoids using.
 *
 * @param {string} runDir  the run directory (`<root>/.kpot-runs/<run-id>`)
 * @param {{dryRun?: boolean}} [opts]  dryRun: report what would be restored, touch nothing
 * @returns {Promise<{runId, root, restored, alreadyInPlace, failed, dirsRemoved, errors, truncated}>}
 * @throws {Error} if the run's journal cannot be found or read — a rollback that cannot read its
 *         journal must fail loudly, never "restore what it can".
 */
export async function rollbackRun(runDir, { dryRun = false } = {}) {
  const journalPath = await findJournal(runDir);
  const { header, records, truncated } = await readRunJournal(journalPath);
  const root = header.meta?.root;
  if (!root) throw new Error(`journal has no root recorded: ${journalPath}`);
  if (header.meta?.dryRun) {
    throw new Error(`run ${header.runId} was a dry run — it moved nothing, so there is nothing to roll back`);
  }

  // Index what the journal says happened, per operation.
  const moved = records.filter((r) => r.kind === 'moved');
  const planned = records.filter((r) => r.kind === 'planned-move');
  const journalledMoves = new Set(moved.map(moveKey));
  // Operations that were announced but never confirmed — the crash window described above.
  const unconfirmed = planned.filter((r) => !journalledMoves.has(moveKey(r)));

  const errors = [];
  let restored = 0, alreadyInPlace = 0, failed = 0;

  // Reverse order: the last move is undone first. With collision-suffixed targets this matters —
  // undoing forwards could free a name that a later operation had already claimed.
  const toUndo = [...moved].reverse();
  for (const r of unconfirmed.reverse()) {
    // Only undo an unconfirmed operation if the filesystem shows it actually happened.
    if (await exists(abs(root, r.to)) && !(await exists(abs(root, r.from)))) toUndo.push(r);
  }

  for (const r of toUndo) {
    const fromAbs = abs(root, r.from);   // where the file originally lived
    const toAbs = abs(root, r.to);       // where apply put it
    try {
      if (!(await exists(toAbs))) {
        // Nothing at the destination: either already rolled back, or something else moved it.
        if (await exists(fromAbs)) { alreadyInPlace += 1; continue; }
        throw new Error('the file is neither at its destination nor at its origin');
      }
      if (await exists(fromAbs)) throw new Error('the original path is occupied again — refusing to overwrite');
      if (!dryRun) {
        // The original parent may have been pruned by an earlier rollback step or never existed
        // after the run reshaped the tree — recreate it before putting the file back.
        await mkdir(dirname(fromAbs), { recursive: true });
        await rename(toAbs, fromAbs);
      }
      restored += 1;
    } catch (e) {
      errors.push({ path: r.to, error: e.message ?? String(e) });
      failed += 1;
    }
  }

  // Prune the directories THIS run created, deepest first, and only while they are empty. Never
  // recursive, never anything the run did not create: leftover empty `2013/Лето/` folders would be
  // a visible lie about "the tree is back as it was", but deleting a directory the owner made would
  // be far worse than the untidiness.
  const dirsRemoved = [];
  const created = records.filter((r) => r.kind === 'mkdir').map((r) => r.dir);
  // Deepest first (by segment count, not string length — `ПРОЧЕЕ/_дубликаты` is longer than
  // `2015/Осень/аудио` yet shallower), so a child is always gone before its parent is tried.
  const depth = (p) => p.split('/').length;
  for (const d of [...new Set(created)].sort((a, b) => depth(b) - depth(a) || (a < b ? 1 : -1))) {
    const dirAbs = abs(root, d);
    try {
      if ((await readdir(dirAbs)).length === 0) {
        if (!dryRun) await rmdir(dirAbs);
        dirsRemoved.push(d);
      }
    } catch { /* already gone, or not empty — both are fine and not worth an error */ }
  }

  return { runId: header.runId, root, restored, alreadyInPlace, failed, dirsRemoved, errors, truncated };
}

/**
 * Find the journal inside a run directory. The journal is named `<runId>.jsonl`, and a run
 * directory holds exactly one — so we do not need the caller to know the id.
 * @param {string} runDir
 * @returns {Promise<string>}
 */
async function findJournal(runDir) {
  let entries;
  try {
    entries = await readdir(runDir);
  } catch {
    throw new Error(`no such run directory: ${runDir}`);
  }
  const journals = entries.filter((e) => e.endsWith('.jsonl') && e !== MANIFEST_NAME);
  if (journals.length === 0) throw new Error(`no run journal in ${runDir} — cannot roll back what was never recorded`);
  if (journals.length > 1) throw new Error(`ambiguous run directory (${journals.length} journals): ${runDir}`);
  return join(runDir, journals[0]);
}

/**
 * Read a run's backup manifest back (the record of what the tree looked like before the run).
 * Used by reports and by anyone who wants to verify a restoration by hash after the fact.
 * @param {string} runDir
 * @returns {Promise<{header: object, files: Array<{path, size, mtimeMs, sha256}>}>}
 */
export async function readManifest(runDir) {
  const raw = await readFile(join(runDir, MANIFEST_NAME), 'utf8');
  const lines = raw.split('\n').filter((l) => l !== '');
  return { header: JSON.parse(lines[0]), files: lines.slice(1).map((l) => JSON.parse(l)) };
}

/**
 * Render the rollback report (Russian — owner-facing, AGENT_GUIDE §Languages).
 * @param {object} result  the return value of rollbackRun
 * @returns {string}
 */
export function renderRollbackReport(result) {
  const L = [];
  L.push('ОТЧЁТ ОБ ОТКАТЕ');
  L.push('='.repeat(60));
  L.push(`Прогон:            ${result.runId}`);
  L.push(`Возвращено:        ${result.restored}`);
  if (result.alreadyInPlace > 0) L.push(`Уже были на месте: ${result.alreadyInPlace}`);
  if (result.dirsRemoved.length > 0) L.push(`Убрано пустых папок: ${result.dirsRemoved.length}`);
  if (result.failed > 0) L.push(`Не удалось:        ${result.failed}`);
  if (result.truncated) {
    L.push('');
    L.push('ВНИМАНИЕ: журнал прогона оборван (программа была прервана). Откачено всё, что в нём');
    L.push('успело записаться; бэкап-снимок прогона по-прежнему на месте.');
  }
  if (result.errors.length > 0) {
    L.push('');
    L.push('ОШИБКИ');
    L.push('-'.repeat(60));
    for (const e of result.errors) L.push(`  ${e.path}\n    ${e.error}`);
  }
  L.push('');
  L.push(result.failed === 0
    ? 'Дерево возвращено в исходное состояние.'
    : 'Часть файлов вернуть не удалось — смотрите ошибки выше; бэкап прогона не тронут.');
  return L.join('\n');
}
