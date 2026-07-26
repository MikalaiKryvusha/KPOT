// src/scan/scan.mjs — the scan phase: walk a tree, identify every file by content, hash it.
// [TESTED: 2026-07-24 · tests/scan.test.mjs (ground-truth kinds, dup hashes, read-only proof) +
// real CLI smoke run on a generated tree — exit 0, 23/23 classified; suite 48/48]
//
// STRICTLY READ-ONLY over the user's data (AGENT_GUIDE.md RULE 1) — this module opens files for
// reading and never creates, renames or writes anything. Its output is the Asset list the whole
// downstream pipeline (meta → dedupe → plan) consumes.
//
// Error policy (AGENT_GUIDE code style): one unreadable file or directory never aborts the scan —
// each failure is recorded with its path in `errors` and the walk continues. Concurrency is
// bounded by src/core/pool.mjs; hashing streams file bytes (a 4 GB video is never in memory).

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { mapLimit } from '../core/pool.mjs';
import { RUNS_DIR_NAME } from '../core/paths.mjs';
import { identify, SNIFF_LENGTH } from './identify.mjs';

/** Default bounded concurrency for per-file work (open/sniff/hash). */
export const DEFAULT_CONCURRENCY = 8;

/** Streamed SHA-256 of one file (hex). Exact-duplicate identity — content, never name (RULE 9). */
export async function hashFile(absPath) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(absPath), hash);
  return hash.digest('hex');
}

/**
 * Recursively list all files under `root`. Directory read failures are collected, not thrown.
 * @returns {Promise<{files: Array<{abs: string, rel: string}>, errors: Array<{path: string, error: string}>}>}
 */
async function walk(root) {
  const files = [], errors = [];
  const dirs = [{ abs: root, rel: '' }];
  while (dirs.length > 0) {
    const dir = dirs.pop();
    let entries;
    try {
      entries = await readdir(dir.abs, { withFileTypes: true });
    } catch (e) {
      errors.push({ path: dir.abs, error: e.message });
      continue;
    }
    for (const entry of entries) {
      // KPOT's own run data (journals, backup manifests, the hardlink snapshot) is not the user's
      // archive: scanning it would make the tool plan moves for its own backup — and, because the
      // snapshot is hardlinks to the very files being sorted, every file would appear as its own
      // duplicate. Skipped at the walk, so no downstream phase can ever see it.
      if (entry.isDirectory() && entry.name === RUNS_DIR_NAME) continue;
      // rel uses '/' — stable across platforms for reports, journals and tests
      const rel = dir.rel === '' ? entry.name : `${dir.rel}/${entry.name}`;
      const abs = join(dir.abs, entry.name);
      if (entry.isDirectory()) dirs.push({ abs, rel });
      else if (entry.isFile()) files.push({ abs, rel });
      // symlinks/junctions are deliberately NOT followed: a planning tool that follows links
      // can be tricked into planning moves outside the target tree
    }
  }
  return { files, errors };
}

/** Read the first SNIFF_LENGTH bytes of a file without loading the rest. */
async function sniff(absPath) {
  const fh = await open(absPath, 'r');
  try {
    const buf = Buffer.alloc(SNIFF_LENGTH);
    const { bytesRead } = await fh.read(buf, 0, SNIFF_LENGTH, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/**
 * Scan a tree: every file becomes an Asset — identity (path, size, mtime), kind by content
 * (magic bytes), and a streamed content hash.
 *
 * @param {string} root  directory to scan (must exist; caller validates)
 * @param {{concurrency?: number}} [opts]
 * @returns {Promise<{root: string, scannedAt: string, assets: object[],
 *                    errors: Array<{path: string, error: string}>}>}
 *          assets sorted by rel path: { path, size, mtimeMs, kind, format, sha256 }
 */
export async function scanTree(root, { concurrency = DEFAULT_CONCURRENCY } = {}) {
  const scannedAt = new Date().toISOString();
  const { files, errors } = await walk(root);

  const results = await mapLimit(files, concurrency, async (f) => {
    const [s, head] = [await stat(f.abs), await sniff(f.abs)];
    const { kind, format } = identify(f.rel.split('/').at(-1), head);
    return {
      path: f.rel,
      size: s.size,
      mtimeMs: s.mtimeMs,
      kind,
      format,
      sha256: await hashFile(f.abs),
    };
  });

  const assets = [];
  for (const [i, r] of results.entries()) {
    if (r.ok) assets.push(r.value);
    else errors.push({ path: files[i].abs, error: r.error?.message ?? String(r.error) });
  }
  assets.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { root, scannedAt, assets, errors };
}
