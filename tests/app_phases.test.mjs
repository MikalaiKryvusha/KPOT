// tests/app_phases.test.mjs — the shared app layer (phase 6.0, plans/04).
//
// What these specs defend is one property, and it is not a nicety: **the product has ONE executor
// and several faces.** The terminal and the local web interface must reach the same code, or the
// dry run and the real run acquire two implementations and drift apart — internal-map invariant 2.
//
// So the layer's contract is narrow and testable:
//   1. it PRINTS NOTHING — every outcome is a return value, never a message;
//   2. the apply phase's four endings are named values a caller can branch on;
//   3. an error propagates instead of being flattened into an exit code.
//
// Rule 1 has no other guard anywhere in the suite: the CLI specs assert on what IS printed, and a
// stray `console.log` inside the layer would leave every one of them green while corrupting the
// artifact on stdout for the next caller (`kpot scan dir > map.json` is a documented contract).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { scanArchive, planArchive, applyArchive, rollbackArchive, APPLY_OUTCOME } from '../src/app/phases.mjs';
import { applyPlan } from '../src/apply/apply.mjs';
import { runDirFor } from '../src/apply/backup.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-app-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

/**
 * Run `fn` with every console channel and both raw streams intercepted, and return whatever it
 * wrote. Both layers matter: `console.*` is the obvious way to leak, and `process.stdout.write` is
 * the way a leak survives a reviewer who only grepped for `console`.
 */
async function withOutputCaptured(fn) {
  const written = [];
  const consoleKeys = ['log', 'error', 'warn', 'info', 'debug'];
  const savedConsole = consoleKeys.map((k) => [k, console[k]]);
  const savedOut = process.stdout.write;
  const savedErr = process.stderr.write;
  for (const k of consoleKeys) console[k] = (...a) => written.push(a.join(' '));
  process.stdout.write = (chunk) => { written.push(String(chunk)); return true; };
  process.stderr.write = (chunk) => { written.push(String(chunk)); return true; };
  try {
    const value = await fn();
    return { value, written };
  } finally {
    for (const [k, v] of savedConsole) console[k] = v;
    process.stdout.write = savedOut;
    process.stderr.write = savedErr;
  }
}

/** Stage the one condition that cannot be produced by running the tool normally: a run that was
 *  started and never finished. Mirrors the helper in tests/resume.test.mjs — a journal without its
 *  `done` record is exactly what an interruption looks like from the outside. */
async function interruptedRun(root, runId, afterMoves) {
  const { scan, plan } = await planArchive(root);
  const partial = { ...plan, operations: plan.operations.slice(0, afterMoves), emptied: [] };
  await applyPlan(root, partial, scan, { runId });
  const journalPath = join(runDirFor(root, runId), `${runId}.jsonl`);
  const lines = (await readFile(journalPath, 'utf8')).split('\n').filter((l) => l !== '');
  await writeFile(journalPath, lines.filter((l) => !l.includes('"kind":"done"')).join('\n') + '\n', 'utf8');
}

// ─── rule 1: the layer prints nothing ────────────────────────────────────────────────────────────

