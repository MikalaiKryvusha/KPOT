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
test('rollback recreates every deleted folder — the tree regains its SHAPE, not just its files', async () => {
  const root = await fixture();
  try {
    const dirsBefore = await dirSet(root);
    const { scan, plan } = await planFor(root);

    const applied = await applyPlan(root, plan, scan, { runId: 'run-shape' });
    assert.ok(applied.dirsRemoved.length > 0, 'the run must actually delete folders, or this proves nothing');

    const rolled = await rollbackRun(runDirFor(root, 'run-shape'));
    assert.equal(rolled.failed, 0, JSON.stringify(rolled.errors));
    assert.equal(rolled.dirsRestored.length, applied.dirsRemoved.length,
      'every deleted folder must be recreated');

    const dirsAfter = await dirSet(root);
    const missing = [...dirsBefore].filter((d) => !dirsAfter.has(d));
    const extra = [...dirsAfter].filter((d) => !dirsBefore.has(d));
    assert.deepEqual(missing, [], `rollback did not restore: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `rollback left folders behind: ${extra.join(', ')}`);
  } finally { await rm(root, { recursive: true, force: true }); }
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
