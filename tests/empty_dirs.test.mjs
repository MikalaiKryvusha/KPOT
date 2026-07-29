// tests/empty_dirs.test.mjs — deleting the folders the sort emptied.
//
// This is the ONLY deletion KPOT performs, and it exists because the owner allowed it on
// 2026-07-26 with an explicit condition attached: «пустые папки после сортировки можно удалять,
// главное, чтобы пути и названия были записаны в коммит-бекап план, чтобы бекапер мог откатить
// всё, как было, и создать папки». So the specs here are written around that condition — the
// deletion is only as legitimate as the restoration, and a folder holds no bytes, so nothing but
// the manifest and the journal remember it ever existed.
//
// It also amends internal-map invariant 5 ("Nothing is destroyed"), which is why the guards are
// deliberately paranoid: the plan is never trusted about emptiness, and the tree's DIRECTORY SET —
// not just its files — must survive an apply→rollback cycle.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { makeJpeg } from './fixtures/make.mjs';
import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { buildPlan, renderPlan } from '../src/plan/plan.mjs';
import { applyPlan } from '../src/apply/apply.mjs';
import { rollbackRun, readManifest } from '../src/apply/rollback.mjs';
import { runDirFor } from '../src/apply/backup.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-emptydirs-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

async function planFor(root) {
  const scan = await scanTree(root);
  const verdicts = await annotateAssets(scan.root, scan.assets);
  scan.errors.push(...verdicts.errors);
  return { scan, plan: buildPlan(scan) };
}

/** Every directory under root as a set of relative paths (KPOT's own dir excluded). */
async function dirSet(root) {
  const out = new Set();
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === RUNS_DIR_NAME) continue;
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      out.add(rel);
      stack.push({ abs: join(d.abs, e.name), rel });
    }
  }
  return out;
}

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

