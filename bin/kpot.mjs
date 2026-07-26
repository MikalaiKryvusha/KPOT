#!/usr/bin/env node
// bin/kpot.mjs — KPOT CLI entry point.
// [TESTED: 2026-07-24 · tests/cli.test.mjs — 8 specs incl. a real child-process spawn and a real
// scan run; suite 48/48 green + CLI smoke on a generated fixture tree (exit 0, kinds correct)]
//
// Parses argv (node:util parseArgs), validates input, and dispatches to a phase. All four phases
// are implemented; the contract below is stable and mirrored in tests/cli.test.mjs:
//
//   kpot scan <dir>              build the scan map of a tree           (✅ Phase 2 — implemented)
//   kpot plan <dir>              emit the pre-sort master plan          (✅ Phase 3 — implemented)
//   kpot apply [--dry-run] <dir> execute the plan (dry run = same code path, no writes)  (✅ Phase 4)
//   kpot rollback <run-id> [dir] restore from the backup of a past run  (✅ Phase 4)
//
// Exit codes (stable contract, mirrored in tests/cli.test.mjs):
//   0 OK · 1 runtime error (e.g. path does not exist) · 2 usage error · 3 reserved (unreachable)

import { parseArgs } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { resolve } from 'node:path';
import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { buildPlan, renderPlan } from '../src/plan/plan.mjs';
import { applyPlan, renderApplyReport } from '../src/apply/apply.mjs';
import { rollbackRun, renderRollbackReport } from '../src/apply/rollback.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';
import { loadScanCache, saveScanCache, rekeyScanCache } from '../src/core/scan_cache.mjs';
import { loadDecisions, saveDecisions } from '../src/core/decisions.mjs';
import { createProgress } from '../src/core/progress.mjs';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;
/** Reserved. No phase returns it since Phase 4 landed apply/rollback — kept so scripts that already
 *  branch on the published contract keep compiling, and so a future phase has a code to use. */
export const EXIT_NOT_IMPLEMENTED = 3;

const USAGE = `KPOT — Krinik Photo Organizer Tool
Chaos in, chronology out: sorts a messy photo/video archive into a <year>/<season>/ library.
Nothing is ever moved without a plan, a backup, a dry run and a rollback path.

Usage:
  kpot scan <dir>               scan the tree, extract date evidence, build the scan map
  kpot plan <dir>               build the pre-sort master plan (+ disputed cases)
  kpot apply [--dry-run] <dir>  execute the plan (--dry-run: full simulation, zero writes)
  kpot rollback <run-id> [dir]  restore the tree from the backup of a previous run

Options:
  --json                        plan: emit the machine-readable SortPlan instead of the report
  --dry-run                     apply/rollback: simulate through the same code path, write nothing
  --allow-no-snapshot           apply: proceed where the filesystem cannot make hardlinks
                                (exFAT/FAT32). Structure stays restorable, CONTENT is unprotected.
  --no-cache                    ignore and do not refresh the scan cache — re-hash everything
  -h, --help                    show this help and exit
  -v, --version                 print the version and exit

KPOT writes NOTHING outside its own <dir>/.kpot-runs/ directory until you run apply.
Progress is shown on stderr while a run is in a terminal; stdout is always the artifact alone.

Exit codes: 0 ok · 1 error · 2 usage · 3 reserved (every phase is implemented since Phase 4)
Docs: https://github.com/MikalaiKryvusha/KPOT`;

/** Phases and their positional argument. All four are implemented as of Phase 4 (2026-07-26). */
const PHASES = {
  scan:     { arg: 'dir' },      // runScan
  plan:     { arg: 'dir' },      // runPlan
  apply:    { arg: 'dir' },      // runApply
  rollback: { arg: 'run-id' },   // runRollback
};

/** Read our own version from package.json (single source of truth — no hardcoded copy). */
async function ownVersion() {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  return pkg.version;
}

/**
 * Run the CLI for the given argv (without the `node script` prefix).
 * Returns the exit code instead of calling process.exit — keeps it directly testable.
 * @param {string[]} argv
 * @param {{out?: (s: string) => void, err?: (s: string) => void}} io
 */
