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
import { RECEIPT_NAME } from '../core/receipt.mjs';
import { cacheLookup } from '../core/scan_cache.mjs';
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
 * Recursively list all files AND directories under `root`. Directory read failures are collected,
 * not thrown.
 *
 * Directories are returned because they are part of what must be restorable: since 2026-07-26 the
 * owner allows KPOT to delete folders its sort emptied, and a folder can only be recreated by
 * rollback if the backup recorded that it existed (owner's condition, decision log).
 *
 * @returns {Promise<{files: Array<{abs: string, rel: string}>, dirs: string[], errors: Array<{path: string, error: string}>}>}
 */
async function walk(root) {
  const files = [], errors = [], seenDirs = [];
  const dirs = [{ abs: root, rel: '' }];
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir.rel !== '') seenDirs.push(dir.rel);
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
      // KPOT's own receipt (`src/core/receipt.mjs`) is a document ABOUT the archive, not a file of
      // the owner's. Left in the walk it would appear in his plan under «остаётся на месте» — the
      // tool listing its own paperwork among his photographs.
      if (entry.isFile() && entry.name === RECEIPT_NAME) continue;
      // rel uses '/' — stable across platforms for reports, journals and tests
      const rel = dir.rel === '' ? entry.name : `${dir.rel}/${entry.name}`;
      const abs = join(dir.abs, entry.name);
      if (entry.isDirectory()) dirs.push({ abs, rel });
      else if (entry.isFile()) files.push({ abs, rel });
      // symlinks/junctions are deliberately NOT followed: a planning tool that follows links
      // can be tricked into planning moves outside the target tree
    }
  }
  seenDirs.sort();   // canonical order — the manifest and the plan are compared artifacts
  return { files, dirs: seenDirs, errors };
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
 * With a `cache` (from `src/core/scan_cache.mjs`) a file whose path, size and mtime all match a
 * cached entry reuses its kind/format/sha256 and is neither opened nor read. This is what makes a
 * repeated run on the real 551 GB archive take seconds instead of hours (`researches/02` §4). The
 * OUTPUT is identical either way — a cache hit must be indistinguishable from a fresh hash, which
 * is asserted by spec; if it ever were not, the cache would be corrupting the scan.
 *
 * Reading only: `scanTree` never writes the cache. The caller decides when to persist it, so the
 * scan phase stays read-only over the filesystem (RULE 1).
 *
 * @param {string} root  directory to scan (must exist; caller validates)
 * @param {{concurrency?: number, cache?: Map, progress?: object}} [opts]
 *        `progress` — an optional reporter from `src/core/progress.mjs`. It is called, never read:
 *        nothing about the scan's RESULT depends on it, so a run with and without progress produces
 *        byte-identical output.
 * @returns {Promise<{root: string, scannedAt: string, assets: object[], cache: {hits: number, misses: number},
 *                    errors: Array<{path: string, error: string}>}>}
 *          assets sorted by rel path: { path, size, mtimeMs, kind, format, sha256 }
 */
export async function scanTree(root, {
  concurrency = DEFAULT_CONCURRENCY, cache = null, progress = null,
} = {}) {
  const scannedAt = new Date().toISOString();
  progress?.start('Осматриваю папки');
  const { files, dirs, errors } = await walk(root);
  let hits = 0, misses = 0;

  // The total is known only after the walk, which is why the reporter starts twice: the first phase
  // has no denominator (we do not know how many files there are until we have found them all).
  progress?.start('Читаю файлы', files.length);

  const results = await mapLimit(files, concurrency, async (f) => {
    const s = await stat(f.abs);
    // The stat above is unavoidable (it IS the cache key), so a hit costs one stat and saves the
    // sniff plus the full streamed read — on video files, effectively the entire cost of the scan.
    const cached = cache ? cacheLookup(cache, f.rel, s) : null;
    if (cached) {
      hits += 1;
      progress?.tick(0);   // a cache hit reads no bytes — counting them would overstate the work
      return { path: f.rel, size: s.size, mtimeMs: s.mtimeMs, ...cached };
    }
    misses += 1;
    const head = await sniff(f.abs);
    const { kind, format } = identify(f.rel.split('/').at(-1), head);
    const asset = {
      path: f.rel,
      size: s.size,
      mtimeMs: s.mtimeMs,
      kind,
      format,
      sha256: await hashFile(f.abs),
    };
    progress?.tick(s.size);
    return asset;
  });

  const assets = [];
  for (const [i, r] of results.entries()) {
    if (r.ok) assets.push(r.value);
    else errors.push({ path: files[i].abs, error: r.error?.message ?? String(r.error) });
  }
  assets.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { root, scannedAt, assets, dirs, cache: { hits, misses }, errors };
}
