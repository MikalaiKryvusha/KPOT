// tests/ui_jobs.test.mjs — how the interface runs a phase (6.2a, plans/06).
//
// Two of these specs guard the owner's files rather than the code's tidiness, and they are the
// reason this module exists as its own thing instead of living inside a request handler:
//
//   · exactly ONE job runs at a time — two sorts over one tree is a race for his photographs;
//   · a real sort is REFUSED without an explicit confirmation, checked on the server. He chose one
//     deliberate confirmation (interview #003 Q4 = А), and a page is not a place to enforce that:
//     a mis-wired button must not be able to move a file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { createJobRunner, JOB_KIND, JOB_STATE } from '../src/ui/jobs.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-jobs-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

/** Wait until the runner is idle again, with a ceiling so a hang fails instead of stalling forever. */
async function settle(runner, ms = 60000) {
  const deadline = Date.now() + ms;
  while (runner.state().busy) {
    if (Date.now() > deadline) throw new Error('the job never finished');
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Every file in the tree, so "nothing was touched" can be asserted rather than assumed. */
async function census(root) {
  const out = [];
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      if (e.name === RUNS_DIR_NAME) continue;
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      if (e.isDirectory()) stack.push({ abs: join(d.abs, e.name), rel });
      else out.push(rel);
    }
  }
  return out.sort();
}

test('a real sort is REFUSED without confirmation — and nothing in the tree moves', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const runner = createJobRunner();
    const r = runner.start(JOB_KIND.APPLY, root);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'needs-confirmation');
    assert.match(r.message, /подтверждени/i, 'and it says so in words a person reads');
    assert.equal(runner.state().busy, false, 'a refusal must not occupy the slot');
    assert.deepEqual(await census(root), before, 'the refused sort must not have touched anything');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a DRY RUN needs no confirmation — it rehearses and cannot make anything worse', async () => {
  const root = await fixture();
  try {
    const runner = createJobRunner();
    const r = runner.start(JOB_KIND.APPLY, root, { dryRun: true });
    assert.equal(r.ok, true);
    await settle(runner);
    assert.equal(runner.state().last.state, JOB_STATE.DONE);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('only ONE job runs at a time — a second request is refused, never queued', async () => {
  const root = await fixture();
  try {
    const runner = createJobRunner();
    const first = runner.start(JOB_KIND.PLAN, root);
    assert.equal(first.ok, true);

    const second = runner.start(JOB_KIND.PLAN, root);
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'busy');
    // Queueing would be worse than refusing: a sort that starts later, unattended, is exactly the
    // surprise this product may not spring on the owner.
    assert.match(second.message, /уже идёт/i);

    await settle(runner);
    const third = runner.start(JOB_KIND.PLAN, root);
    assert.equal(third.ok, true, 'and once the slot is free, work is accepted again');
    await settle(runner);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the browser is told when a job starts and when it ends', async () => {
  const root = await fixture();
  try {
    const heard = [];
    const runner = createJobRunner({ onEvent: (e, d) => heard.push([e, d.kind, d.state]) });
    runner.start(JOB_KIND.SCAN, root);
    await settle(runner);
    assert.deepEqual(heard.map((h) => h[0]), ['job-started', 'job-finished']);
    assert.equal(heard[1][2], JOB_STATE.DONE);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a FAILED job is a result the person can read, not a dead server', async () => {
  const runner = createJobRunner();
  const r = runner.start(JOB_KIND.PLAN, join(tmpdir(), 'kpot-jobs-nope-71c3'));
  assert.equal(r.ok, true, 'the job starts — the failure happens inside it');
  await settle(runner);

  const { last, busy } = runner.state();
  assert.equal(last.state, JOB_STATE.FAILED);
  assert.match(last.error, /directory does not exist/);
  assert.equal(busy, false, 'the slot is freed, so the person can try again');

  // The runner is still usable afterwards — a failure must not poison it.
  const root = await fixture();
  try {
    const again = runner.start(JOB_KIND.SCAN, root);
    assert.equal(again.ok, true);
    await settle(runner);
    assert.equal(runner.state().last.state, JOB_STATE.DONE);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an unknown action is refused by name rather than attempted', () => {
  const runner = createJobRunner();
  const r = runner.start('delete-everything', 'C:/');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-kind');
  assert.equal(runner.state().busy, false);
});

test('a confirmed sort really runs, and the result travels with the job', async () => {
  const root = await fixture();
  try {
    const runner = createJobRunner();
    const r = runner.start(JOB_KIND.APPLY, root, { confirmed: true });
    assert.equal(r.ok, true);
    await settle(runner);
    const { last } = runner.state();
    assert.equal(last.state, JOB_STATE.DONE);
    assert.equal(last.result.outcome, 'applied');
    assert.ok(last.result.result.moved > 0, 'a fresh fixture has files to move');
  } finally { await rm(root, { recursive: true, force: true }); }
});
