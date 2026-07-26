// src/core/scan_cache.mjs — the persistent scan cache: don't re-hash what hasn't changed.
// [TESTED: 2026-07-26 · tests/scan_cache.test.mjs — a cached scan is field-for-field the same scan;
// invalidation checked from three angles (changed content, a same-size edit, a backdated mtime);
// corruption/version/torn-tail degrade to a full scan; re-keying survives a sort. The invalidation
// and determinism guards were verified by breaking them · plus a live run showing 26/26 reused]
//
// WHY (prescribed by the recon doc, not invented): `researches/02_real_archive_survey.md`
// §"Implications for KPOT design" item 4 — «hashing 551 GB is hours, not seconds — the scan phase
// needs a persistent cache keyed by (path, size, mtime)». The owner's archive is 71 606 files /
// 551 GB, of which 372 GB is video; a streamed SHA-256 of all of it is the single most expensive
// thing KPOT does, and every repeated run pays it again: read the plan → re-run, dry run → real run,
// rollback → retry. Those repeats are the normal way the tool is used, so the cache is not an
// optimisation but the difference between a usable tool and one the owner runs once.
//
// KEY = (path, size, mtimeMs). A hit reuses `kind`, `format` and `sha256`; a miss costs exactly what
// the scan cost before. The key is deliberately conservative:
//   · path is part of the key, so a MOVED file is a miss rather than a guess. Keying on
//     (size, mtime) alone would survive moves, but two distinct files can share both — and a wrong
//     sha256 is not a slow scan, it is dedupe declaring two different photos identical and setting
//     one aside as a copy. Safety outranks tidiness (MASTER_PLAN §Guiding principles).
//   · mtimeMs is compared exactly. Measured on the target volume 2026-07-26: it is stable across
//     stats and carries no sub-millisecond fraction, so exact comparison neither drifts nor
//     false-hits. A mismatch is always safe — it only means "hash it again".
//
// LAYERING: this lives in `src/core/` beside `journal.mjs`, which writes KPOT's own files for the
// same reason — `src/scan/` must be able to READ the cache, and RULE 2 forbids scan from importing
// anything above it. Writing is done by the caller (the CLI), never by `scanTree`, so the scan phase
// itself stays read-only over the filesystem (RULE 1).
//
// ROBUSTNESS: a damaged cache must never break a scan. An unreadable file, a wrong version, a
// missing header or a torn/garbled line all degrade to "fewer hits", never to an error and never to
// a wrong hash.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { RUNS_DIR_NAME } from './paths.mjs';

/** Cache format version — bump on any change to the entry shape; older files are then ignored. */
export const CACHE_VERSION = 1;

/** The cache file's name inside the runs directory. It is shared by every run, not per-run. */
export const CACHE_NAME = 'scan-cache.jsonl';

/** Full path of a tree's scan cache. */
export const scanCachePathFor = (root) => join(root, RUNS_DIR_NAME, CACHE_NAME);

/**
 * Load a tree's scan cache.
 *
 * Never throws: a missing, unreadable, outdated or corrupted cache yields an empty one. The caller
 * cannot tell the difference and does not need to — the only consequence is that every file is
 * hashed, which is exactly what happened before this module existed.
 *
 * @param {string} root  absolute path of the scanned tree
 * @returns {Promise<{entries: Map<string, {size: number, mtimeMs: number, kind: string, format: string|null, sha256: string}>, path: string, loaded: number, skipped: number}>}
 */
