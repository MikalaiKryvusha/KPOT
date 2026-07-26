// src/apply/apply.mjs — the executor: the ONE place in KPOT that moves a user's file.
// [TESTED: 2026-07-26 · tests/apply_phase4.test.mjs — the three MASTER_PLAN Phase-4 acceptance
// criteria (dry≡real journals record-for-record · apply→rollback byte-for-byte · no backup means no
// write), plus a live CLI run on a generated tree. Guards verified by breaking them first: putting
// dryRun back into the 'done' record and journalling only the deepest mkdir level both went red]
//
// AGENT_GUIDE.md RULE 1 (the safety invariant): only this module may modify, move or delete a
// user's file, and only after a backup exists and the run journal has recorded the intended
// operation. Everything upstream (scan → meta → dedupe → plan) is strictly read-only.
//
// The three guarantees this module implements, all from GOAL.md §«перед тем как инструмент выполнит
// реальную сортировку»:
//   б) it REFUSES to write unless a Backup for this run exists (src/apply/backup.mjs).
//   в) the dry run is «почти 1 в 1» the real run — enforced structurally, not by discipline: both
//      execute the SAME SortPlan through the SAME loop below, and the only difference is whether the
//      injected effects actually call the filesystem (see `makeEffects`). There is no second code
//      path that could drift from the first.
//   г) every operation is journalled BEFORE it happens, so a crash leaves a readable record and
//      `rollback <run-id>` can undo exactly what was done.
//
// Error policy (AGENT_GUIDE §Code style): one file's failure never aborts the run — it is recorded
// with its path and the loop continues. A partially-completed run stays fully rollbackable, because
// rollback replays the journal, not the plan.

import { mkdir, readdir, rename, rmdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRunJournal, openRunJournal, newRunId } from '../core/journal.mjs';
import { RUNS_DIR_NAME } from '../core/paths.mjs';
import { createBackup, verifyBackup, runDirFor } from './backup.mjs';

/**
 * The filesystem effects `applyPlan` is allowed to perform, injected so the dry run and the real run
 * share one loop. This is the whole mechanism behind the dry-run≡real-run guarantee: a dry run is
 * not "a different function that pretends" — it is this same function with inert effects.
 *
 * The subtle part is `exists`. A naive dry run answers it by looking at the disk, and then diverges
 * from the real run the moment an operation frees a path that a later operation wants: the real run
 * sees that path as free (it emptied it itself), the dry run still sees the file sitting there and
 * reports a conflict that would never have happened. So the effects keep a small model of what THIS
 * RUN has done — what it filled and what it emptied — and answer `exists` from the model first, disk
 * second. Both modes then give identical answers, and the real mode is also simply correct.
 *
 * @param {boolean} dryRun
 */
function makeEffects(dryRun) {
  const occupied = new Set();  // relative paths this run has filled
  const freed = new Set();     // relative paths this run has emptied
  const real = !dryRun;
  return {
    async mkdir(absPath) {
      if (real) await mkdir(absPath, { recursive: true });
    },
    async rename(fromAbs, toAbs, fromRel, toRel) {
      if (real) await rename(fromAbs, toAbs);
      freed.add(fromRel); occupied.delete(fromRel);
      occupied.add(toRel); freed.delete(toRel);
    },
    async exists(rel, absPath) {
      if (occupied.has(rel)) return true;
      if (freed.has(rel)) return false;
      try { await stat(absPath); return true; } catch { return false; }
    },
  };
}

/**
 * Create every missing level of a target directory, journalling each level SEPARATELY.
 *
 * Why one record per level and not one per operation: `mkdir -p 2015/Осень/аудио` silently creates
 * three directories, but a journal that mentions only the deepest one leaves rollback unable to
 * clean up the other two — the tree comes back with empty `2015/` and `2015/Осень/` shells that the
 * owner never had. Walking shallowest-first also guarantees each level is examined BEFORE anything
 * creates it, which is what keeps the dry run's answers identical to the real run's.
 *
 * A level that already exists is never recorded, so rollback can never delete a directory the owner
 * made themselves.
 */
