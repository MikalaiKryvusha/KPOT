// tests/ui_runs.test.mjs — the run history the control panel shows (phase 6.3).
//
// This is READ-ONLY on purpose. Listing what happened is safe; performing an undo over HTTP is the
// most destructive thing this product can do, and it is deliberately NOT wired yet — it needs the
// same care the sort's confirmation got. What these specs defend is that the list never offers an
// undo it cannot honour: a rehearsal moved nothing, and a run whose backup is gone cannot be rolled
// back honestly. An «Вернуть как было» button on either would be a promise the product cannot keep.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { listRuns, applyArchive } from '../src/app/phases.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-runs-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

test('a tree that was never sorted has no history, and that is not an error', async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await listRuns(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a real run appears, is undoable, and a REHEARSAL is listed but never offered as undoable', async () => {
  const root = await fixture();
  try {
    await applyArchive(root, { dryRun: true });
    await applyArchive(root, { confirmed: true });

    const runs = await listRuns(root);
    assert.equal(runs.length, 2, 'both the rehearsal and the real run are remembered');

    const real = runs.find((r) => !r.dryRun);
    assert.ok(real, 'the real run is there');
    assert.equal(real.finished, true);
    assert.ok(real.moved > 0);
    assert.equal(real.undoable, true, 'it finished and it has a backup — an undo can be honoured');

    const rehearsal = runs.find((r) => r.dryRun);
    assert.ok(rehearsal, 'the rehearsal is shown, because the person did do it');
    assert.equal(rehearsal.undoable, false,
      'but it moved nothing, so offering to undo it would be a promise about nothing');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('newest first — the order a person looks for a recent run in', async () => {
  const root = await fixture();
  try {
    await applyArchive(root, { dryRun: true });
    await applyArchive(root, { confirmed: true });
    const runs = await listRuns(root);
    for (let i = 1; i < runs.length; i++) {
      assert.ok(runs[i - 1].startedAt >= runs[i].startedAt, 'history must run newest to oldest');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a run whose BACKUP is gone is listed but NOT undoable — the button must not lie', async () => {
  const root = await fixture();
  try {
    await applyArchive(root, { confirmed: true });
    // Delete the manifest the way a person clearing disk space would.
    const runsDir = join(root, RUNS_DIR_NAME);
    const dirs = (await readdir(runsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory()).map((e) => e.name);
    for (const d of dirs) {
      const files = await readdir(join(runsDir, d));
      const manifest = files.find((f) => f === 'manifest.jsonl');
      if (manifest) await unlink(join(runsDir, d, manifest));
    }
    const runs = await listRuns(root);
    assert.ok(runs.length > 0);
    assert.equal(runs.every((r) => r.undoable === false), true,
      'without its backup a run cannot be rolled back honestly, so it must not be offered');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an unreadable run directory is skipped, not thrown at the person', async () => {
  const root = await fixture();
  try {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(root, RUNS_DIR_NAME, 'run-nonsense'), { recursive: true });
    await writeFile(join(root, RUNS_DIR_NAME, 'run-nonsense', 'run-nonsense.jsonl'), 'not json\n');
    const runs = await listRuns(root);
    assert.ok(Array.isArray(runs), 'the screen still renders');
  } finally { await rm(root, { recursive: true, force: true }); }
});