export async function run(argv, { out = console.log, err = console.error } = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        'dry-run': { type: 'boolean' },
        'allow-no-snapshot': { type: 'boolean' },
        'no-cache': { type: 'boolean' },
        json: { type: 'boolean' },
      },
      allowPositionals: true,
    });
  } catch (e) {
    err(`kpot: ${e.message}`);
    err(USAGE);
    return EXIT_USAGE;
  }

  if (parsed.values.help) { out(USAGE); return EXIT_OK; }
  if (parsed.values.version) { out(await ownVersion()); return EXIT_OK; }

  const [command, target] = parsed.positionals;
  if (!command) { err(USAGE); return EXIT_USAGE; }

  const phase = PHASES[command];
  if (!phase) {
    err(`kpot: unknown command '${command}'`);
    err(USAGE);
    return EXIT_USAGE;
  }
  if (!target) {
    err(`kpot: '${command}' requires a <${phase.arg}> argument`);
    return EXIT_USAGE;
  }

  // Phases operating on a directory verify it exists up front — a clear error beats a late crash.
  if (phase.arg === 'dir') {
    try {
      const s = await stat(target);
      if (!s.isDirectory()) { err(`kpot: not a directory: ${target}`); return EXIT_ERROR; }
    } catch {
      err(`kpot: directory does not exist: ${target}`);
      return EXIT_ERROR;
    }
  }

  const cache = parsed.values['no-cache'] !== true;
  // A live progress line, but only when a person is watching: `createProgress` is inert unless
  // stderr is a terminal, so piping or redirecting output is unaffected and stdout never sees it.
  const progress = createProgress();

  if (command === 'scan') return runScan(target, { out, err, cache, progress });
  if (command === 'plan') return runPlan(target, { out, err, cache, progress, json: parsed.values.json === true });
  if (command === 'apply') {
    return runApply(target, {
      out, err, cache, progress,
      dryRun: parsed.values['dry-run'] === true,
      allowNoSnapshot: parsed.values['allow-no-snapshot'] === true,
      json: parsed.values.json === true,
    });
  }
  if (command === 'rollback') {
    // The run id alone does not say which tree it belongs to, so the optional second positional
    // names the archive root (defaults to the current directory). The post-sort report prints the
    // exact command, so the owner never has to work this out.
    return runRollback(target, parsed.positionals[2] ?? process.cwd(), {
      out, err, dryRun: parsed.values['dry-run'] === true,
    });
  }

  err(`kpot: unhandled command '${command}'`);
  return EXIT_ERROR;
}

/**
 * The apply phase — the only command that moves files, and only after a backup exists.
 * `--dry-run` runs the identical code path with inert filesystem effects (GOAL.md §в).
 * Re-plans the tree immediately before executing, on purpose: applying a plan built minutes or days
 * ago against a tree that has changed since is exactly how a sorter destroys data.
 */
async function runApply(dir, { out, err, dryRun, allowNoSnapshot, json, cache, progress }) {
  const root = resolve(dir);
  let result;
  try {
    const { result: scan } = await scanAndAnnotate(root, { cache, progress });
    const { plan, decisionsPath } = await planWithDecisions(root, scan);
    // Folders awaiting a decision are announced BEFORE the run, not after: the owner asked to be
    // consulted, and a run that quietly leaves files behind is not a consultation.
    if (plan.counts.awaitingDecision > 0) {
      err(`kpot apply: ${plan.counts.awaitingDecision} папок ждут вашего решения — их файлы НЕ тронуты.`);
      err(`             Ответьте в файле и запустите снова: ${decisionsPath}`);
    }
    if (plan.operations.length === 0) {
      err('kpot apply: nothing to move — the tree already matches the plan.');
      return EXIT_OK;
    }
    result = await applyPlan(root, plan, scan, { dryRun, allowNoSnapshot, progress });
    // The run just renamed files the cache still indexes by their OLD paths. Carrying each entry
    // across is provably safe (a rename cannot change content) and is what stops the NEXT run from
    // re-hashing the whole archive for a tree whose bytes did not change.
    if (cache && !dryRun && result.moved > 0) {
      const moves = plan.operations.filter((o) => !result.errors.some((e) => e.path === o.from));
      await rekeyScanCache(root, moves);
    }
  } catch (e) {
    err(`kpot apply: ${e.message}`);
    return EXIT_ERROR;
  }
  out(json ? JSON.stringify(result, null, 2) : renderApplyReport(result));
  err(`kpot apply${dryRun ? ' --dry-run' : ''}: ${result.moved} moved · ${result.failed} failed`
    + ` · backup ${result.backup.snapshot} (${result.backup.linked}/${result.backup.files} linked)`
    + (dryRun ? ' · NOTHING MOVED (dry run)' : ` · rollback: kpot rollback ${result.runId} ${root}`));
  return result.failed > 0 ? EXIT_ERROR : EXIT_OK;
}

/** The rollback phase — replay a run's journal backwards and put every file back. */
async function runRollback(runId, dir, { out, err, dryRun }) {
  const root = resolve(dir);
  let result;
  try {
    result = await rollbackRun(resolve(root, RUNS_DIR_NAME, runId), { dryRun });
  } catch (e) {
    err(`kpot rollback: ${e.message}`);
    return EXIT_ERROR;
  }
  out(renderRollbackReport(result));
  err(`kpot rollback${dryRun ? ' --dry-run' : ''}: ${result.restored} restored · ${result.failed} failed`);
  return result.failed > 0 ? EXIT_ERROR : EXIT_OK;
}

