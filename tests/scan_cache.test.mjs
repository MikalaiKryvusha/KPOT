// tests/scan_cache.test.mjs — the persistent scan cache (Phase 5).
//
// The cache exists because `researches/02` §4 measured the problem: 71 606 files / 551 GB, and
// hashing that is hours. But a cache is a correctness risk before it is a speed win — every bug in
// it shows up as a WRONG sha256, and a wrong sha256 makes dedupe declare two different photos
// identical and shelve one as a copy. So the specs below are weighted accordingly: one proves the
// speed-up exists at all, and the rest prove the cache can never change what the scan reports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { scanTree } from '../src/scan/scan.mjs';
import {
  loadScanCache, saveScanCache, rekeyScanCache, cacheLookup,
  scanCachePathFor, CACHE_VERSION,
} from '../src/core/scan_cache.mjs';

const execFileP = promisify(execFile);
const MAKE = fileURLToPath(new URL('./fixtures/make.mjs', import.meta.url));

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-cache-'));
  await execFileP(process.execPath, [MAKE, dir]);
  return dir;
}

/** The comparable part of a scan: what every downstream phase actually consumes. */
const identity = (scan) => scan.assets.map((a) => [a.path, a.size, a.mtimeMs, a.kind, a.format, a.sha256]);

// ─── the guarantee that matters ──────────────────────────────────────────────────────────────────
test('a cached scan is byte-for-byte the same scan — the cache cannot change what is reported', async () => {
  const root = await fixture();
  try {
    const cold = await scanTree(root);
    assert.equal(cold.cache.hits, 0, 'the first scan has nothing to reuse');
    assert.ok(cold.cache.misses > 0);

    await saveScanCache(root, cold.assets);
    const { entries } = await loadScanCache(root);
    const warm = await scanTree(root, { cache: entries });

    assert.deepEqual(identity(warm), identity(cold),
      'a cache hit must be indistinguishable from a fresh hash, field for field');
    assert.equal(warm.cache.hits, cold.assets.length, 'every unchanged file must be reused');
    assert.equal(warm.cache.misses, 0);
    // Key order matters too: `kpot scan --json` is a compared artifact (AGENT_GUIDE §Code style).
    assert.equal(JSON.stringify(warm.assets), JSON.stringify(cold.assets));
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── invalidation: the cache must never serve a stale hash ───────────────────────────────────────
test('a changed file is re-hashed: content, size and mtime each invalidate the entry', async () => {
  const root = await fixture();
  try {
    const cold = await scanTree(root);
    await saveScanCache(root, cold.assets);

    // Change content (and therefore size) of one file.
    const victim = 'доки/заметка.txt';
    await appendFile(join(root, ...victim.split('/')), 'CHANGED', 'utf8');

    const { entries } = await loadScanCache(root);
    const warm = await scanTree(root, { cache: entries });

    const before = cold.assets.find((a) => a.path === victim);
    const after = warm.assets.find((a) => a.path === victim);
    assert.notEqual(after.sha256, before.sha256, 'the modified file must NOT keep its cached hash');
    assert.equal(warm.cache.hits, cold.assets.length - 1, 'only the modified file misses');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a same-size edit is caught by mtime alone — the hash is not trusted on a touch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-cache-mtime-'));
  try {
    const file = join(root, 'a.txt');
    await writeFile(file, 'AAAA', 'utf8');
    const cold = await scanTree(root);
    await saveScanCache(root, cold.assets);

    // Same length, different bytes: only mtime can reveal this. (Content-length collisions are the
    // realistic hazard — an edited photo often keeps its size.)
    await writeFile(file, 'BBBB', 'utf8');
    const s = await stat(file);
    assert.equal(s.size, cold.assets[0].size, 'the test is only meaningful if the size is unchanged');

    const { entries } = await loadScanCache(root);
    const warm = await scanTree(root, { cache: entries });
    assert.notEqual(warm.assets[0].sha256, cold.assets[0].sha256);
    assert.equal(warm.cache.hits, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a file restored to an older mtime is not trusted either (backdating must not fool the key)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-cache-back-'));
  try {
    const file = join(root, 'a.txt');
    await writeFile(file, 'AAAA', 'utf8');
    const cold = await scanTree(root);
    await saveScanCache(root, cold.assets);

    await writeFile(file, 'ZZZZ', 'utf8');
    const old = new Date(cold.assets[0].mtimeMs - 60_000);
    await utimes(file, old, old);           // backdated: neither size nor "newer" would notice

    const { entries } = await loadScanCache(root);
    const warm = await scanTree(root, { cache: entries });
    assert.equal(warm.cache.hits, 0, 'an mtime that differs in EITHER direction is a miss');
    assert.notEqual(warm.assets[0].sha256, cold.assets[0].sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── robustness: a damaged cache degrades to slow, never to wrong ────────────────────────────────
test('a corrupt, truncated or outdated cache degrades to a full scan instead of failing', async () => {
  const root = await fixture();
  try {
    const cold = await scanTree(root);
    await saveScanCache(root, cold.assets);
    const cachePath = scanCachePathFor(root);
    const good = await readFile(cachePath, 'utf8');

    // 1. torn tail (the classic crash artifact) — everything before it still counts
    await writeFile(cachePath, good.slice(0, Math.floor(good.length * 0.6)), 'utf8');
    const torn = await loadScanCache(root);
    assert.ok(torn.entries.size > 0 && torn.entries.size < cold.assets.length);
    const afterTorn = await scanTree(root, { cache: torn.entries });
    assert.deepEqual(identity(afterTorn), identity(cold), 'a torn cache must not corrupt the scan');

    // 2. outright garbage
    await writeFile(cachePath, 'this is not json at all\n{{{\n', 'utf8');
    const garbage = await loadScanCache(root);
    assert.equal(garbage.entries.size, 0);
    assert.deepEqual(identity(await scanTree(root, { cache: garbage.entries })), identity(cold));

    // 3. a future version — discarded wholesale, because its entry shape is unknown
    const future = good.replace(`"cacheVersion":${CACHE_VERSION}`, `"cacheVersion":${CACHE_VERSION + 1}`);
    await writeFile(cachePath, future, 'utf8');
    assert.equal((await loadScanCache(root)).entries.size, 0, 'a newer cache format must be ignored, not parsed');

    // 4. an entry missing its hash must never satisfy a lookup
    await writeFile(cachePath,
      JSON.stringify({ kind: 'scan-cache-header', cacheVersion: CACHE_VERSION, files: 1 }) + '\n'
      + JSON.stringify({ path: 'доки/заметка.txt', size: 1, mtimeMs: 1 }) + '\n', 'utf8');
    const partial = await loadScanCache(root);
    assert.equal(partial.entries.size, 0);
    assert.equal(partial.skipped, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a missing cache is the normal first run, not an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kpot-cache-none-'));
  try {
    const c = await loadScanCache(root);
    assert.equal(c.entries.size, 0);
    assert.equal(cacheLookup(c.entries, 'anything', { size: 1, mtimeMs: 1 }), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── determinism (AGENT_GUIDE §Code style: anything cached must have a canonical order) ──────────
test('the cache file is deterministic — two scans of one tree write identical bytes', async () => {
  const root = await fixture();
  try {
    const a = await scanTree(root);
    await saveScanCache(root, a.assets);
    const first = await readFile(scanCachePathFor(root), 'utf8');

    // Same assets in a different order must still serialize identically.
    await saveScanCache(root, [...a.assets].reverse());
    const second = await readFile(scanCachePathFor(root), 'utf8');
    assert.equal(second, first, 'the cache must not depend on the order it was handed');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── re-keying after a sort ──────────────────────────────────────────────────────────────────────
test('re-keying after a run keeps the cache useful — a rename is not a reason to re-hash', async () => {
  const root = await fixture();
  try {
    const cold = await scanTree(root);
    await saveScanCache(root, cold.assets);

    // Simulate what a run does: rename a file, then carry its cache entry across.
    const from = 'доки/заметка.txt';
    const to = 'доки/переименовано.txt';
    const { rename } = await import('node:fs/promises');
    await rename(join(root, ...from.split('/')), join(root, ...to.split('/')));

    const withoutRekey = await scanTree(root, { cache: (await loadScanCache(root)).entries });
    assert.equal(withoutRekey.cache.misses, 1, 'without re-keying the moved file is re-hashed');

    await rekeyScanCache(root, [{ from, to }]);
    const afterRekey = await scanTree(root, { cache: (await loadScanCache(root)).entries });
    assert.equal(afterRekey.cache.misses, 0, 'after re-keying nothing needs re-hashing');
    assert.equal(
      afterRekey.assets.find((a) => a.path === to).sha256,
      cold.assets.find((a) => a.path === from).sha256,
      'the carried-over hash must be the file\'s real hash',
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

// ─── the read-only promise, restated precisely ───────────────────────────────────────────────────
// Before the cache, "plan writes nothing" was literally true. Now KPOT persists its own scan cache,
// so the promise needs an exact boundary rather than a comfortable wording — and a spec that holds
// it: no USER file is created, changed or moved by a plan, and the ONLY thing that ever appears in
// the tree is KPOT's own .kpot-runs/ directory.
test('plan creates nothing in the tree except KPOT\'s own .kpot-runs/ directory', async () => {
  const root = await fixture();
  try {
    const before = await treeCensus(root);
    const KPOT = fileURLToPath(new URL('../bin/kpot.mjs', import.meta.url));
    await execFileP(process.execPath, [KPOT, 'plan', root], { maxBuffer: 64 * 1024 * 1024 });
    const after = await treeCensus(root);

    const added = [...after.keys()].filter((p) => !before.has(p));
    const removed = [...before.keys()].filter((p) => !after.has(p));
    const changed = [...before].filter(([p, h]) => after.has(p) && after.get(p) !== h).map(([p]) => p);

    assert.deepEqual(removed, [], 'a plan must never remove anything');
    assert.deepEqual(changed, [], 'a plan must never modify a single byte of a user file');
    assert.ok(added.length > 0, 'the cache should have been written — otherwise this proves nothing');
    const outsideOwnDir = added.filter((p) => !p.startsWith('.kpot-runs/'));
    assert.deepEqual(outsideOwnDir, [],
      `plan created files outside its own directory: ${outsideOwnDir.join(', ')}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});

/** Every file under root (INCLUDING .kpot-runs, unlike scanTree): relative path → sha256. */
async function treeCensus(root) {
  const { readdir } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const out = new Map();
  const stack = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const e of await readdir(d.abs, { withFileTypes: true })) {
      const rel = d.rel === '' ? e.name : `${d.rel}/${e.name}`;
      const abs = join(d.abs, e.name);
      if (e.isDirectory()) stack.push({ abs, rel });
      else if (e.isFile()) out.set(rel, createHash('sha256').update(await readFile(abs)).digest('hex'));
    }
  }
  return out;
}

test('re-keying never invents an entry for a file it did not have', async () => {
  const root = await fixture();
  try {
    const cold = await scanTree(root);
    await saveScanCache(root, cold.assets);
    const before = (await loadScanCache(root)).entries.size;
    const result = await rekeyScanCache(root, [{ from: 'nowhere/ghost.jpg', to: 'somewhere/ghost.jpg' }]);
    assert.equal(result.rekeyed, 0);
    assert.equal((await loadScanCache(root)).entries.size, before, 'the cache must be unchanged');
  } finally { await rm(root, { recursive: true, force: true }); }
});