async function ensureDir(root, relDir, fx, journal, considered, dirsCreated) {
  if (relDir === '.' || relDir === '') return;
  const parts = relDir.split('/');
  for (let i = 1; i <= parts.length; i += 1) {
    const level = parts.slice(0, i).join('/');
    if (considered.has(level)) continue;
    considered.add(level);
    const levelAbs = abs(root, level);
    if (await fx.exists(level, levelAbs)) continue;
    await fx.mkdir(levelAbs);
    await journal.append('mkdir', { dir: level });
    dirsCreated.push(level);
  }
}

/** Absolute path of a plan-relative ('/'-separated) path inside the root. */
const abs = (root, rel) => join(root, ...rel.split('/'));

/**
 * Execute a SortPlan.
 *
 * @param {string} root  absolute path of the tree the plan was built for
 * @param {object} plan  the SortPlan artifact from src/plan/plan.mjs
 * @param {object} scan  the scan result the plan was built from (the backup manifest needs hashes)
 * @param {{dryRun?: boolean, runId?: string, allowNoSnapshot?: boolean, probeSupport?: Function}} [opts]
 *        `probeSupport` is forwarded to the backup — see its docstring for why it is injectable.
 * @returns {Promise<{runId, dryRun, journalPath, backup, moved, failed, dirsCreated, errors}>}
 * @throws {Error} if the plan does not match the tree, or a backup could not be created — refusing
 *         is the correct behaviour; a write without a backup is the one thing this tool may not do.
 */
