// src/apply/backup.mjs — the Backup: the owner's undo button, created BEFORE anything moves.
// [TESTED: 2026-07-26 · tests/apply_phase4.test.mjs — snapshot inode equality per file, manifest
// round-trip, verifyBackup's three refusal cases, and the no-hardlink refusal exercised through an
// injected probe. The refusal guard was verified by DELETING it and watching the spec go red]
//
// GOAL.md §б) demands «коммит-бекап, к которому можно откатить исходную директорию пользователя».
// Interview #002 (owner's answer Б, 2026-07-26) decided WHAT that is, with measured numbers rather
// than estimates — a git backup would need ~551 GB on a volume with 197.8 GB free, so it does not
// physically fit. The decided mechanism has two layers, and `apply` refuses to write unless BOTH
// exist for the run (internal map, invariant 1):
//
//   1. MANIFEST — one JSONL line per file in the tree: original relative path, size, mtime, sha256.
//      This is what rollback restores STRUCTURE from. ~18 MB for the real archive. It is the
//      primary mechanism, because moves are renames (decision log 2026-07-24) and a rename is
//      undone by another rename — no data ever needs copying.
//
//   2. HARDLINK SNAPSHOT — a shadow tree where every file is a second directory entry pointing at
//      the SAME data. This is what protects CONTENT: the bytes survive even if the original entry
//      is deleted by a crash, another program, or the owner. Measured 2026-07-26: 0.401 ms/link →
//      ~29 s and ~0 bytes for all 71 606 files, and a hardlink provably survives a rename of the
//      original (same inode, nlink=2).
//
// Honest limits, recorded rather than hidden (they are in the decision log too):
//   · hardlinks work only WITHIN one volume and only on filesystems that support them — exFAT/FAT32
//     (typical on external USB drives) cannot. We do not guess from the filesystem's name: we TRY
//     to make a link and observe. If it fails, backup reports `snapshot: 'unsupported'` and `apply`
//     stops unless the owner passes an explicit override.
//   · a snapshot on the same physical disk does NOT survive disk failure. It defends against
//     software and human error, not against hardware death.
//
// RULE 1: this module lives under src/apply/, the only writer — but note it writes ONLY into its own
// run directory. It never modifies, renames or deletes a file of the user's archive.

import { link, mkdir, readdir, stat, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mapLimit } from '../core/pool.mjs';
import { RUNS_DIR_NAME } from '../core/paths.mjs';

/** Manifest format version — bump on any breaking change to the line shape. */
export const MANIFEST_VERSION = 1;

/** File names inside a run directory. */
export const MANIFEST_NAME = 'manifest.jsonl';
export const SNAPSHOT_NAME = 'snapshot';

/** Bounded concurrency for link creation — same rationale as the scan pool (file-handle limits). */
const LINK_CONCURRENCY = 8;

/**
 * Where a run's data lives. Deliberately INSIDE the scanned root: a hardlink cannot cross a volume,
 * and putting the run dir in the tree it backs up guarantees "same volume" without asking the user
 * to configure anything. `scanTree` skips this directory, so KPOT never sorts its own backup.
 *
 * @param {string} root  absolute path of the scanned tree
 * @param {string} runId
 * @returns {string}
 */
export function runDirFor(root, runId) {
  return join(root, RUNS_DIR_NAME, runId);
}

/**
 * Can this location hold hardlinks? Observed, not inferred from the filesystem's name: we create a
 * real file, link it, and check the link points at the same data (same inode). Everything is
 * removed afterwards. PHILOSOPHY.md → observation over conjecture.
 *
 * @param {string} dir  an existing directory to probe in (the run directory)
 * @returns {Promise<{supported: boolean, reason: string|null}>}
 */
export async function probeHardlinkSupport(dir) {
  const src = join(dir, '.kpot-linkprobe');
  const dst = join(dir, '.kpot-linkprobe-link');
  try {
    await writeFile(src, 'probe', 'utf8');
    await link(src, dst);
    const [a, b] = [await stat(src), await stat(dst)];
    // ino equality is the real proof; nlink is the corroborating signal
    if (a.ino !== b.ino || b.nlink < 2) {
      return { supported: false, reason: 'the filesystem created a copy, not a link' };
    }
    return { supported: true, reason: null };
  } catch (e) {
    return { supported: false, reason: e.code ? `${e.code}: ${e.message}` : e.message };
  } finally {
    await rm(src, { force: true });
    await rm(dst, { force: true });
  }
}

/**
 * Create the backup for a run.
 *
 * @param {string} root   absolute path of the scanned tree
 * @param {object} scan   the scan result (assets carry path/size/mtimeMs/sha256)
 * @param {{runId: string, dryRun?: boolean, allowNoSnapshot?: boolean, probeSupport?: Function}} opts
 *        `dryRun` — build and verify NOTHING on disk except the run directory itself; the returned
 *        shape is identical so the caller's code path does not fork (GOAL.md §в equivalence).
 *        `allowNoSnapshot` — the owner's explicit override when the filesystem cannot hardlink.
 *        `probeSupport` — the hardlink capability probe. Injectable for ONE reason: the refusal path
 *        exists for exFAT/FAT32, and a development machine with an NTFS disk cannot otherwise reach
 *        it. A guard that can never be exercised is a guard nobody has verified
 *        (TESTING_FRAMEWORK §"a check that has never failed proves nothing").
 * @returns {Promise<{runId, dir, manifestPath, snapshotDir, files, linked, snapshot, reason, errors}>}
 * @throws {Error} if the snapshot is impossible and the override was not given — refusing loudly is
 *         the whole point: a backup that silently degrades is worse than no backup, because the
 *         owner would trust it.
 */
