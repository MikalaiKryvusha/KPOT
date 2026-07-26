// tests/idempotence.test.mjs — sorting twice must change nothing the second time (bug 01).
//
// The requirement is not an aesthetic one. `researches/02_real_archive_survey.md` §Directory
// structure records that the owner's real archive is ALREADY hand-sorted into `<year>/<season>`
// dirs, and demands the tool «recognize an already-sorted subtree, merge into it idempotently».
// A non-idempotent sort nests one level deeper on every run, lengthens quarantine names by their
// whole path (toward Windows' 260-char limit), and — worst — demotes correctly shelved files into
// `<год>/прочее`, so the library degrades the more it is used.
//
// These specs guard the CLASS, not the three symptoms that were found: the top-level one asserts
// "a second plan is empty", which stays true for any future bucket rule, and the unit specs below
// derive their expectations from the layout constants rather than restating them.

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
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';
import { SEASONS } from '../src/plan/season.mjs';
import {
  isTechnicalDir, isAlreadyQuarantined, customDirs, planBucket,
  GLOBAL_OTHER, YEAR_OTHER, JUNK_DIR, DUPES_DIR,
} from '../src/plan/bucket.mjs';
import { dirnameEvidence } from '../src/meta/dirname_date.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-idem-'));
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

// ─── the guarantee ───────────────────────────────────────────────────────────────────────────────
test('a second plan on an already-sorted tree has ZERO operations', async () => {
  const root = await fixture();
  try {
    const first = await planFor(root);
    const applied = await applyPlan(root, first.plan, first.scan, { runId: 'run-idem' });
    assert.equal(applied.failed, 0, JSON.stringify(applied.errors));
    assert.ok(applied.moved > 0);

    const second = await planFor(root);
    assert.deepEqual(
      second.plan.operations.map((o) => `${o.from} -> ${o.to}`), [],
      'the library must be a fixed point: sorting a sorted tree moves nothing',
    );
    assert.equal(second.plan.counts.files, first.plan.counts.files, 'no file may be lost or invented');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a third pass is still a no-op — the layout does not drift with repetition', async () => {
  const root = await fixture();
  try {
    const first = await planFor(root);
    await applyPlan(root, first.plan, first.scan, { runId: 'run-a' });
    const settled = await census(root);

    // Two more full cycles. Anything that grows per run (nesting depth, name prefixes) shows here.
    for (const runId of ['run-b', 'run-c']) {
      const next = await planFor(root);
      if (next.plan.operations.length > 0) {
        await applyPlan(root, next.plan, next.scan, { runId });
      }
      assert.deepEqual([...(await census(root))].sort(), [...settled].sort(),
        `pass ${runId} changed the library`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the sorted library still rolls back byte-for-byte after a no-op second pass', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const first = await planFor(root);
    await applyPlan(root, first.plan, first.scan, { runId: 'run-once' });

    const second = await planFor(root);
    assert.equal(second.plan.operations.length, 0);

    const rolled = await rollbackRun(runDirFor(root, 'run-once'));
    assert.equal(rolled.failed, 0, JSON.stringify(rolled.errors));
    assert.deepEqual([...(await census(root))].sort(), [...before].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the three root causes, each pinned at unit level ────────────────────────────────────────────
test('every directory KPOT itself creates counts as structure, not as an owner name', () => {
  // Derived from the layout constants, so adding a bucket without teaching isTechnicalDir about it
  // fails here instead of silently re-nesting on the owner's disk.
  const ownDirs = [...Object.values(SEASONS), YEAR_OTHER, GLOBAL_OTHER, JUNK_DIR, DUPES_DIR];
  for (const d of ownDirs) {
    assert.equal(isTechnicalDir(d), true, `KPOT's own directory «${d}» must not be re-nested`);
  }
  // The two long winter names are the ones that actually slipped through: stripping the token
  // «зима» from «Зима начало года» leaves «начало года», which looked like an owner's folder.
  assert.equal(isTechnicalDir('Зима начало года'), true);
  assert.equal(isTechnicalDir('Зима конец года'), true);

  // …and the owner's own names are still preserved — the fix must not over-reach.
  for (const d of ['Мобилка', 'семейный архив', 'Из ВК', 'отпуск 2005', 'голосовые']) {
    assert.equal(isTechnicalDir(d), false, `the owner's folder «${d}» must survive the sort`);
  }
  assert.deepEqual(customDirs('2014/Зима начало года/Мобилка/x.jpg'), ['Мобилка']);
});

test('a quarantined file keeps its name — provenance is applied once, not once per run', () => {
  const dupe = { path: 'копии/DSC02000.JPG', kind: 'photo', verdict: { status: 'unknown' } };
  const firstPass = planBucket(dupe, { isDuplicateCopy: true });
  assert.equal(firstPass.name, 'копии__DSC02000.JPG', 'the original directory travels with the file');

  // Now feed back what the first pass produced.
  const already = { path: `${GLOBAL_OTHER}/${DUPES_DIR}/копии__DSC02000.JPG`, kind: 'photo', verdict: { status: 'unknown' } };
  const secondPass = planBucket(already, { isDuplicateCopy: true });
  assert.equal(secondPass.name, 'копии__DSC02000.JPG', 'the prefix must not stack on itself');
  assert.equal([...secondPass.segments, secondPass.name].join('/'), already.path,
    'an already-quarantined file is already where it belongs');

  assert.equal(isAlreadyQuarantined(`${GLOBAL_OTHER}/${JUNK_DIR}/a__b.db`), true);
  assert.equal(isAlreadyQuarantined(`${GLOBAL_OTHER}/Из ВК/x.jpg`), false, 'only the two quarantine areas count');
  assert.equal(isAlreadyQuarantined('копии/DSC02000.JPG'), false);
});

test('directory evidence reads a year and a season that live in DIFFERENT segments', () => {
  // KPOT's own layout — the case that was silently losing the season (bug 01).
  const own = dirnameEvidence('2013/Осень/день рождения.jpg');
  assert.equal(own.length, 1);
  assert.equal(own[0].wall.year, 2013);
  assert.equal(own[0].season, 'осень');
  assert.equal(own[0].detail, '2013/Осень', 'the evidence must name BOTH segments it read');

  // The owner's own spelling, both facts in one segment — unchanged behaviour.
  const owner = dirnameEvidence('2013/осень 2013/день рождения.jpg');
  assert.equal(owner[0].wall.year, 2013);
  assert.equal(owner[0].season, 'осень');
  assert.equal(owner[0].detail, 'осень 2013', 'a single-segment read still reports one segment');

  // A deeper segment naming a DIFFERENT year must not lend its season to this claim.
  const crossed = dirnameEvidence('2013/2014 поездка/лето 2014/x.jpg');
  assert.equal(crossed[0].wall.year, 2014, 'the innermost plausible year still wins');
  assert.equal(crossed[0].season, 'лето');

  // A season with no year anywhere is still not a date.
  assert.deepEqual(dirnameEvidence('Осень/x.jpg'), []);
});