// ─── the owner's condition: recorded before deleted ──────────────────────────────────────────────
test('the backup manifest records DIRECTORIES, not only files', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { runId: 'run-manifest' });
    const manifest = await readManifest(runDirFor(root, 'run-manifest'));

    assert.ok(manifest.dirs.length > 0, 'a folder holds no bytes — only this line remembers it existed');
    assert.deepEqual([...manifest.dirs].sort(), [...scan.dirs].sort(),
      'every directory that existed before the run must be in the backup');
    assert.equal(manifest.header.dirs, scan.dirs.length);
    // and the files are still there, unmixed
    assert.equal(manifest.files.length, scan.assets.length);
    assert.ok(manifest.files.every((f) => typeof f.sha256 === 'string'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the plan lists the folders that will be emptied, before anything runs', async () => {
  const root = await fixture();
  try {
    const { plan } = await planFor(root);
    assert.ok(plan.emptied.length > 0, 'the fixture must actually empty some folders');
    assert.equal(plan.counts.emptiedDirs, plan.emptied.length);

    // The owner reads the report, not the JSON — the deletions must be visible there too.
    const text = renderPlan(plan);
    assert.match(text, /ПАПКИ, КОТОРЫЕ ОПУСТЕЮТ И БУДУТ УДАЛЕНЫ/);
    assert.match(text, /откат воссоздаст каждую папку/);
    for (const d of plan.emptied) assert.ok(text.includes(d), `«${d}» is deleted but not shown`);

    // Every folder still exists at plan time: planning deletes nothing.
    for (const d of plan.emptied) assert.equal(await exists(join(root, ...d.split('/'))), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the deletion itself ─────────────────────────────────────────────────────────────────────────
test('apply removes the emptied folders and keeps the ones that still hold something', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    const applied = await applyPlan(root, plan, scan, { runId: 'run-rm' });
    assert.ok(applied.dirsRemoved.length > 0);

    for (const d of applied.dirsRemoved) {
      assert.equal(await exists(join(root, ...d.split('/'))), false, `«${d}» should have been removed`);
    }
    // `доки/` holds non-media files that stay put — it must survive.
    assert.equal(await exists(join(root, 'доки')), true,
      'a folder whose files stay must never be deleted');
    const survivors = await dirSet(root);
    for (const d of applied.dirsRemoved) assert.equal(survivors.has(d), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// This spec guards a CHAIN, not a single line: apply re-reads each directory before deleting it,
// AND uses `rmdir` rather than a recursive remove. Breaking either alone keeps this green (the
// other link holds); breaking BOTH turns it red, which is exactly right — it goes red precisely
// when a user's file would actually be destroyed. Verified by doing all three breaks.
test('a stale plan cannot delete a folder that is no longer empty', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    assert.ok(plan.emptied.includes('копии'), 'this spec needs «копии» to be on the deletion list');

    // Between planning and applying, a new file appears in a folder the plan intends to remove —
    // a download, another program, the owner. The plan is now WRONG about that folder, and a plan
    // is not permission: apply re-reads every directory at the moment of deletion.
    await writeFile(join(root, 'копии', 'появился позже.txt'), 'appeared after the plan', 'utf8');

    const applied = await applyPlan(root, plan, scan, { runId: 'run-stale' });
    assert.equal(applied.dirsRemoved.includes('копии'), false,
      'a folder that is no longer empty must be skipped, not deleted');
    assert.equal(await exists(join(root, 'копии', 'появился позже.txt')), true,
      'the file that appeared after planning must survive');
    // …and the run is still a success: the files it was asked to move all arrived.
    assert.equal(applied.failed, 0, JSON.stringify(applied.errors));
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the restoration half — what makes the deletion legitimate ───────────────────────────────────
// What this spec proves is the OUTCOME the owner was promised — the tree regains its directory set.
// It does NOT prove that rollback's explicit directory-restoration loop is load-bearing: breaking
// that loop leaves this green, because restoring a file into a folder recreates the folder anyway.
// That is recorded in rollback.mjs rather than papered over here (see EXP-0008: a spec that cannot
// distinguish the guard from an accident proves nothing about the guard).
test('rollback restores the tree\'s directory SET, not just its files', async () => {
  const root = await fixture();
  try {
    const dirsBefore = await dirSet(root);
    const { scan, plan } = await planFor(root);

    const applied = await applyPlan(root, plan, scan, { runId: 'run-shape' });
    assert.ok(applied.dirsRemoved.length > 0, 'the run must actually delete folders, or this proves nothing');

    const rolled = await rollbackRun(runDirFor(root, 'run-shape'));
    assert.equal(rolled.failed, 0, JSON.stringify(rolled.errors));
    assert.equal(rolled.dirsRestored.length, applied.dirsRemoved.length,
      'rollback must account for every deleted folder');

    const dirsAfter = await dirSet(root);
    const missing = [...dirsBefore].filter((d) => !dirsAfter.has(d));
    const extra = [...dirsAfter].filter((d) => !dirsBefore.has(d));
    assert.deepEqual(missing, [], `rollback did not restore: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `rollback left folders behind: ${extra.join(', ')}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── bug 05: the list must not name folders that are full ────────────────────────────────────────
// Note why the six specs above all missed this. Every one of them starts from an UNSORTED fixture,
// where the population that triggers the defect — media that is ALREADY at its destination — does
// not exist yet. The defect therefore cannot appear on a first sort and is most of the library on
// every run after it, which is the shape the owner lives in from now on (phase 6.4, the top-up).
test('A SORTED LIBRARY HAS NO FOLDERS WAITING TO BE DELETED — bug 05', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { runId: 'run-settled' });

    // Plan the tree KPOT itself just produced. Nothing moves — and nothing empties either.
    const second = await planFor(root);
    assert.deepEqual(second.plan.operations, [], 'the sort must be idempotent, or this proves nothing');
    assert.deepEqual(second.plan.emptied, [],
      'a settled library announced for deletion is the loudest possible false alarm in the one '
      + 'document the owner reads before authorising anything');
    assert.equal(second.plan.counts.emptiedDirs, 0);

    // The report is where the damage would land, so assert on the report too.
    assert.equal(renderPlan(second.plan).includes('ПАПКИ, КОТОРЫЕ ОПУСТЕЮТ'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// The sharper half of bug 05, and the reason it is a defect rather than a cosmetic error: a
// rehearsal skips the readdir/rmdir chain and therefore removes every folder the PLAN names, while
// the real run removes only the ones that truly emptied. A wrong list makes the two disagree — and
// GOAL.md §в promises the owner that they do not. Measured before the fix on this very shape:
// the rehearsal reported 48 folders removed where the real run removed 1.
test('THE REHEARSAL AND THE REAL RUN REMOVE THE SAME FOLDERS — GOAL.md §в', async () => {
  const dryRoot = await fixture();
  const realRoot = await fixture();
  try {
    // Both trees are sorted first, so the already-in-place population exists — this comparison is
    // meaningless on a first sort, where the two agree even with the defect present.
    for (const root of [dryRoot, realRoot]) {
      const first = await planFor(root);
      await applyPlan(root, first.plan, first.scan, { runId: 'run-settle' });
      // One new photograph arrives, the way a top-up begins.
      await mkdir(join(root, 'НОВОЕ'), { recursive: true });
      await writeFile(join(root, 'НОВОЕ', 'новое.jpg'), makeJpeg('2018:04:02 11:30:00', 902));
    }

    const dry = await planFor(dryRoot);
    const dryRun = await applyPlan(dryRoot, dry.plan, dry.scan, { dryRun: true, runId: 'run-dry' });
    const real = await planFor(realRoot);
    const realRun = await applyPlan(realRoot, real.plan, real.scan, { runId: 'run-real' });

    assert.equal(dryRun.moved, realRun.moved, 'the two runs must move the same number of files');
    assert.deepEqual([...dryRun.dirsRemoved].sort(), [...realRun.dirsRemoved].sort(),
      'a rehearsal that promises deletions the real run will not perform is not a rehearsal');
  } finally {
    await rm(dryRoot, { recursive: true, force: true });
    await rm(realRoot, { recursive: true, force: true });
  }
});

test('a dry run deletes no folder, but still reports which ones would go', async () => {
  const root = await fixture();
  try {
    const dirsBefore = await dirSet(root);
    const { scan, plan } = await planFor(root);
    const dry = await applyPlan(root, plan, scan, { dryRun: true, runId: 'run-drydirs' });

    assert.ok(dry.dirsRemoved.length > 0, 'the rehearsal must name the folders it would remove');
    assert.deepEqual([...(await dirSet(root))].sort(), [...dirsBefore].sort(),
      'a dry run that removes a directory is not a dry run');
  } finally { await rm(root, { recursive: true, force: true }); }
});
