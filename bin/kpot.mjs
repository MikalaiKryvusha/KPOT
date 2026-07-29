#!/usr/bin/env node
// bin/kpot.mjs — KPOT CLI entry point.
// [TESTED: 2026-07-24 · tests/cli.test.mjs — 8 specs incl. a real child-process spawn and a real
// scan run; suite 48/48 green + CLI smoke on a generated fixture tree (exit 0, kinds correct)]
//
// Parses argv (node:util parseArgs), validates input, dispatches to a phase in `src/app/phases.mjs`,
// and PRINTS. Since 2026-07-29 (phase 6.0) that is all it does: the composition of the pipeline
// lives in the app layer, so the local web interface can call exactly the same code instead of
// growing a second copy of the product. This file is a FACE; it decides wording and exit codes.
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
import { scanArchive, planArchive, applyArchive, rollbackArchive, APPLY_OUTCOME } from '../src/app/phases.mjs';
import { renderPlan } from '../src/plan/plan.mjs';
import { renderApplyReport } from '../src/apply/apply.mjs';
import { renderRollbackReport } from '../src/apply/rollback.mjs';
import { renderUnfinishedWarning } from '../src/apply/resume.mjs';
import { createProgress } from '../src/core/progress.mjs';
import { startServer, findRunningInstance, openInBrowser } from '../src/ui/server.mjs';

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
  kpot ui                       open the program window in your browser (the server keeps running)

