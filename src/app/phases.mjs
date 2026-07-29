// src/app/phases.mjs — the four phases of KPOT as callable functions.
// [NOT-TESTED]
//
// This is the layer between a FACE (the terminal today, the local web interface from phase 6.1) and
// the engine. Its whole contract is one sentence:
//
//     it takes a directory and settings, returns artifacts, and prints NOTHING.
//
// Why it exists (plans/04, plans/03 §6 phase 6.0). Until 2026-07-29 this composition lived as
// private functions inside `bin/kpot.mjs`, tangled up with `console.log` and exit codes. A server
// could not call them, which left exactly two bad options: duplicate the pipeline — and then the dry
// run and the real run have TWO code paths and start to drift, breaking internal-map invariant 2 —
// or spawn the CLI and parse its human report back, which turns the owner's Russian prose into a
// machine protocol that breaks the first time someone improves a sentence.
//
// Three rules this module keeps, and which a reviewer should check first:
//   1. It never prints. Every outcome is a RETURN VALUE, including the ones the CLI used to express
//      by writing to stderr and returning an exit code.
//   2. It never swallows an error. A failure propagates; the caller decides how to show it.
//   3. It writes no user file itself — `applyArchive` delegates to `src/apply/`, which stays the
//      single writer (RULE 1). Everything here is composition, not effect.
//
// Layering (RULE 2): bin/ and src/ui/ → src/app/ → src/apply/ → src/plan/ → {dedupe, meta, scan} → src/core/

import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { renderPlan } from '../plan/plan.mjs';
import { renderApplyReport } from '../apply/apply.mjs';
import { renderRollbackReport } from '../apply/rollback.mjs';
import { scanTree } from '../scan/scan.mjs';
import { annotateAssets } from '../meta/annotate.mjs';
import { buildPlan } from '../plan/plan.mjs';
import { applyPlan } from '../apply/apply.mjs';
import { rollbackRun } from '../apply/rollback.mjs';
import { findUnfinishedRuns, listRuns } from '../apply/resume.mjs';
import { RUNS_DIR_NAME } from '../core/paths.mjs';
import { loadScanCache, saveScanCache, rekeyScanCache } from '../core/scan_cache.mjs';
import { loadDecisions, saveDecisions } from '../core/decisions.mjs';

/**
 * The owner-facing reports, re-exported so every FACE gets them from one place.
 *
 * They live in the modules that own their artifacts (the internal map explains why), but a face may
 * not reach below this layer — so without this line the web interface would either break RULE 2 or,
 * far worse, grow its own second rendering of the master plan. The owner reads that text and has
 * already corrected its wording twice; there must be exactly one of it.
 */
export { renderPlan, renderApplyReport, renderRollbackReport };

/**
 * Windows-aware path comparison, re-exported for the same reason as the renderers above.
 *
 * A face needs to ask "is this path inside that one?" — the control panel does, before showing a
 * folder — and `src/core/paths.mjs` is the bottom layer, which a face may not reach into. Note what
 * these are and are not: they compare TEXT (after normalisation), which is right for paths the
 * product produced itself and **insufficient as a security boundary** for a path that arrived from
 * outside. `researches/08` measured a junction defeating exactly this check; `src/ui/reveal.mjs`
 * resolves the real path first and only then compares.
 */
export { isInside, samePath } from '../core/paths.mjs';

/**
 * The name of KPOT's own bookkeeping directory, re-exported for the same reason.
 *
 * A face needs it to say WHERE a run lives — the undo button in the control panel has to resolve
 * `<root>/.kpot-runs/<run-id>` before it may trust a run id that arrived over HTTP — and hard-coding
 * the string in a second place is how two spellings of one folder eventually appear.
 */
export { RUNS_DIR_NAME } from '../core/paths.mjs';

/** The runs an archive remembers — the control panel's history. Read-only; it performs nothing. */
export { listRuns };

/**
 * The `НОВОЕ` inbox: what is waiting in it, and the one call that creates it (phase 6.4).
 *
 * Re-exported for the same reason as everything above — a face may not reach below this layer, and
 * the panel has to be able to say «в папке НОВОЕ ждут 12 файлов» and to offer to make the folder for
 * someone who has never made one. Note what is NOT here: there is no top-up phase. Sorting the inbox
 * IS `applyArchive`, because the inbox is inside the root and the sort is idempotent — a second
 * pipeline beside `apply` is precisely how a dry run and a real run start to drift.
 */
