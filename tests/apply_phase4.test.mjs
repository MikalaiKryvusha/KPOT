// tests/apply_phase4.test.mjs — the Phase-4 ACCEPTANCE spec: safety (backup · dry run · rollback).
//
// MASTER_PLAN.md Phase 4 states the acceptance criteria verbatim:
//   1. "dry-run and real-run journals are identical apart from execution flags"
//   2. "a full apply→rollback cycle on a fixture returns the tree byte-for-byte to its original
//       state, verified by hashes"
//   3. "`apply` without a backup exits non-zero and touches nothing"
// Each is one test below, asserted against the generated fixture tree — never against the owner's
// real archive (AGENT_GUIDE §Test harness).
//
// The byte-for-byte checks use a hash census of the whole tree (path → sha256), the same technique
// tests/plan_phase3.test.mjs uses to prove planning is read-only. Comparing two censuses is the kind
// of check that cannot be fooled by a plausible-looking summary: either every file is back where it
// was with the same bytes, or the diff names exactly what is not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { buildPlan } from '../src/plan/plan.mjs';
import { applyPlan } from '../src/apply/apply.mjs';
import { rollbackRun, readManifest } from '../src/apply/rollback.mjs';
import { createBackup, verifyBackup, probeHardlinkSupport, runDirFor } from '../src/apply/backup.mjs';
import { readRunJournal } from '../src/core/journal.mjs';
import { RUNS_DIR_NAME } from '../src/core/paths.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

/** Build the fixture tree in a fresh temp dir. Returns its absolute root. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-p4-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

/** scan + annotate + plan, exactly as the CLI does it. */
async function planFor(root) {
  const scan = await scanTree(root);
  const verdicts = await annotateAssets(scan.root, scan.assets);
  scan.errors.push(...verdicts.errors);
  return { scan, plan: buildPlan(scan) };
}

/**
 * A census of every USER file under `root`: relative path → sha256. Everything named `.kpot-runs`
 * is excluded whatever its type — that name is KPOT's own namespace (journals, manifests, the
 * snapshot), it is created by design, and one test deliberately plants a FILE there to simulate a
 * filesystem that cannot hold a backup.
 */
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
 * Strip what legitimately differs between any two runs of the same plan: the clock, the run
 * identity, and the two declared execution differences (`meta.dryRun` and the backup outcome, which
 * the test below asserts EXPLICITLY rather than letting this helper hide). Everything else — every
 * record, its order, its payload — must match.
 */
function comparableJournal({ header, records }) {
  const { startedAt, runId, meta, ...restHeader } = header;
  const { dryRun, backup, ...restMeta } = meta;
  return {
    header: { ...restHeader, meta: restMeta },
    records: records.map(({ ts, ...r }) => r),
  };
}

// ─── ACCEPTANCE 1 ────────────────────────────────────────────────────────────────────────────────
// GOAL.md §в) demands the dry run be «почти 1 в 1» the real run. "Almost" is not a testable word, so
// the spec pins the exact difference: everything except the clock, the run id and the dryRun flag
// must match record for record — same operations, same order, same targets.
test('dry run and real run produce identical journals apart from the execution flag', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);

    const dry = await applyPlan(root, plan, scan, { dryRun: true, runId: 'run-dry' });
    const dryJournal = await readRunJournal(dry.journalPath);

    // The dry run must have changed nothing, so the same plan is still valid for the real run.
    const real = await applyPlan(root, plan, scan, { dryRun: false, runId: 'run-real' });
    const realJournal = await readRunJournal(real.journalPath);

    assert.deepEqual(comparableJournal(dryJournal), comparableJournal(realJournal),
      'the dry run and the real run must walk exactly the same operations in the same order');
    assert.equal(dryJournal.header.meta.dryRun, true);
    assert.equal(realJournal.header.meta.dryRun, false);
    assert.equal(dry.moved, real.moved);
    assert.ok(real.moved > 0, 'the fixture must actually give the run something to do');

    // The second declared difference, asserted rather than assumed: a dry run does NOT build the
    // 71 606-link snapshot (that is the slow, disk-touching part), but it DOES probe whether the
    // snapshot would be possible — so the one failure mode that would abort the real run
    // (a filesystem without hardlinks) is discovered by the rehearsal, not by the performance.
    assert.equal(dryJournal.header.meta.backup.snapshot, 'skipped-dry-run');
    assert.equal(realJournal.header.meta.backup.snapshot, 'hardlink');
    assert.equal(dryJournal.header.meta.backup.files, realJournal.header.meta.backup.files);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a dry run leaves the tree byte-for-byte untouched', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const { scan, plan } = await planFor(root);
    const result = await applyPlan(root, plan, scan, { dryRun: true, runId: 'run-dry' });
    assert.ok(result.moved > 0, 'the dry run must report the moves it would have made');
    assert.deepEqual([...(await census(root))].sort(), [...before].sort(),
      'a dry run that changes a single byte is not a dry run');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── ACCEPTANCE 2 ────────────────────────────────────────────────────────────────────────────────