Options:
  --json                        plan: emit the machine-readable SortPlan instead of the report
  --dry-run                     apply/rollback: simulate through the same code path, write nothing
  --allow-no-snapshot           apply: proceed where the filesystem cannot make hardlinks
                                (exFAT/FAT32). Structure stays restorable, CONTENT is unprotected.
  --no-cache                    ignore and do not refresh the scan cache — re-hash everything
  --no-pixels                   skip the search for an edited photo's original by its pixels
                                (plans/02 §Шаг 2 — the only step that decodes images, and the only
                                slow one; without it those files keep their «снято не позже» ceiling)
  --resume                      apply: continue an interrupted run instead of starting a new one
                                (same backup, same journal — one rollback still undoes everything)
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
  ui:       { arg: null },       // runUi — takes no positional: it opens the window, nothing else
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
        'no-pixels': { type: 'boolean' },
        resume: { type: 'boolean' },
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
  if (phase.arg !== null && !target) {
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
  const pixels = parsed.values['no-pixels'] !== true;
  // A live progress line, but only when a person is watching: `createProgress` is inert unless
  // stderr is a terminal, so piping or redirecting output is unaffected and stdout never sees it.
  const progress = createProgress();

  if (command === 'ui') return runUi({ out, err });
  if (command === 'scan') return runScan(target, { out, err, cache, pixels, progress });
  if (command === 'plan') return runPlan(target, { out, err, cache, pixels, progress, json: parsed.values.json === true });
  if (command === 'apply') {
    return runApply(target, {
      out, err, cache, pixels, progress,
      dryRun: parsed.values['dry-run'] === true,
      allowNoSnapshot: parsed.values['allow-no-snapshot'] === true,
      resume: parsed.values.resume === true,
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
 * The scan phase: machine-readable JSON on stdout, a human one-liner on stderr — so
 * `kpot scan dir > map.json` just works. Read-only over the tree (RULE 1). Per-file errors are
 * inside the JSON and do not fail the run; only a scan-level failure exits non-zero.
 */
async function runScan(dir, { out, err, cache, pixels, progress }) {
  let scan, verdicts;
  try {
    ({ scan, verdicts } = await scanArchive(dir, { cache, pixels, progress }));
  } catch (e) {
    err(`kpot scan: ${e.message}`);
    return EXIT_ERROR;
  }
  out(JSON.stringify(scan, null, 2));
  const byKind = {};
  for (const a of scan.assets) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
  const kinds = Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(' · ') || 'nothing';
  err(`kpot scan: ${scan.assets.length} files (${kinds})`
    + ` · dates: ${verdicts.dated} dated, ${verdicts.partial} partial, ${verdicts.unknown} unknown`
    + cacheNote(scan)
    + (scan.errors.length ? ` · ${scan.errors.length} unreadable — see "errors"` : ''));
  return EXIT_OK;
}

/**
 * The plan phase: the pre-sort master plan (GOAL.md §а). Human-readable on stdout by default —
 * this is the artifact the OWNER reads before anything moves — and the machine-readable SortPlan
 * with `--json`, which is what apply and rollback consume.
 * Nothing is written and nothing is moved: planning is strictly read-only.
 */
async function runPlan(dir, { out, err, json, cache, pixels, progress }) {
  let plan, scan, unreadable;
  try {
    ({ scan, plan, unreadable } = await planArchive(dir, { cache, pixels, progress }));
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

/**
 * The apply phase — the only command that moves files, and only after a backup exists.
 * `--dry-run` runs the identical code path with inert filesystem effects (GOAL.md §в).
 *
 * All four endings of the phase now arrive as a named `outcome` from the app layer; this function's
 * only job is to say each of them in words and pick the exit code.
 */
async function runApply(dir, { out, err, dryRun, allowNoSnapshot, json, cache, pixels, progress, resume }) {
  let outcome;
  try {
    outcome = await applyArchive(dir, { dryRun, allowNoSnapshot, cache, pixels, progress, resume });
  } catch (e) {
    err(`kpot apply: ${e.message}`);
    return EXIT_ERROR;
  }

  if (outcome.outcome === APPLY_OUTCOME.BLOCKED_BY_UNFINISHED) {
    err(renderUnfinishedWarning(outcome.root, outcome.unfinished));
    return EXIT_ERROR;
  }
  if (outcome.outcome === APPLY_OUTCOME.NOTHING_TO_RESUME) {
    err('kpot apply --resume: незавершённых прогонов нет — продолжать нечего.');
    return EXIT_ERROR;
  }

  // Folders awaiting a decision are announced BEFORE the run's own result, not after: the owner
  // asked to be consulted, and a run that quietly leaves files behind is not a consultation.
  if (outcome.awaitingDecision > 0) {
    err(`kpot apply: ${outcome.awaitingDecision} папок ждут вашего решения — их файлы НЕ тронуты.`);
    err(`             Ответьте в файле и запустите снова: ${outcome.decisionsPath}`);
  }
  if (outcome.outcome === APPLY_OUTCOME.NOTHING_TO_MOVE) {
    err('kpot apply: nothing to move — the tree already matches the plan.');
    return EXIT_OK;
  }

  const result = outcome.result;
  out(json ? JSON.stringify(result, null, 2) : renderApplyReport(result));
  const mode = (dryRun ? ' --dry-run' : '') + (result.resumed ? ' --resume' : '');
  err(`kpot apply${mode}: ${result.moved} moved · ${result.failed} failed`
    + ` · backup ${result.backup.snapshot} (${result.backup.linked}/${result.backup.files} linked)`
    + (dryRun ? ' · NOTHING MOVED (dry run)' : ` · rollback: kpot rollback ${result.runId} ${outcome.root}`));
  return result.failed > 0 ? EXIT_ERROR : EXIT_OK;
}

/**
 * `kpot ui` — open the program's window. [NOT-TESTED]
 *
 * Two behaviours the owner's server/«морда» split makes mandatory (interview #003 Q6):
 *  · a SECOND launch must find the running server and open the face on it. Starting a second one
 *    would collide on the port, and the first double-click of a desktop shortcut is exactly when
 *    that happens;
 *  · the browser is opened only AFTER the server is listening — `startServer` resolves on the
 *    `listening` event, so awaiting it is the guarantee, not a sleep.
 *
 * This command deliberately does not return: the server outlives the browser tab, and the process
 * ends when the person presses «Завершить работу».
 */
async function runUi({ out, err, startImpl = startServer, findImpl = findRunningInstance,
  openImpl = openInBrowser } = {}) {
  const running = await findImpl();
  if (running) {
    err('kpot ui: программа уже работает — открываю её окно.');
    out(running.url);
    await openImpl(running.url);
    return EXIT_OK;
  }
  let s;
  try {
    s = await startImpl({ onShutdown: () => { process.exitCode = EXIT_OK; } });
  } catch (e) {
    err(`kpot ui: ${e.message}`);
    return EXIT_ERROR;
  }
  out(s.url);
  err('kpot ui: программа запущена. Окно можно закрыть — она продолжит работать.');
  err('         Чтобы выключить её совсем, нажмите в окне «Завершить работу».');
  if (!(await openImpl(s.url))) {
    err('kpot ui: не получилось открыть браузер — откройте ссылку выше вручную.');
  }
  return EXIT_OK;
}

/** The rollback phase — replay a run's journal backwards and put every file back. */
async function runRollback(runId, dir, { out, err, dryRun }) {
  let result;
  try {
    ({ result } = await rollbackArchive(runId, dir, { dryRun }));
  } catch (e) {
    err(`kpot rollback: ${e.message}`);
    return EXIT_ERROR;
  }
  out(renderRollbackReport(result));
  err(`kpot rollback${dryRun ? ' --dry-run' : ''}: ${result.restored} restored · ${result.failed} failed`);
  return result.failed > 0 ? EXIT_ERROR : EXIT_OK;
}

/** " · cache 23/26" — visible proof the cache is working, or silence when it is off/cold. */
function cacheNote(scan) {
  const c = scan?.cache;
  if (!c || c.hits === 0) return '';
  return ` · cache ${c.hits}/${c.hits + c.misses} reused (no re-hash)`;
}

// Real invocation only (not when imported by tests): returned code → process exit code.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