export { inboxState, createInbox } from '../core/inbox.mjs';

/** The inbox's name, so a face can spell it the one way the whole product spells it. */
export { INBOX_DIR } from '../core/paths.mjs';

/**
 * The desktop shortcut a packaged first run offers to create (phase 6.5).
 *
 * Re-exported for the same reason as everything above. Note what `shortcutState` is FOR: it reports
 * whether the offer may be made at all, so a development checkout never invites anyone to put a
 * permanent desktop link to a temporary folder.
 */
export { shortcutState, createShortcut } from '../core/shortcut.mjs';

/**
 * The outcomes of `applyArchive`. The apply phase has four genuinely different endings and the CLI
 * used to distinguish them by which message it printed — which meant a second caller had to
 * re-derive them from prose. Naming them makes each ending a value both faces can branch on.
 */
export const APPLY_OUTCOME = {
  /** An earlier run stopped half-way. Only the owner may choose between resuming and rolling back. */
  BLOCKED_BY_UNFINISHED: 'blocked-by-unfinished',
  /** `--resume` was asked for, but there is no interrupted run to continue. */
  NOTHING_TO_RESUME: 'nothing-to-resume',
  /** The plan is empty: the tree already matches it. Not an error — usually proof of idempotence. */
  NOTHING_TO_MOVE: 'nothing-to-move',
  /** The run happened. `result` carries what moved, what failed, and the backup to roll back to. */
  APPLIED: 'applied',
};

/**
 * Every phase starts here: the archive root must exist and be a directory.
 *
 * This check used to live in `bin/kpot.mjs`, i.e. in a FACE — which was fine while the terminal was
 * the only face, and stopped being fine the moment this layer became callable. Measured on
 * 2026-07-29 before it moved down: pointing the phases at a mistyped path did not fail, it
 * **created that directory**, because planning writes KPOT's own `.kpot-runs/` with `mkdir -p` and
 * that silently makes the parent too. A typo in a web form must not leave a stray folder on the
 * owner's disk, so the rule belongs to the engine and every face inherits it.
 *
 * The CLI still checks first and prints its own wording, so its behaviour is byte-identical.
 */
async function assertArchiveRoot(dir) {
  let s;
  try {
    s = await stat(dir);
  } catch {
    throw new Error(`directory does not exist: ${dir}`);
  }
  if (!s.isDirectory()) throw new Error(`not a directory: ${dir}`);
}

/**
 * scan + annotate — the shared front half of every phase.
 *
 * Never touches a USER file (RULE 1). It does read and refresh KPOT's own scan cache under
 * `.kpot-runs/`, which is what makes a repeated run on the real archive take seconds instead of
 * re-hashing 551 GB (`researches/02` §4) — the plan→apply pair alone pays that cost twice without it.
 * `cache: false` opts out entirely.
 *
 * @param {string} dir archive root
 * @param {{cache?: boolean, pixels?: boolean, progress?: object|null}} opts
 * @returns {Promise<{scan: object, verdicts: object}>} the scan map and the date-verdict summary
 */
export async function scanArchive(dir, { cache = true, pixels = true, progress = null } = {}) {
  await assertArchiveRoot(dir);
  const loaded = cache ? await loadScanCache(dir) : { entries: null };
  const scan = await scanTree(dir, { cache: loaded.entries, progress });
  progress?.start('Определяю даты', scan.assets.length);
  const verdicts = await annotateAssets(scan.root, scan.assets, { pixels, progress });
  scan.errors.push(...verdicts.errors);
  progress?.done(null);
  if (cache) await saveScanCache(dir, scan.assets);
  return { scan, verdicts };
}

/**
 * Build the plan with the owner's folder decisions applied, then refresh the decisions file so any
 * newly-found folder appears in it and previous answers are preserved. The file's path travels in
 * the plan's meta, because whoever renders the plan has to tell the owner where to go and answer.
 *
 * Takes an ALREADY-SCANNED tree, so `applyArchive` can plan without scanning twice.
 */