/**
 * scan + annotate, shared by the scan, plan and apply phases.
 *
 * Never touches a USER file (RULE 1). It does read and refresh KPOT's own scan cache under
 * `.kpot-runs/`, which is what makes a repeated run on the real archive take seconds instead of
 * re-hashing 551 GB (`researches/02` §4) — the plan→apply pair alone pays that cost twice without it.
 * `--no-cache` opts out entirely.
 */
async function scanAndAnnotate(dir, { cache = true, progress = null } = {}) {
  const loaded = cache ? await loadScanCache(dir) : { entries: null };
  const result = await scanTree(dir, { cache: loaded.entries, progress });
  progress?.start('Определяю даты', result.assets.length);
  const verdicts = await annotateAssets(result.root, result.assets);
  result.errors.push(...verdicts.errors);
  progress?.done(null);
  if (cache) await saveScanCache(dir, result.assets);
  return { result, verdicts };
}

/**
 * Build the plan with the owner's folder decisions applied, then refresh the decisions file so any
 * newly-found folder appears in it and previous answers are preserved. The file's path is put in the
 * plan's meta, because the report has to tell the owner where to go and answer.
 */
async function planWithDecisions(dir, scan) {
  const { decisions, unreadable, path } = await loadDecisions(dir);
  const plan = buildPlan(scan, { decisions });
  plan.meta.decisionsPath = path;
  await saveDecisions(dir, plan.suspicious ?? [], decisions);
  return { plan, unreadable, decisionsPath: path };
}

/**
 * The plan phase: the pre-sort master plan (GOAL.md §а). Human-readable on stdout by default —
 * this is the artifact the OWNER reads before anything moves — and the machine-readable SortPlan
 * with `--json`, which is what Phase 4/5 (dry run, apply, rollback) will consume.
 * Nothing is written and nothing is moved: planning is strictly read-only.
 */
async function runPlan(dir, { out, err, json, cache, progress }) {
  let plan, scan, unreadable;
  try {
    const { result } = await scanAndAnnotate(dir, { cache, progress });
    scan = result;
    ({ plan, unreadable } = await planWithDecisions(dir, result));
  } catch (e) {
    err(`kpot plan: ${e.message}`);
    return EXIT_ERROR;
  }
  out(json ? JSON.stringify(plan, null, 2) : renderPlan(plan));
  for (const u of unreadable) {
    err(`kpot plan: не понял строку ${u.line} в файле решений — «${u.text.trim()}»`);
  }
  const c = plan.counts;
  err(`kpot plan: ${c.files} files · ${c.moves} moves · ${c.stay} stay · `
    + `${c.duplicateCopies} duplicate copies · ${c.disputed} disputed · ${c.collisions} name collisions`
    + (c.awaitingDecision > 0 ? ` · ${c.awaitingDecision} folders AWAITING YOUR DECISION` : '')
    + `${cacheNote(scan)} · NOTHING MOVED (plan only)`);
  return EXIT_OK;
}

/** " · cache 23/26" — visible proof the cache is working, or silence when it is off/cold. */
function cacheNote(scan) {
  const c = scan?.cache;
  if (!c || c.hits === 0) return '';
  return ` · cache ${c.hits}/${c.hits + c.misses} reused (no re-hash)`;
}

/**
 * The scan phase: machine-readable JSON on stdout, a human one-liner on stderr — so
 * `kpot scan dir > map.json` just works. Read-only over the tree (RULE 1). Per-file errors are
 * inside the JSON and do not fail the run; only a scan-level failure exits non-zero.
 */
async function runScan(dir, { out, err, cache, progress }) {
  let result, verdicts;
  try {
    ({ result, verdicts } = await scanAndAnnotate(dir, { cache, progress }));
  } catch (e) {
    err(`kpot scan: ${e.message}`);
    return EXIT_ERROR;
  }
  out(JSON.stringify(result, null, 2));
  const byKind = {};
  for (const a of result.assets) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
  const kinds = Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing';
  err(`kpot scan: ${result.assets.length} files (${kinds})`
    + ` · dates: ${verdicts.dated} dated, ${verdicts.partial} partial, ${verdicts.unknown} unknown`
    + cacheNote(result)
    + (result.errors.length ? ` · ${result.errors.length} unreadable — see "errors"` : ''));
  return EXIT_OK;
}

// Real invocation only (not when imported by tests): returned code → process exit code.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