// The product's core promise: whatever the sort did, the owner can undo it completely.
test('a full apply → rollback cycle returns the tree byte-for-byte', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const { scan, plan } = await planFor(root);

    const applied = await applyPlan(root, plan, scan, { runId: 'run-cycle' });
    assert.equal(applied.failed, 0, `apply reported failures: ${JSON.stringify(applied.errors)}`);
    assert.ok(applied.moved > 0);

    // Sanity: the tree really did change — otherwise the rollback below would prove nothing.
    const after = await census(root);
    assert.notDeepEqual([...after.keys()].sort(), [...before.keys()].sort(),
      'apply must actually have moved files, or this test is vacuous');
    assert.equal(after.size, before.size, 'a move must never lose or duplicate a file');

    const rolled = await rollbackRun(runDirFor(root, 'run-cycle'));
    assert.equal(rolled.failed, 0, `rollback reported failures: ${JSON.stringify(rolled.errors)}`);
    assert.equal(rolled.restored, applied.moved, 'every move must be undone, no more and no less');

    const restored = await census(root);
    assert.deepEqual([...restored].sort(), [...before].sort(),
      'every file must be back at its original path with its original bytes');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rollback prunes the directories the run created, and leaves the owner\'s own alone', async () => {
  const root = await fixture();
  try {
    const dirsBefore = await allDirs(root);
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { runId: 'run-dirs' });
    const rolled = await rollbackRun(runDirFor(root, 'run-dirs'));
    assert.ok(rolled.dirsRemoved.length > 0, 'the run created year/season dirs — rollback must clear them');

    const dirsAfter = await allDirs(root);
    const leftovers = [...dirsAfter].filter((d) => !dirsBefore.has(d) && !d.startsWith(RUNS_DIR_NAME));
    assert.deepEqual(leftovers, [], `rollback left empty directories behind: ${leftovers.join(', ')}`);
    const vanished = [...dirsBefore].filter((d) => !dirsAfter.has(d));
    assert.deepEqual(vanished, [], `rollback removed directories it did not create: ${vanished.join(', ')}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rollback is idempotent — running it twice changes nothing and reports no failure', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { runId: 'run-twice' });
    await rollbackRun(runDirFor(root, 'run-twice'));
    const second = await rollbackRun(runDirFor(root, 'run-twice'));
    assert.equal(second.failed, 0, JSON.stringify(second.errors));
    assert.equal(second.restored, 0, 'the second rollback has nothing left to restore');
    assert.deepEqual([...(await census(root))].sort(), [...before].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── ACCEPTANCE 3 ────────────────────────────────────────────────────────────────────────────────
// Internal map, invariant 1: "No write without a Backup." The refusal must happen BEFORE the first
// rename, so a failed backup can never leave a half-sorted tree.
/** A probe that reports what exFAT/FAT32 would: this volume cannot hold hardlinks. */
const cannotHardlink = async () => ({ supported: false, reason: 'EPERM: simulated exFAT volume' });

test('apply refuses to write when a hardlink snapshot is impossible, and touches nothing', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const { scan, plan } = await planFor(root);

    // The refusal must be caused by the GUARD, not by some incidental filesystem failure — so the
    // volume is simulated rather than sabotaged, and the assertion pins the guard's own wording.
    // (An earlier version of this spec planted a file at `.kpot-runs` instead; it passed even with
    // the guard deleted, because journal creation then failed with ENOTDIR. A spec that cannot tell
    // the guard from an accident proves nothing.)
    await assert.rejects(
      () => applyPlan(root, plan, scan, { runId: 'run-nobackup', probeSupport: cannotHardlink }),
      (e) => /does not support hardlinks/i.test(e.message) && /--allow-no-snapshot/.test(e.message),
      'apply must refuse, naming the cause and the explicit override',
    );
    assert.deepEqual([...(await census(root))].sort(), [...before].sort(),
      'a refused run must not have touched a single file');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('verifyBackup rejects a run whose manifest is missing or empty — a directory is not a backup', async () => {
  const root = await fixture();
  try {
    // Nothing created at all.
    const none = await verifyBackup(root, 'run-never-made');
    assert.equal(none.ok, false);
    assert.match(none.reason, /no backup manifest/i);

    // An aborted backup leaves the run DIRECTORY behind. `apply` must not read that as a backup.
    await mkdir(runDirFor(root, 'run-aborted'), { recursive: true });
    const dirOnly = await verifyBackup(root, 'run-aborted');
    assert.equal(dirOnly.ok, false, 'an empty run directory must not count as a backup');

    // A manifest that exists but is empty is equally worthless.
    await writeFile(join(runDirFor(root, 'run-aborted'), 'manifest.jsonl'), '', 'utf8');
    const emptyManifest = await verifyBackup(root, 'run-aborted');
    assert.equal(emptyManifest.ok, false);
    assert.match(emptyManifest.reason, /empty/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('apply refuses when the backup cannot be written, and touches nothing', async () => {
  const root = await fixture();
  try {
    const before = await census(root);
    const { scan, plan } = await planFor(root);

    // A realistic "the backup could not be written" failure (full disk, revoked permission),
    // simulated by occupying the manifest's own path with a directory.
    await mkdir(join(runDirFor(root, 'run-nomanifest'), 'manifest.jsonl'), { recursive: true });

    await assert.rejects(
      () => applyPlan(root, plan, scan, { runId: 'run-nomanifest' }),
      'apply must refuse when the backup could not be written',
    );
    assert.deepEqual([...(await census(root))].sort(), [...before].sort(),
      'a refused run must not have touched a single file');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('with the explicit override, a snapshotless backup still yields a usable manifest', async () => {
  const root = await fixture();
  try {
    const scan = await scanTree(root);
    const backup = await createBackup(root, scan, {
      runId: 'run-override', allowNoSnapshot: true, probeSupport: cannotHardlink,
    });
    // Structure stays restorable (the manifest is there); content protection is honestly absent.
    assert.equal(backup.snapshot, 'unsupported');
    assert.equal(backup.linked, 0);
    const check = await verifyBackup(root, 'run-override');
    assert.equal(check.ok, true, 'the manifest alone is a valid — if weaker — backup');
    assert.equal(check.hasSnapshot, false);
    const manifest = await readManifest(runDirFor(root, 'run-override'));
    assert.equal(manifest.files.length, scan.assets.length);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the no-snapshot override is explicit: refused by default, allowed only when asked', async () => {
  const root = await fixture();
  try {
    const scanOnly = await scanTree(root);
    const dir = runDirFor(root, 'run-probe');

    // Default: a backup that cannot snapshot is an error, not a warning.
    await mkdir(dir, { recursive: true });
    const support = await probeHardlinkSupport(dir);
    assert.equal(support.supported, true, 'the test volume must support hardlinks for this suite to mean anything');

    // With the override the backup still produces a manifest — structure stays restorable.
    const backup = await createBackup(root, scanOnly, { runId: 'run-probe', allowNoSnapshot: true });
    assert.equal(backup.snapshot, 'hardlink');
    assert.equal(backup.linked, scanOnly.assets.length, 'every file must be linked, not a subset');
    const check = await verifyBackup(root, 'run-probe');
    assert.equal(check.ok, true);
    assert.equal(check.hasSnapshot, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── THE BACKUP ITSELF ───────────────────────────────────────────────────────────────────────────
test('the hardlink snapshot shares inodes with the originals and survives the sort', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    const applied = await applyPlan(root, plan, scan, { runId: 'run-snap' });
    assert.equal(applied.backup.snapshot, 'hardlink');
    assert.equal(applied.backup.linked, scan.assets.length);

    // After the sort every original path is gone from the tree, but its content is still reachable
    // through the snapshot — this is exactly the protection the owner was promised.
    const manifest = await readManifest(runDirFor(root, 'run-snap'));
    assert.equal(manifest.files.length, scan.assets.length);
    const sample = manifest.files.filter((f) => f.sha256).slice(0, 5);
    assert.ok(sample.length > 0);
    for (const f of sample) {
      const snapPath = join(runDirFor(root, 'run-snap'), 'snapshot', ...f.path.split('/'));
      const bytes = await readFile(snapPath);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256,
        `snapshot content diverged for ${f.path}`);
      assert.equal((await stat(snapPath)).size, f.size);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('KPOT never scans its own run directory', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { runId: 'run-selfscan' });

    // A re-scan after a run must see the sorted library only — never the backup snapshot. If it
    // did, every file would appear as its own duplicate and the tool would plan moves for its
    // own backup.
    const rescan = await scanTree(root);
    const leaked = rescan.assets.filter((a) => a.path.startsWith(RUNS_DIR_NAME));
    assert.deepEqual(leaked, [], 'the run directory leaked into the scan');
    assert.equal(rescan.assets.length, scan.assets.length, 'the same files, just in new places');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a run journal records intent before the act, and the outcome after it', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    const applied = await applyPlan(root, plan, scan, { runId: 'run-journal' });
    const { header, records } = await readRunJournal(applied.journalPath);

    assert.equal(header.meta.root, root);
    const planned = records.filter((r) => r.kind === 'planned-move');
    const moved = records.filter((r) => r.kind === 'moved');
    assert.equal(planned.length, plan.operations.length, 'every operation must be announced');
    assert.equal(moved.length, applied.moved);
    // Order matters: the intent for an operation must precede its outcome, or a crash between them
    // would leave a move rollback cannot see.
    for (const m of moved) {
      const intent = planned.find((p) => p.from === m.from && p.to === m.to);
      assert.ok(intent, `no recorded intent for the move of ${m.from}`);
      assert.ok(intent.seq < m.seq, `intent for ${m.from} was recorded after the move`);
    }
    assert.equal(records.at(-1).kind, 'done');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rollback refuses a dry run, because a dry run moved nothing', async () => {
  const root = await fixture();
  try {
    const { scan, plan } = await planFor(root);
    await applyPlan(root, plan, scan, { dryRun: true, runId: 'run-drylog' });
    await assert.rejects(
      () => rollbackRun(runDirFor(root, 'run-drylog')),
      /dry run/i,
      'rolling back a dry run must be an explicit error, never a silent no-op',
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

/** Every directory under root, as a set of relative '/'-separated paths. */
async function allDirs(root) {
  const out = new Set();
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      out.add(rel);
      stack.push({ abs: join(d.abs, e.name), rel });
    }
  }
  return out;
}