test('the app layer prints NOTHING — not through console, not through the raw streams', async () => {
  const root = await fixture();
  try {
    const scanned = await withOutputCaptured(() => scanArchive(root));
    assert.deepEqual(scanned.written, [], 'scanArchive wrote to a stream');
    assert.ok(scanned.value.scan.assets.length > 0, 'and it must still have done its job');

    const planned = await withOutputCaptured(() => planArchive(root));
    assert.deepEqual(planned.written, [], 'planArchive wrote to a stream');

    const applied = await withOutputCaptured(() => applyArchive(root));
    assert.deepEqual(applied.written, [], 'applyArchive wrote to a stream');
    assert.equal(applied.value.outcome, APPLY_OUTCOME.APPLIED);

    const rolled = await withOutputCaptured(() => rollbackArchive(applied.value.result.runId, root));
    assert.deepEqual(rolled.written, [], 'rollbackArchive wrote to a stream');
    assert.ok(rolled.value.result.restored > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── rule 2: all four endings of apply are reachable and named ───────────────────────────────────

test('apply ending 1 of 4 — a real run reports APPLIED with its result and its plan', async () => {
  const root = await fixture();
  try {
    const r = await applyArchive(root);
    assert.equal(r.outcome, APPLY_OUTCOME.APPLIED);
    assert.ok(r.result.moved > 0, 'a fresh fixture has files to move');
    assert.equal(r.result.failed, 0);
    assert.ok(r.plan, 'the plan travels with the outcome — a face has to render it');
    assert.ok(r.decisionsPath, 'and so does where the owner answers about folders');
    assert.equal(typeof r.awaitingDecision, 'number');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('apply ending 2 of 4 — sorting an already-sorted tree is NOTHING_TO_MOVE, not an error', async () => {
  const root = await fixture();
  try {
    await applyArchive(root);
    const again = await applyArchive(root);
    assert.equal(again.outcome, APPLY_OUTCOME.NOTHING_TO_MOVE);
    assert.equal(again.plan.operations.length, 0, 'idempotence, seen from the app layer');
    assert.ok(!('result' in again), 'nothing ran, so there is no run result to pretend about');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('apply ending 3 of 4 — an unfinished run BLOCKS a new one and hands back the runs to resolve', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 5);
    const r = await applyArchive(root);
    assert.equal(r.outcome, APPLY_OUTCOME.BLOCKED_BY_UNFINISHED);
    assert.equal(r.unfinished.length, 1);
    assert.equal(r.unfinished[0].runId, 'run-cut');
    assert.ok(!('plan' in r), 'the tree was never even planned — the fork comes first');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('apply ending 4 of 4 — --resume with nothing to resume is NOTHING_TO_RESUME', async () => {
  const root = await fixture();
  try {
    const r = await applyArchive(root, { resume: true });
    assert.equal(r.outcome, APPLY_OUTCOME.NOTHING_TO_RESUME);
    assert.ok(!('result' in r), 'refusing to resume must not start a run');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a dry run is exempt from the block — a rehearsal cannot make an interruption worse', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 5);
    const r = await applyArchive(root, { dryRun: true });
    assert.equal(r.outcome, APPLY_OUTCOME.APPLIED, 'the rehearsal runs');
    assert.equal(r.result.dryRun, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── rule 3: errors propagate, they are not flattened ────────────────────────────────────────────

test('a failure throws out of the layer instead of becoming a quiet value', async () => {
  const missing = join(tmpdir(), 'kpot-app-does-not-exist-9f3a1c');
  // Defensive, and not theoretical: an earlier version of this suite ran BEFORE the root check
  // existed, and planning the path brought it into being — after which this spec passed for the
  // wrong reason forever. A spec about a missing path must start by making sure it is missing.
  await rm(missing, { recursive: true, force: true });
  await assert.rejects(() => scanArchive(missing), 'scanArchive must not swallow a missing tree');
  await assert.rejects(() => planArchive(missing), 'planArchive must not swallow it either');
  await assert.rejects(() => applyArchive(missing), 'and apply must not report an outcome about it');
  await assert.rejects(() => rollbackArchive('run-nope', missing),
    'rolling back a run that does not exist is an error, never a silent no-op');
});

test('a mistyped path is NOT created as a side effect of being asked about', async () => {
  // Observed on 2026-07-29, before the root check moved down into the app layer: planning a
  // non-existent directory created it, because KPOT writes its own `.kpot-runs/` with `mkdir -p`
  // and that makes the parent too. Unreachable through the terminal — the CLI validates first — but
  // the whole point of this layer is that the terminal is no longer the only caller. A typo in a
  // web form must leave nothing behind on the owner's disk.
  const missing = join(tmpdir(), 'kpot-app-typo-4b7e2d');
  await rm(missing, { recursive: true, force: true });
  for (const call of [
    () => scanArchive(missing),
    () => planArchive(missing),
    () => applyArchive(missing),
    () => rollbackArchive('run-nope', missing),
  ]) {
    await call().then(() => { throw new Error('expected a rejection'); }, () => {});
    const created = await stat(missing).then(() => true, () => false);
    assert.equal(created, false, 'asking about a path must never bring it into existence');
  }
});
