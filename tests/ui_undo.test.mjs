// tests/ui_undo.test.mjs — «Вернуть как было» in the control panel (phase 6.3, plans/07).
//
// This is the most destructive operation KPOT has, and since this phase it is one HTTP request away.
// So the specs that matter here are the four REFUSALS, and every one of them asserts the absence of
// an effect (a census of the tree before and after) rather than the presence of an error message —
// a refusal that returns 403 and moves the files anyway would pass any assertion about wording.
//
// The one success spec is the product's oldest promise, checked the only honest way: a sha256
// census of every file before the sort must equal the census after the undo. Not "the same number
// of files" — the same bytes in the same places.
//
// Each guard below was verified by breaking the code first; the session record names which specs
// went red for which break.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, unlink } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { checkUndoable, UNDO_REFUSED } from '../src/ui/undo.mjs';
import { createJobRunner, JOB_KIND } from '../src/ui/jobs.mjs';
import { startServer, STATE_FILE } from '../src/ui/server.mjs';
import { renderPage } from '../src/ui/page.mjs';
import { applyArchive, listRuns } from '../src/app/phases.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture(tag = 'undo') {
  const dir = await mkdtemp(join(tmpdir(), `kpot-${tag}-`));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

/**
 * Every file in the tree with its content hash. This is what "byte-for-byte" means in these specs:
 * the same relative paths carrying the same bytes. KPOT's own bookkeeping is excluded — the run
 * journals legitimately grow, and they are not the owner's photographs.
 */
async function census(root) {
  const out = [];
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      if (e.name === RUNS_DIR_NAME) continue;
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      if (e.isDirectory()) stack.push({ abs: join(d.abs, e.name), rel });
      else out.push(`${rel}  ${createHash('sha256').update(await readFile(join(d.abs, e.name))).digest('hex')}`);
    }
  }
  return out.sort();
}

/** POST a JSON body to the running server, the way the page does. */
function post(port, path, token, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: `${path}?token=${token}`,
      method: 'POST', headers: { Host: '127.0.0.1', 'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload) } }, (res) => {
      let text = ''; res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text || '{}') }));
    });
    req.on('error', reject); req.end(payload);
  });
}

function get(port, path, token) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: `${path}${path.includes('?') ? '&' : '?'}token=${token}`,
      headers: { Host: '127.0.0.1' } }, (res) => {
      let text = ''; res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text || '{}') }));
    });
    req.on('error', reject); req.end();
  });
}

/** Wait until the server is idle again, with a ceiling so a hang fails instead of stalling. */
async function settle(port, token, ms = 120000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const { body } = await get(port, '/api/state', token);
    if (!body.busy) return body.last;
    if (Date.now() > deadline) throw new Error('the job never finished');
    await new Promise((r) => setTimeout(r, 50));
  }
}

// ─── the rule: which runs may be undone at all ───────────────────────────────────────────────────