export async function loadScanCache(root) {
  const path = scanCachePathFor(root);
  const empty = { entries: new Map(), path, loaded: 0, skipped: 0 };
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return empty;   // no cache yet — the normal first-run case
  }

  const lines = raw.split('\n').filter((l) => l !== '');
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    return empty;
  }
  // A cache written by a different version may have a different entry shape. Reusing it could yield
  // a wrong hash, so it is discarded wholesale rather than interpreted optimistically.
  if (header?.kind !== 'scan-cache-header' || header.cacheVersion !== CACHE_VERSION) return empty;

  const entries = new Map();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      skipped += 1;      // torn tail after a crash, or a garbled line — a miss, never a failure
      continue;
    }
    // A partial entry is worse than none: it could satisfy a lookup while missing the hash.
    if (typeof e?.path !== 'string' || typeof e.size !== 'number'
      || typeof e.mtimeMs !== 'number' || typeof e.sha256 !== 'string') {
      skipped += 1;
      continue;
    }
    entries.set(e.path, { size: e.size, mtimeMs: e.mtimeMs, kind: e.kind, format: e.format ?? null, sha256: e.sha256 });
  }
  return { entries, path, loaded: entries.size, skipped };
}

/**
 * Look one file up. Returns the cached identity only if the file is provably the same one —
 * same path, same size, same mtime.
 *
 * @param {Map} entries        from loadScanCache
 * @param {string} relPath     '/'-separated path relative to the root
 * @param {{size: number, mtimeMs: number}} stat
 * @returns {{kind: string, format: string|null, sha256: string}|null}
 */
export function cacheLookup(entries, relPath, stat) {
  const e = entries.get(relPath);
  if (!e) return null;
  if (e.size !== stat.size || e.mtimeMs !== stat.mtimeMs) return null;
  return { kind: e.kind, format: e.format, sha256: e.sha256 };
}

/**
 * Write the cache for a tree from a completed scan's assets.
 *
 * Deterministic by construction (AGENT_GUIDE §Code style — "canonical order for everything compared
 * or cached"): entries are sorted by path and each line's keys are written in a fixed order, so two
 * scans of the same tree produce a byte-identical file. That makes the cache diffable and keeps it
 * out of the class of artifacts that quietly differ between runs.
 *
 * @param {string} root
 * @param {Array<{path: string, size: number, mtimeMs: number, kind: string, format: string|null, sha256: string}>} assets
 * @returns {Promise<{path: string, written: number}>}
 */
export async function saveScanCache(root, assets) {
  const path = scanCachePathFor(root);
  await mkdir(dirname(path), { recursive: true });

  const usable = assets.filter((a) => typeof a.sha256 === 'string' && a.sha256 !== '');
  const sorted = [...usable].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const lines = [
    JSON.stringify({ kind: 'scan-cache-header', cacheVersion: CACHE_VERSION, files: sorted.length }),
    ...sorted.map((a) => JSON.stringify({
      path: a.path, size: a.size, mtimeMs: a.mtimeMs, kind: a.kind, format: a.format ?? null, sha256: a.sha256,
    })),
  ];
  await writeFile(path, lines.join('\n') + '\n', 'utf8');
  return { path, written: sorted.length };
}

/**
 * Re-key the cache after a run moved files.
 *
 * Without this, the first scan AFTER a sort is a 100% miss — every file is at a new path — and the
 * owner pays the full 551 GB hash again for a tree whose contents did not change by one byte. A
 * rename provably preserves content, so carrying the entry across is not a guess; the size and
 * mtime in the entry still guard it, and anything that does not match is simply re-hashed.
 *
 * @param {string} root
 * @param {Array<{from: string, to: string}>} moves  the run journal's 'moved' records
 * @returns {Promise<{path: string, rekeyed: number, written: number}>}
 */
export async function rekeyScanCache(root, moves) {
  const { entries } = await loadScanCache(root);
  let rekeyed = 0;
  for (const m of moves) {
    const e = entries.get(m.from);
    if (!e) continue;
    entries.delete(m.from);
    entries.set(m.to, e);
    rekeyed += 1;
  }
  const assets = [...entries].map(([path, e]) => ({ path, ...e }));
  const { written } = await saveScanCache(root, assets);
  return { path: scanCachePathFor(root), rekeyed, written };
}