export async function planFromScan(dir, scan) {
  const { decisions, unreadable, path } = await loadDecisions(dir);
  const plan = buildPlan(scan, { decisions });
  plan.meta.decisionsPath = path;
  await saveDecisions(dir, plan.suspicious ?? [], decisions);
  return { plan, unreadable, decisionsPath: path };
}

/**
 * The plan phase: the pre-sort master plan (GOAL.md §а) as an artifact.
 * Nothing is moved and no user file is written — planning is strictly read-only.
 *
 * @returns {Promise<{scan, plan, unreadable, decisionsPath}>} `unreadable` lists lines of the
 *          decisions file that could not be understood — surfaced, never guessed at.
 */
export async function planArchive(dir, { cache = true, pixels = true, progress = null } = {}) {
  const { scan } = await scanArchive(dir, { cache, pixels, progress });
  const { plan, unreadable, decisionsPath } = await planFromScan(dir, scan);
  return { scan, plan, unreadable, decisionsPath };
}

/**
 * The apply phase — the only one that moves files, and only after a backup exists.
 * `dryRun` runs the identical code path with inert filesystem effects (GOAL.md §в).
 *
 * Re-plans the tree immediately before executing, on purpose: applying a plan built minutes or days
 * ago against a tree that has changed since is exactly how a sorter destroys data.
 *
 * @returns {Promise<object>} always `{ outcome, root, ... }` — see APPLY_OUTCOME. Errors are thrown,
 *          not encoded: a caller that forgets to handle one gets a stack trace, not a silent zero.
 */
export async function applyArchive(dir, {
  dryRun = false, allowNoSnapshot = false, cache = true, pixels = true, progress = null,
  resume = false,
} = {}) {
  const root = resolve(dir);
  await assertArchiveRoot(root);

  // An interrupted run is a fork only the owner may take. Starting a fresh run over a half-sorted
  // tree would take a NEW backup of that half-sorted state, and the way back to the original would
  // be gone — so KPOT stops and offers exactly two ways out. A dry run is exempt: it rehearses
  // without writing, so it cannot make the situation worse.
  const unfinished = dryRun ? [] : await findUnfinishedRuns(root);
  if (unfinished.length > 0 && !resume) {
    return { outcome: APPLY_OUTCOME.BLOCKED_BY_UNFINISHED, root, unfinished };
  }
  if (resume && unfinished.length === 0) {
    return { outcome: APPLY_OUTCOME.NOTHING_TO_RESUME, root };
  }

  const { scan } = await scanArchive(root, { cache, pixels, progress });
  const { plan, decisionsPath } = await planFromScan(root, scan);
  const resumeId = resume ? unfinished.at(-1).runId : null;

  // Folders awaiting a decision travel out with every outcome that has a plan: the owner asked to be
  // consulted, and a run that quietly leaves files behind is not a consultation.
  const awaiting = { awaitingDecision: plan.counts.awaitingDecision, decisionsPath, plan, scan };

  if (plan.operations.length === 0) {
    return { outcome: APPLY_OUTCOME.NOTHING_TO_MOVE, root, ...awaiting };
  }

  const result = await applyPlan(root, plan, scan, { dryRun, allowNoSnapshot, progress, resume: resumeId });

  // The run just renamed files the cache still indexes by their OLD paths. Carrying each entry
  // across is provably safe (a rename cannot change content) and is what stops the NEXT run from
  // re-hashing the whole archive for a tree whose bytes did not change.
  if (cache && !dryRun && result.moved > 0) {
    const moves = plan.operations.filter((o) => !result.errors.some((e) => e.path === o.from));
    await rekeyScanCache(root, moves);
  }

  return { outcome: APPLY_OUTCOME.APPLIED, root, result, ...awaiting };
}

/**
 * The rollback phase — replay a run's journal backwards and put every file back.
 * The run id alone does not say which tree it belongs to, hence the explicit root.
 */
export async function rollbackArchive(runId, dir, { dryRun = false } = {}) {
  const root = resolve(dir);
  await assertArchiveRoot(root);
  const result = await rollbackRun(resolve(root, RUNS_DIR_NAME, runId), { dryRun });
  return { root, result };
}