export async function applyPlan(root, plan, scan, {
  dryRun = false, runId = newRunId(), allowNoSnapshot = false, probeSupport, progress = null,
  resume = null,
} = {}) {
  if (plan.meta?.root && plan.meta.root !== root) {
    throw new Error(`plan was built for a different root (${plan.meta.root}), refusing to apply it to ${root}`);
  }

  let backup, journal;

  if (resume) {
    // RESUMING an interrupted run. The backup is NOT re-made — and that is the whole point rather
    // than an optimisation. The existing backup describes the tree as it was before the first write;
    // taking a new one now would snapshot the half-sorted tree as if it were the original, and the
    // owner would lose the ability to get back to where they started. So the old backup is verified
    // and reused, and the old journal is continued, which keeps ONE run id able to undo everything.
    runId = resume;
    const check = await verifyBackup(root, runId);
    if (!check.ok) {
      throw new Error(
        `cannot resume run ${runId}: ${check.reason}. That run never got as far as writing a usable `
        + 'backup, which also means it never moved a file — start a normal run instead.',
      );
    }
    journal = await openRunJournal(runDirFor(root, runId), runId);
    if (journal.header.meta?.dryRun) {
      throw new Error(`run ${runId} was a dry run — it moved nothing, so there is nothing to resume`);
    }
    backup = {
      snapshot: journal.header.meta?.backup?.snapshot ?? 'hardlink',
      files: journal.header.meta?.backup?.files ?? 0,
      linked: journal.header.meta?.backup?.linked ?? 0,
      dir: runDirFor(root, runId),
      manifestPath: check.manifestPath,
      snapshotDir: check.snapshotDir,
      runId,
      errors: [],
    };
    // The remaining work needs no computing: the caller re-planned the CURRENT tree, and because
    // sorting is idempotent (bug 01) the files already moved are already at their destinations and
    // simply do not appear in the plan. What is left in `plan.operations` IS what is left to do.
    await journal.append('resumed', { alreadyRecorded: journal.resumedFrom, remaining: plan.operations.length });
  } else {
    // --- GUARANTEE б: a backup first, always. A dry run creates the manifest-less shell too, so
    // that the refusal path itself is exercised by the dry run rather than on the real one.
    backup = await createBackup(root, scan, { runId, dryRun, allowNoSnapshot, probeSupport, progress });
    if (!dryRun) {
      // Defence in depth: `createBackup` already throws on failure, so this re-check is not
      // independently reachable in a test — it exists because "the backup call returned" and "a
      // usable backup is on disk" are different claims, and only the second one may be trusted.
      // The check's own logic is covered directly by the verifyBackup specs.
      const check = await verifyBackup(root, runId);
      if (!check.ok) throw new Error(`refusing to move anything: ${check.reason}`);
      if (!check.hasSnapshot && !allowNoSnapshot) {
        throw new Error('refusing to move anything: the backup snapshot is empty');
      }
    }

    journal = await createRunJournal(runDirFor(root, runId), {
      runId,
      meta: {
        root,
        dryRun,                                 // ← the ONLY intended difference between the two runs
        planVersion: plan.planVersion,
        operations: plan.operations.length,
        backup: { snapshot: backup.snapshot, files: backup.files, linked: backup.linked },
      },
    });
  }

  const fx = makeEffects(dryRun);
  const dirsCreated = [];        // recorded so rollback can prune exactly what this run added
  const consideredDirs = new Set();
  const errors = [];
  let moved = 0, failed = 0;

  progress?.start(dryRun ? 'Проверяю (сухой прогон)' : 'Перемещаю', plan.operations.length);

  for (const op of plan.operations) {
    const fromAbs = abs(root, op.from);
    const toAbs = abs(root, op.to);

    // GUARANTEE г: intent is recorded BEFORE the act. A crash between these two lines leaves a
    // 'planned-move' with no 'moved' — which rollback reads as "may or may not have happened" and
    // resolves by looking at the filesystem, rather than guessing.
    await journal.append('planned-move', { from: op.from, to: op.to, reason: op.reason });

    try {
      await ensureDir(root, dirname(op.to), fx, journal, consideredDirs, dirsCreated);
      // Never overwrite. The plan already resolved collisions by renaming, so a target that exists
      // here means the tree changed under us between plan and apply — stop on that file, don't guess.
      if (await fx.exists(op.to, toAbs)) {
        throw new Error('target already exists — the tree changed since the plan was built');
      }

      await fx.rename(fromAbs, toAbs, op.from, op.to);
      await journal.append('moved', { from: op.from, to: op.to });
      moved += 1;
    } catch (e) {
      // EXDEV would mean the target landed on another volume. It cannot happen with the current
      // layout (targets are always relative to the same root), but if it ever does, the owner gets
      // an explicit error rather than a silent copy+delete — the 2026-07-24 decision forbids that.
      const error = e.code === 'EXDEV'
        ? 'target is on another volume — a rename is impossible and KPOT never silently copies+deletes'
        : (e.message ?? String(e));
      await journal.append('error', { from: op.from, to: op.to, error });
      errors.push({ path: op.from, error });
      failed += 1;
    }
    progress?.tick(0);
  }

  // --- the folders the sort emptied. The owner allowed this on 2026-07-26 — the ONLY deletion KPOT
  // performs — and attached a condition: the paths must be in the backup so a rollback recreates
  // them. Two safeguards beyond that:
  //   · the plan is never trusted about emptiness. Each directory is read again, right now, and
  //     skipped if anything is inside. A stale plan must not be able to delete a folder with files.
  //   · `rmdir` — NEVER a recursive remove. It physically cannot delete a non-empty directory.
  //   · only directories THIS run emptied are considered — a folder that was already empty before
  //     the run was not ours to remove.
  //
  // The first two are a CHAIN, and deliberately so: breaking either one alone still loses no file
  // (verified by breaking each — the specs stayed green, because the other link held), while
  // breaking both destroys a user's file and turns `tests/empty_dirs.test.mjs` red. Do not "simplify
  // away" the readdir as redundant with rmdir, or vice versa: each is the other's last line.
  const dirsRemoved = [];
  for (const dir of plan.emptied ?? []) {
    const dirAbs = abs(root, dir);
    try {
      if (!dryRun) {
        const left = await readdir(dirAbs);
        if (left.length > 0) continue;      // someone put something here — leave it alone
        await rmdir(dirAbs);
      }
      await journal.append('rmdir', { dir });
      dirsRemoved.push(dir);
    } catch (e) {
      // A folder that cannot be removed is not a failed run: every file already arrived safely.
      await journal.append('rmdir-skipped', { dir, error: e.message ?? String(e) });
    }
  }

  // Deliberately WITHOUT `dryRun`: the flag lives in the header, once. Repeating it here would make
  // the two journals differ in a record as well as the header, and the whole point of GOAL.md §в is
  // that the difference between a dry run and a real run is exactly one declared flag — a property
  // the acceptance spec asserts by comparing the journals record for record.
  await journal.append('done', { moved, failed });

  return {
    runId, dryRun, journalPath: journal.path, backup, moved, failed, dirsCreated, dirsRemoved, errors,
    resumed: Boolean(resume),
  };
}

