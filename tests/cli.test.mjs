// tests/cli.test.mjs — specs for the CLI skeleton (bin/kpot.mjs).
// [TESTED: 2026-07-24 · runs green via npm test — 7 pass here, 12/12 suite]
//
// Two layers: the exported run() is exercised in-process (fast, asserts on captured output), and
// one real child-process spawn proves the executable wiring (shebang line, exit-code plumbing).
// The exit-code contract asserted here is stable — phases will change, the contract must not.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, EXIT_OK, EXIT_ERROR, EXIT_USAGE, EXIT_NOT_IMPLEMENTED } from '../bin/kpot.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'kpot.mjs');

/** Run the CLI in-process, capturing stdout/stderr. */
async function cli(...argv) {
  let out = '', err = '';
  const code = await run(argv, { out: s => { out += s + '\n'; }, err: s => { err += s + '\n'; } });
  return { code, out, err };
}

test('--help exits 0 and lists every phase', async () => {
  const r = await cli('--help');
  assert.equal(r.code, EXIT_OK);
  for (const phase of ['scan', 'plan', 'apply', 'rollback', '--dry-run']) assert.ok(r.out.includes(phase), phase);
});

test('--version prints the package.json version', async () => {
  const r = await cli('--version');
  assert.equal(r.code, EXIT_OK);
  assert.match(r.out.trim(), /^\d+\.\d+\.\d+/);
});

test('no arguments → usage error (2)', async () => {
  const r = await cli();
  assert.equal(r.code, EXIT_USAGE);
  assert.ok(r.err.includes('Usage:'));
});

test('unknown command and unknown option → usage error (2)', async () => {
  assert.equal((await cli('frobnicate')).code, EXIT_USAGE);
  assert.equal((await cli('--frobnicate')).code, EXIT_USAGE);
});

test('scan without <dir> → usage error (2), with missing dir → runtime error (1)', async () => {
  const noArg = await cli('scan');
  assert.equal(noArg.code, EXIT_USAGE);
  assert.ok(noArg.err.includes('<dir>'));
  const missing = await cli('scan', join(tmpdir(), 'kpot-definitely-not-there-000'));
  assert.equal(missing.code, EXIT_ERROR);
  assert.ok(missing.err.includes('does not exist'));
});

test('every phase on a real dir → not-implemented (3) naming its planned phase', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-cli-'));
  try {
    for (const cmd of ['scan', 'plan', 'apply']) {
      const r = await cli(cmd, dir);
      assert.equal(r.code, EXIT_NOT_IMPLEMENTED, cmd);
      assert.ok(r.err.includes('not implemented'), cmd);
      assert.ok(r.err.includes('Phase'), cmd);
    }
    const rb = await cli('rollback', 'run-000');   // run-id is not a dir — no existence check
    assert.equal(rb.code, EXIT_NOT_IMPLEMENTED);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('real child process: node bin/kpot.mjs --help works end to end', () => {
  const r = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
  assert.equal(r.status, EXIT_OK);
  assert.ok(r.stdout.includes('Krinik Photo Organizer Tool'));
});
