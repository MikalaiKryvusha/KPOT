// src/apply/resume.mjs — finding a run that was interrupted, so it can be continued or undone.
// [TESTED: 2026-07-26 · tests/resume.test.mjs — detection (a finished run and a dry run are both
// excluded), the refusal to start a new run, and the guarantee that ONE rollback after a resume
// restores the true original. All three guards verified by breaking them; plus a live
// crash-and-resume run on the fixture (6 of 23 moves, resumed 17, one rollback restored 23)]
//
// Internal map, invariant 8: «A run is resumable. An interrupted `apply` leaves a journal that
// describes exactly which Operations completed, so the run can be continued or rolled back — never
// a half-state nobody can read.» This module is the "find it" half; `applyPlan({resume})` is the
// "continue it" half and `rollbackRun` is the "undo it" half.
//
// THE POINT THAT MATTERS, and it is not the time saved. On the real archive a crash (power, a
// closed laptop, an impatient Ctrl-C during a run that looked hung) leaves the tree half-sorted.
// The tempting behaviour is to let the next `apply` simply carry on: sorting is idempotent, so a
// fresh run WOULD finish the job correctly. But it would also take a fresh Backup — of the
// half-sorted tree — and from that moment the owner can no longer get back to what they had before
// they started. Undoing the whole thing would need two rollbacks, in the right order, with two run
// ids the owner never wrote down.
//
// So an unfinished run is treated as a fork in the road that only the owner may take: KPOT stops
// and offers exactly two ways out — continue that run (same journal, same backup, one rollback
// covers everything) or roll it back. What it must never do is quietly start a new one.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readRunJournal } from '../core/journal.mjs';
import { RUNS_DIR_NAME } from '../core/paths.mjs';
import { MANIFEST_NAME } from './backup.mjs';

/**
 * Runs in this tree that were started and never finished.
 *
 * A run is finished iff its journal carries a `done` record. Dry runs are excluded: they moved
 * nothing, so an interrupted one leaves the tree untouched and there is nothing to continue.
 *
 * Never throws: an unreadable or half-written run directory is reported as unusable rather than
 * blowing up the command the owner actually asked for.
 *
 * @param {string} root  absolute path of the scanned tree
 * @returns {Promise<Array<{runId: string, moved: number, planned: number, startedAt: string,
 *                          hasBackup: boolean, truncated: boolean}>>} sorted oldest first
 */
export async function findUnfinishedRuns(root) {
  const runsDir = join(root, RUNS_DIR_NAME);
  let entries;
  try {
    entries = await readdir(runsDir, { withFileTypes: true });
  } catch {
    return [];   // no runs directory at all — the normal first-run case
  }

  const unfinished = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = join(runsDir, e.name);
    let files;
    try {
      files = await readdir(dir);
    } catch { continue; }

    const journalName = files.find((f) => f.endsWith('.jsonl') && f !== MANIFEST_NAME);
    if (!journalName) continue;

    try {
      const { header, records, truncated } = await readRunJournal(join(dir, journalName));
      if (header.meta?.dryRun) continue;                        // rehearsals leave nothing behind
      if (records.some((r) => r.kind === 'done')) continue;      // it finished
      unfinished.push({
        runId: header.runId,
        moved: records.filter((r) => r.kind === 'moved').length,
        planned: header.meta?.operations ?? 0,
        startedAt: header.startedAt,
        hasBackup: files.includes(MANIFEST_NAME),
        truncated,
      });
    } catch { /* not a journal we can read — not something to offer the owner */ }
  }

  unfinished.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
  return unfinished;
}

/**
 * The message shown when an unfinished run blocks a new one. Russian — the owner reads this, and
 * they read it at a bad moment (something already went wrong), so it says what happened, what is
 * safe, and the two exact commands rather than describing them.
 *
 * @param {string} root
 * @param {Array} runs  from findUnfinishedRuns
 * @returns {string}
 */
export function renderUnfinishedWarning(root, runs) {
  const L = [];
  L.push('НЕЗАВЕРШЁННЫЙ ПРОГОН');
  L.push('='.repeat(60));
  L.push('Предыдущая сортировка была прервана и не довела дело до конца.');
  L.push('Ваши файлы целы: всё, что было перемещено, записано в журнал, а бэкап того прогона');
  L.push('помнит, как всё выглядело ДО него.');
  L.push('');
  for (const r of runs) {
    L.push(`  ${r.runId}`);
    L.push(`      начат: ${r.startedAt}`);
    L.push(`      успело переехать: ${r.moved}${r.planned ? ` из ${r.planned}` : ''}`);
    if (!r.hasBackup) {
      L.push('      бэкап не был дописан — значит прогон прервался ДО первого перемещения,');
      L.push('      и трогать ничего не успел');
    }
    if (r.truncated) L.push('      журнал оборван на последней записи (обычное дело при аварии)');
    L.push('');
  }
  L.push('Выберите одно из двух:');
  L.push('');
  L.push(`  1) Продолжить с того места:   kpot apply --resume ${root}`);
  L.push(`  2) Вернуть всё как было:      kpot rollback ${runs.at(-1).runId} ${root}`);
  L.push('');
  L.push('Новый прогон не начнётся, пока вы не решите: он снял бы бэкап уже с полуразобранного');
  L.push('дерева, и вернуться к исходному состоянию одной командой стало бы невозможно.');
  return L.join('\n');
}

/**
 * Every run this tree remembers — finished, unfinished and rehearsed alike. [NOT-TESTED]
 *
 * The control panel shows this as a history, so the shape is what a PERSON needs to recognise their
 * own run: when it happened, how much moved, whether it was only a rehearsal, and whether it can
 * still be undone. Nothing here performs anything: it reads journals and reports.
 *
 * `undoable` deliberately means "a real run, finished, with a backup on disk". A dry run moved
 * nothing, and a run whose manifest is gone cannot be rolled back honestly — offering an undo button
 * for either would be a promise the product could not keep.
 *
 * Never throws, for the same reason `findUnfinishedRuns` does not: a half-written run directory is
 * an unreadable row, not a reason to fail the screen someone is looking at.
 *
 * @param {string} root absolute path of the archive
 * @returns {Promise<Array<{runId, startedAt, moved, planned, dryRun, finished, hasBackup,
 *                          undoable}>>} newest first — the order a person looks for a recent run in
 */
export async function listRuns(root) {
  const runsDir = join(root, RUNS_DIR_NAME);
  let entries;
  try {
    entries = await readdir(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const runs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = join(runsDir, e.name);
    let files;
    try { files = await readdir(dir); } catch { continue; }
    const journalName = files.find((f) => f.endsWith('.jsonl') && f !== MANIFEST_NAME);
    if (!journalName) continue;
    try {
      const { header, records } = await readRunJournal(join(dir, journalName));
      const dryRun = header.meta?.dryRun === true;
      const finished = records.some((r) => r.kind === 'done');
      const hasBackup = files.includes(MANIFEST_NAME);
      runs.push({
        runId: header.runId,
        startedAt: header.startedAt,
        moved: records.filter((r) => r.kind === 'moved').length,
        planned: header.meta?.operations ?? 0,
        dryRun,
        finished,
        hasBackup,
        undoable: !dryRun && finished && hasBackup,
      });
    } catch { /* unreadable — not a row we can show honestly */ }
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  return runs;
}