/**
 * Render the post-sort report (GOAL.md §г — «пост-сортировочный отчёт с возможностью откатки»).
 * Russian: this is an owner-facing artifact (AGENT_GUIDE §Languages). The rollback command is the
 * point of the whole document, so it is stated plainly and last, where the eye lands.
 *
 * @param {object} result  the return value of applyPlan
 * @returns {string}
 */
export function renderApplyReport(result) {
  const L = [];
  L.push(result.dryRun ? 'ОТЧЁТ О СУХОМ ПРОГОНЕ' : 'ПОСТ-СОРТИРОВОЧНЫЙ ОТЧЁТ');
  L.push('='.repeat(60));
  L.push(`Прогон:            ${result.runId}`);
  if (result.dryRun) {
    L.push('');
    L.push('ЭТО СУХОЙ ПРОГОН. Ни один файл не тронут — показано, что произошло бы.');
    L.push(`Было бы перемещено: ${result.moved}`);
  } else {
    L.push(`Перемещено:        ${result.moved}`);
  }
  if (result.failed > 0) L.push(`Не удалось:        ${result.failed}`);
  if (result.dirsRemoved?.length > 0) {
    L.push(`Удалено пустых папок: ${result.dirsRemoved.length}  (их пути в бэкапе — откат воссоздаст)`);
  }
  L.push('');
  L.push('БЭКАП');
  L.push('-'.repeat(60));
  L.push(`  Манифест:  ${result.backup.files} файлов`);
  if (result.backup.snapshot === 'hardlink') {
    L.push(`  Снимок:    ${result.backup.linked} жёстких ссылок (содержимое защищено, места не занимает)`);
  } else if (result.backup.snapshot === 'unsupported') {
    L.push('  Снимок:    НЕТ — файловая система не умеет жёсткие ссылки.');
    L.push('             Структуру восстановить можно, содержимое НЕ защищено.');
  } else {
    L.push('  Снимок:    не создавался (сухой прогон)');
  }
  L.push(`  Журнал:    ${result.journalPath}`);
  L.push('');

  if (result.errors.length > 0) {
    L.push('ОШИБКИ (эти файлы остались на месте)');
    L.push('-'.repeat(60));
    for (const e of result.errors) L.push(`  ${e.path}\n    ${e.error}`);
    L.push('');
  }

  if (!result.dryRun && result.moved > 0) {
    L.push('ОТКАТ');
    L.push('-'.repeat(60));
    L.push('  Всё вернуть на свои места одной командой:');
    L.push('');
    L.push(`      kpot rollback ${result.runId}`);
    L.push('');
  }
  return L.join('\n');
}

export { RUNS_DIR_NAME };
