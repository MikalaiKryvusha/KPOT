// tests/resume.test.mjs — continuing an interrupted run (internal map, invariant 8).
//
// The value here is NOT the time saved. On the real archive a crash — power, a closed laptop, an
// impatient Ctrl-C during a run that looked hung — leaves the tree half-sorted. Sorting is
// idempotent, so simply running `apply` again WOULD finish the job correctly; the danger is that it
// would also take a fresh Backup, of the half-sorted tree, and from that moment the owner can no
// longer return to what they had before they started.
//
// So the property these specs defend is: **after an interruption, ONE rollback still restores the
// true original.** Everything else here exists to make that true.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { buildPlan } from '../src/plan/plan.mjs';
import { applyPlan } from '../src/apply/apply.mjs';
import { rollbackRun } from '../src/apply/rollback.mjs';
import { runDirFor } from '../src/apply/backup.mjs';
import { findUnfinishedRuns, renderUnfinishedWarning } from '../src/apply/resume.mjs';
import { readRunJournal } from '../src/core/journal.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));
const KPOT = fileURLToPath(new URL('../bin/kpot.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-resume-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

async function planFor(root) {
  const scan = await scanTree(root);
  const verdicts = await annotateAssets(scan.root, scan.assets);
  scan.errors.push(...verdicts.errors);
  return { scan, plan: buildPlan(scan) };
}

async function census(root) {
  const out = new Map();
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      if (e.name === RUNS_DIR_NAME) continue;
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      const abs = join(d.abs, e.name);
      if (e.isDirectory()) stack.push({ abs, rel });
      else if (e.isFile()) out.set(rel, createHash('sha256').update(await readFile(abs)).digest('hex'));
    }
  }
  return out;
}

/**
 * Run `apply` and cut it off partway, the way a crash would: the backup and journal are real, some
 * moves happened, and no `done` record was ever written.
 */
async function interruptedRun(root, runId, afterMoves) {
  const { scan, plan } = await planFor(root);
  const partial = { ...plan, operations: plan.operations.slice(0, afterMoves), emptied: [] };
  await applyPlan(root, partial, scan, { runId });
  // Strip the `done` record — this is what an interruption looks like from the outside.
  const journalPath = join(runDirFor(root, runId), `${runId}.jsonl`);
  const lines = (await readFile(journalPath, 'utf8')).split('\n').filter((l) => l !== '');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(journalPath, lines.filter((l) => !l.includes('"kind":"done"')).join('\n') + '\n', 'utf8');
  return { totalPlanned: plan.operations.length };
}