export async function createBackup(root, scan, {
  runId, dryRun = false, allowNoSnapshot = false, probeSupport = probeHardlinkSupport,
} = {}) {
  const dir = runDirFor(root, runId);
  const manifestPath = join(dir, MANIFEST_NAME);
  const snapshotDir = join(dir, SNAPSHOT_NAME);
  await mkdir(dir, { recursive: true });

  // --- layer 0: can we snapshot at all? Observe before promising anything.
  const probe = await probeSupport(dir);
  if (!probe.supported && !allowNoSnapshot) {
    throw new Error(
      `cannot create a hardlink snapshot here (${probe.reason}). `
      + 'The filesystem does not support hardlinks (exFAT/FAT32 cannot). '
      + 'Re-run with --allow-no-snapshot to proceed with the manifest alone — '
      + 'structure would still be restorable, file CONTENT would not be protected.',
    );
  }

  // --- layer 1: the manifest. Sorted by path (assets already are) so two runs of the same tree
  // produce a byte-identical manifest — the determinism rule in AGENT_GUIDE §Code style.
  const lines = [
    JSON.stringify({ kind: 'manifest-header', manifestVersion: MANIFEST_VERSION, runId, root, files: scan.assets.length }),
    ...scan.assets.map((a) => JSON.stringify({
      path: a.path, size: a.size, mtimeMs: a.mtimeMs, sha256: a.sha256,
    })),
  ];
  if (!dryRun) await writeFile(manifestPath, lines.join('\n') + '\n', 'utf8');

  // --- layer 2: the hardlink snapshot. Every file in the tree, not just the ones that move: the
  // guarantee the owner was sold is "the source directory can be restored", and a file that stays
  // put can still be damaged by something else. Cost is ~0, so subsetting would buy nothing.
  const errors = [];
  let linked = 0;
  if (!dryRun && probe.supported) {
    // Directories first (sequentially, deduplicated): mkdir -p per file would be N redundant calls.
    const dirs = new Set();
    for (const a of scan.assets) {
      const rel = dirname(a.path);
      if (rel !== '.') dirs.add(rel);
    }
    await mkdir(snapshotDir, { recursive: true });
    for (const d of [...dirs].sort()) await mkdir(join(snapshotDir, d), { recursive: true });

    const results = await mapLimit(scan.assets, LINK_CONCURRENCY, async (a) => {
      const from = join(root, ...a.path.split('/'));
      const to = join(snapshotDir, ...a.path.split('/'));
      await link(from, to);
      // Verify by observation, per file: a link that is secretly a copy is not a backup.
      const [s1, s2] = [await stat(from), await stat(to)];
      if (s1.ino !== s2.ino) throw new Error('snapshot entry is not the same inode as the original');
      return true;
    });
    for (const [i, r] of results.entries()) {
      if (r.ok) linked += 1;
      else errors.push({ path: scan.assets[i].path, error: r.error?.message ?? String(r.error) });
    }
  }

  return {
    runId,
    dir,
    manifestPath,
    snapshotDir,
    files: scan.assets.length,
    linked,
    snapshot: dryRun ? 'skipped-dry-run' : probe.supported ? 'hardlink' : 'unsupported',
    reason: probe.reason,
    errors,
  };
}

/**
 * Does a usable backup exist for this run? `apply` calls this before its first write and refuses if
 * the answer is no (internal map, invariant 1: "No write without a Backup").
 *
 * Checks existence and non-emptiness of the manifest — not just that the directory is there, because
 * an aborted backup leaves a directory behind and a directory is not a backup.
 *
 * @param {string} root
 * @param {string} runId
 * @returns {Promise<{ok: boolean, reason: string|null, manifestPath: string, snapshotDir: string, hasSnapshot: boolean}>}
 */
export async function verifyBackup(root, runId) {
  const dir = runDirFor(root, runId);
  const manifestPath = join(dir, MANIFEST_NAME);
  const snapshotDir = join(dir, SNAPSHOT_NAME);
  let hasSnapshot = false;
  try {
    const s = await stat(manifestPath);
    if (!s.isFile() || s.size === 0) {
      return { ok: false, reason: 'the backup manifest is empty', manifestPath, snapshotDir, hasSnapshot };
    }
  } catch {
    return { ok: false, reason: 'no backup manifest for this run', manifestPath, snapshotDir, hasSnapshot };
  }
  try {
    hasSnapshot = (await readdir(snapshotDir)).length > 0;
  } catch { /* absent snapshot is reported, not thrown — the caller decides if it is fatal */ }
  return { ok: true, reason: null, manifestPath, snapshotDir, hasSnapshot };
}