test('a REHEARSAL cannot be undone, and neither can a run whose backup is gone', async () => {
  const root = await fixture();
  try {
    await applyArchive(root, { dryRun: true });
    await applyArchive(root, {});
    const runs = await listRuns(root);
    const rehearsal = runs.find((r) => r.dryRun);
    const real = runs.find((r) => !r.dryRun);

    const dry = await checkUndoable(rehearsal.runId, root);
    assert.equal(dry.ok, false, 'a rehearsal moved nothing — there is nothing to put back');
    assert.equal(dry.reason, UNDO_REFUSED.NOT_UNDOABLE);

    assert.equal((await checkUndoable(real.runId, root)).ok, true, 'the real run may be undone');

    // Now delete its backup the way a person clearing disk space would, and ask again.
    await unlink(join(root, RUNS_DIR_NAME, real.runId, 'manifest.jsonl'));
    const orphaned = await checkUndoable(real.runId, root);
    assert.equal(orphaned.ok, false, 'without its backup the undo could not be honoured');
    assert.equal(orphaned.reason, UNDO_REFUSED.NOT_UNDOABLE);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an id that names no run here is refused rather than resolved hopefully', async () => {
  const root = await fixture();
  try {
    assert.equal((await checkUndoable('run-does-not-exist', root)).reason, UNDO_REFUSED.NOT_FOUND);
    assert.equal((await checkUndoable('', root)).reason, UNDO_REFUSED.NOT_FOUND);
    assert.equal((await checkUndoable(null, root)).reason, UNDO_REFUSED.NOT_FOUND);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('A RUN BELONGING TO ANOTHER FOLDER IS REFUSED — the run id arrives from outside', async () => {
  // The id is a PATH SEGMENT, so `..` in it names a different archive entirely. This is the same
  // class of hole researches/08 measured for the «Открыть» button, and the same rule closes it:
  // resolve the real path first, then check containment.
  const theirs = await fixture('undo-theirs');
  const ours = await mkdtemp(join(tmpdir(), 'kpot-undo-ours-'));
  try {
    await applyArchive(theirs, {});
    const foreign = (await listRuns(theirs)).find((r) => !r.dryRun);
    const before = await census(theirs);

    const escape = join('..', '..', basename(theirs), RUNS_DIR_NAME, foreign.runId);
    const verdict = await checkUndoable(escape, ours);
    assert.equal(verdict.ok, false, 'a run outside this library is not ours to undo');
    assert.equal(verdict.reason, UNDO_REFUSED.OUTSIDE);

    assert.deepEqual(await census(theirs), before, 'and the other folder was not touched');
  } finally {
    await rm(theirs, { recursive: true, force: true });
    await rm(ours, { recursive: true, force: true });
  }
});

// ─── the rule: one job at a time ─────────────────────────────────────────────────────────────────

test('an undo cannot start on top of a run that is already going', async () => {
  // Asserted at the job runner rather than over HTTP on purpose: `start` answers synchronously
  // while the first job is still running, so this spec cannot pass by winning a race.
  const root = await fixture();
  try {
    const runner = createJobRunner();
    assert.equal(runner.start(JOB_KIND.SCAN, root).ok, true);
    const undo = runner.start(JOB_KIND.ROLLBACK, root, { runId: 'run-whatever', confirmed: true });
    assert.equal(undo.ok, false, 'two things reshaping one tree at once is a race for the photographs');
    assert.equal(undo.reason, 'busy');
    while (runner.state().busy) await new Promise((r) => setTimeout(r, 25));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an undo with no run named is refused — «вернуть всё подряд» is not on offer', async () => {
  const runner = createJobRunner();
  const undo = runner.start(JOB_KIND.ROLLBACK, tmpdir(), { confirmed: true });
  assert.equal(undo.ok, false);
  assert.equal(undo.reason, 'no-run');
});

// ─── over HTTP: the confirmation, and the undo itself ────────────────────────────────────────────

test('AN UNDO WITHOUT A CONFIRMATION IS REFUSED OVER HTTP, AND THE TREE DOES NOT MOVE', async () => {
  await rm(STATE_FILE, { force: true });
  const root = await fixture();
  const s = await startServer({ port: 0 });
  try {
    await applyArchive(root, {});
    const run = (await listRuns(root)).find((r) => !r.dryRun);
    const before = await census(root);

    const res = await post(s.port, '/api/undo', s.token, { runId: run.runId, root });
    assert.equal(res.status, 409, 'the server does not trust the page to have asked');
    assert.equal(res.body.reason, 'needs-confirmation');

    assert.deepEqual(await census(root), before,
      'not one file may move on an unconfirmed request — this is the assertion that matters');
  } finally {
    await s.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('a foreign run is refused over HTTP too, in words a person can act on', async () => {
  await rm(STATE_FILE, { force: true });
  const theirs = await fixture('undo-http-theirs');
  const ours = await mkdtemp(join(tmpdir(), 'kpot-undo-http-ours-'));
  const s = await startServer({ port: 0 });
  try {
    await applyArchive(theirs, {});
    const foreign = (await listRuns(theirs)).find((r) => !r.dryRun);
    const before = await census(theirs);

    const escape = join('..', '..', basename(theirs), RUNS_DIR_NAME, foreign.runId);
    const res = await post(s.port, '/api/undo', s.token,
      { runId: escape, root: ours, confirmed: true });
    assert.equal(res.status, 403);
    assert.equal(res.body.reason, UNDO_REFUSED.OUTSIDE);
    assert.match(res.body.message, /[А-Яа-яЁё]/, 'the fallback sentence is written for a person');

    assert.deepEqual(await census(theirs), before, 'the other archive is untouched');
  } finally {
    await s.close();
    await rm(theirs, { recursive: true, force: true });
    await rm(ours, { recursive: true, force: true });
  }
});

test('A CONFIRMED UNDO PUTS THE TREE BACK BYTE FOR BYTE — the product’s oldest promise', async () => {
  await rm(STATE_FILE, { force: true });
  const root = await fixture();
  const s = await startServer({ port: 0 });
  try {
    const original = await census(root);

    await applyArchive(root, {});
    const sorted = await census(root);
    assert.notDeepEqual(sorted, original, 'the sort really did reshape the tree');

    const libraryBefore = (await get(s.port, `/api/library?root=${encodeURIComponent(root)}`, s.token)).body;
    assert.equal(libraryBefore.isLibrary, true, 'after a sort the panel sees a library');

    const run = (await listRuns(root)).find((r) => !r.dryRun);
    const res = await post(s.port, '/api/undo', s.token,
      { runId: run.runId, root, confirmed: true });
    assert.equal(res.status, 202, 'a confirmed undo for our own run is accepted');
    const job = await settle(s.port, s.token);
    assert.equal(job.state, 'done', `the undo finished: ${job.error ?? ''}`);
    assert.equal(job.kind, 'rollback');
    assert.equal(job.runId, run.runId, 'the finished event names which run it undid');
    assert.equal(job.result.result.failed, 0);

    assert.deepEqual(await census(root), original,
      'every file is back where it was, with the same bytes — not merely the same count');

    // Criterion 6: what the panel re-reads after an undo must be the NEW picture, not yesterday's.
    const libraryAfter = (await get(s.port, `/api/library?root=${encodeURIComponent(root)}`, s.token)).body;
    assert.notDeepEqual(libraryAfter.years, libraryBefore.years,
      'the year folders the sort created are gone, and the panel must say so');
    const history = (await get(s.port, `/api/runs?root=${encodeURIComponent(root)}`, s.token)).body;
    assert.ok(history.runs.length > 0, 'the run itself stays in the history — it did happen');
  } finally {
    await s.close();
    await rm(root, { recursive: true, force: true });
  }
});

// ─── the page ────────────────────────────────────────────────────────────────────────────────────

test('the page offers the button ONLY on a row the server called undoable', () => {
  const html = renderPage();
  // The rows are built at runtime from data, so what is checked here is the RULE in the page's
  // source: the undo button is emitted inside the `r.undoable` branch and nowhere else. The gate
  // that actually protects the files is on the server (specs above) — this one guards the promise
  // the screen makes, which is that a button never appears where it could not be honoured.
  assert.match(html, /r\.undoable\s*\?\s*'<button data-undo="/,
    'the button must be conditional on undoable, not decorated with a disabled attribute');
  assert.equal(/data-undo=/.test(html.replace(/r\.undoable[\s\S]{0,400}?: ''/, '')), false,
    'and there must be no second place that emits it');
});

test('the undo has its own confirmation dialog, separate from the sort’s', () => {
  const html = renderPage();
  assert.match(html, /<dialog id="undo">/, 'one dialog with two meanings is one wiring mistake away');
  assert.match(html, /u-go/);
  assert.match(html, /'\/api\/undo'/, 'and it posts to the endpoint that checks everything again');
});