// ─── detection ───────────────────────────────────────────────────────────────────────────────────
test('an interrupted run is found, a finished one is not, and a dry run never counts', async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await findUnfinishedRuns(root), [], 'a fresh tree has no unfinished runs');

    // A completed run must not look interrupted.
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { runId: 'run-complete' });
    assert.deepEqual(await findUnfinishedRuns(root), []);

    // A dry run leaves no half-state to continue, whatever its journal says.
    await applyPlan(root, plan, scan, { dryRun: true, runId: 'run-dry' });
    assert.deepEqual(await findUnfinishedRuns(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an interrupted run is reported with what it managed to do', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 5);
    const found = await findUnfinishedRuns(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].runId, 'run-cut');
    assert.equal(found[0].moved, 5, 'the journal knows exactly how far it got');
    assert.equal(found[0].hasBackup, true);

    // The owner reads this at a bad moment, so it must say what is safe and give the two commands.
    const text = renderUnfinishedWarning(root, found);
    assert.match(text, /НЕЗАВЕРШЁННЫЙ ПРОГОН/);
    assert.match(text, /Ваши файлы целы/);
    assert.match(text, /kpot apply --resume/);
    assert.match(text, /kpot rollback run-cut/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the guarantee ───────────────────────────────────────────────────────────────────────────────
test('resuming finishes the job and ONE rollback still restores the true original', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const { totalPlanned } = await interruptedRun(root, 'run-cut', 5);
    assert.ok(totalPlanned > 5, 'the fixture must leave real work unfinished');

    // Resume: same run id, same backup, same journal — the caller re-plans the CURRENT tree, and
    // idempotence means what is left in the plan is exactly what is left to do.
    const { scan, plan } = await planFor(root);
    assert.equal(plan.operations.length, totalPlanned - 5, 'the remaining plan is the remaining work');
    const resumed = await applyPlan(root, plan, scan, { resume: 'run-cut' });
    assert.equal(resumed.resumed, true);
    assert.equal(resumed.runId, 'run-cut', 'a resumed run keeps its identity');
    assert.equal(resumed.failed, 0, JSON.stringify(resumed.errors));

    // The sort is complete.
    assert.equal((await planFor(root)).plan.operations.length, 0);

    // …and the whole thing — both halves — is undone by ONE command with ONE run id.
    const rolled = await rollbackRun(runDirFor(root, 'run-cut'));
    assert.equal(rolled.failed, 0, JSON.stringify(rolled.errors));
    assert.equal(rolled.restored, totalPlanned, 'every move from BOTH halves must be undone');
    assert.deepEqual([...(await census(root))].sort(), [...before].sort(),
      'the tree must return to what it was before the interrupted run started');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a resumed run continues the SAME journal — the record of the run stays whole', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 4);
    const firstHalf = await readRunJournal(join(runDirFor(root, 'run-cut'), 'run-cut.jsonl'));

    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { resume: 'run-cut' });
    const whole = await readRunJournal(join(runDirFor(root, 'run-cut'), 'run-cut.jsonl'));

    assert.equal(whole.header.runId, 'run-cut');
    assert.equal(whole.header.startedAt, firstHalf.header.startedAt, 'the header is never rewritten');
    assert.ok(whole.records.length > firstHalf.records.length, 'the second half was appended');
    // Sequence numbers continue rather than restart, so gaps stay detectable.
    const seqs = whole.records.map((r) => r.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'seq must be monotonic across the resume');
    assert.equal(new Set(seqs).size, seqs.length, 'no seq may repeat after resuming');
    assert.ok(whole.records.some((r) => r.kind === 'resumed'), 'the resume itself is recorded');
    assert.equal(whole.records.at(-1).kind, 'done');

    // Only ONE run directory exists: resuming did not spawn a second run with a second backup.
    const runs = await readdir(join(root, RUNS_DIR_NAME));
    assert.deepEqual(runs.filter((r) => r.startsWith('run-')), ['run-cut']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('resuming does NOT re-make the backup — the original state stays restorable', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 5);
    const manifestPath = join(runDirFor(root, 'run-cut'), 'manifest.jsonl');
    const manifestBefore = await readFile(manifestPath, 'utf8');

    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { resume: 'run-cut' });

    assert.equal(await readFile(manifestPath, 'utf8'), manifestBefore,
      'a re-made manifest would describe the HALF-SORTED tree as if it were the original — '
      + 'the single most damaging thing resume could do');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the refusal ─────────────────────────────────────────────────────────────────────────────────
test('the CLI refuses to start a NEW run while an interrupted one is unresolved', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 5);
    const after = await census(root);

    const r = await execFileP(process.execPath, [KPOT, 'apply', root], { maxBuffer: 64 * 1024 * 1024 })
      .then((ok) => ({ code: 0, ...ok }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));

    assert.equal(r.code, 1, 'starting a fresh run over a half-sorted tree must fail loudly');
    assert.match(r.stderr, /НЕЗАВЕРШЁННЫЙ ПРОГОН/);
    assert.match(r.stderr, /--resume/);
    assert.deepEqual([...(await census(root))].sort(), [...after].sort(),
      'the refused command must not have touched anything');

    // Only one run directory: the refused command created no second backup.
    const runs = (await readdir(join(root, RUNS_DIR_NAME))).filter((x) => x.startsWith('run-'));
    assert.deepEqual(runs, ['run-cut']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a dry run is still allowed while a run is unresolved — a rehearsal cannot make it worse', async () => {
  const root = await fixture();
  try {
    await interruptedRun(root, 'run-cut', 5);
    const after = await census(root);
    const r = await execFileP(process.execPath, [KPOT, 'apply', '--dry-run', root], { maxBuffer: 64 * 1024 * 1024 });
    // «Сухой прогон» was a literal rendering of "dry run" and one of the words the owner banned;
    // phase 6.6 renamed it to «репетиция», which is what the interface had been calling it since
    // 6.2. What this asserts is unchanged: the run produced a REHEARSAL report rather than a real
    // one, and the census below proves nothing moved.
    assert.match(r.stdout, /ОТЧЁТ О РЕПЕТИЦИИ/);
    assert.deepEqual([...(await census(root))].sort(), [...after].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('--resume with nothing to resume is an error, not a silent fresh run', async () => {
  const root = await fixture();
  try {
    const r = await execFileP(process.execPath, [KPOT, 'apply', '--resume', root], { maxBuffer: 64 * 1024 * 1024 })
      .then((ok) => ({ code: 0, ...ok }), (e) => ({ code: e.code, stderr: e.stderr }));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /незавершённых прогонов нет/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('resuming a run that never wrote a backup is refused with the reason', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    await assert.rejects(
      () => applyPlan(root, plan, scan, { resume: 'run-never-existed' }),
      /cannot resume/i,
      'a run with no usable backup also moved nothing — it must not be continued',
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});
