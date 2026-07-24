#!/usr/bin/env node
// bin/kpot.mjs — KPOT CLI entry point.
// [TESTED: 2026-07-24 · tests/cli.test.mjs — 8 specs incl. a real child-process spawn and a real
// scan run; suite 48/48 green + CLI smoke on a generated fixture tree (exit 0, kinds correct)]
//
// Parses argv (node:util parseArgs), validates input, and dispatches to a phase. Phases not yet
// landed report "not implemented" with a dedicated exit code, so scripts and tests can already
// rely on the contract:
//
//   kpot scan <dir>              build the scan map of a tree           (✅ Phase 2 — implemented)
//   kpot plan <dir>              emit the pre-sort master plan          (Phase 3)
//   kpot apply [--dry-run] <dir> execute the plan (dry run = same code path, no writes)  (Phase 4/5)
//   kpot rollback <run-id>       restore from the backup of a past run  (Phase 4)
//
// Exit codes (stable contract, mirrored in tests/cli.test.mjs):
//   0 OK · 1 runtime error (e.g. path does not exist) · 2 usage error · 3 phase not implemented yet

import { parseArgs } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;
export const EXIT_NOT_IMPLEMENTED = 3;

const USAGE = `KPOT — Krinik Photo Organizer Tool
Chaos in, chronology out: sorts a messy photo/video archive into a <year>/<season>/ library.
Nothing is ever moved without a plan, a backup, a dry run and a rollback path.

Usage:
  kpot scan <dir>               scan the tree, extract date evidence, build the scan map
  kpot plan <dir>               build the pre-sort master plan (+ disputed cases)
  kpot apply [--dry-run] <dir>  execute the plan (--dry-run: full simulation, zero writes)
  kpot rollback <run-id>        restore the tree from the backup of a previous run

Options:
  -h, --help                    show this help and exit
  -v, --version                 print the version and exit

Exit codes: 0 ok · 1 error · 2 usage · 3 not implemented yet (early development)
Docs: https://github.com/MikalaiKryvusha/KPOT`;

/** Phases, their positional argument, and (for the ones still ahead) where they land. */
const PHASES = {
  scan:     { arg: 'dir' },                            // implemented — see runScan below
  plan:     { arg: 'dir',    plannedIn: 'Phase 3' },
  apply:    { arg: 'dir',    plannedIn: 'Phase 4/5' },
  rollback: { arg: 'run-id', plannedIn: 'Phase 4' },
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

  if (command === 'scan') return runScan(target, { out, err });

  err(`kpot ${command}: not implemented yet — planned in ${phase.plannedIn} (see MASTER_PLAN.md).`);
  return EXIT_NOT_IMPLEMENTED;
}

/**
 * The scan phase: machine-readable JSON on stdout, a human one-liner on stderr — so
 * `kpot scan dir > map.json` just works. Read-only over the tree (RULE 1). Per-file errors are
 * inside the JSON and do not fail the run; only a scan-level failure exits non-zero.
 */
async function runScan(dir, { out, err }) {
  let result, verdicts;
  try {
    result = await scanTree(dir);
    verdicts = await annotateAssets(result.root, result.assets); // dates + evidence per media asset
    result.errors.push(...verdicts.errors);
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
    + (result.errors.length ? ` · ${result.errors.length} unreadable — see "errors"` : ''));
  return EXIT_OK;
}

// Real invocation only (not when imported by tests): returned code → process exit code.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
