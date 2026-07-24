// tests/fixtures.test.mjs — specs for the fixture generator.
// [TESTED: 2026-07-24 · runs green via npm test — 5 pass / 0 fail]
//
// The generator is the foundation of the whole harness (AGENT_GUIDE.md "Test harness"), so it is
// itself verified: the tree matches the manifest byte-for-byte, planted duplicates really are
// byte-identical, planted twins really differ, planted EXIF/mvhd dates really are in the bytes,
// and two runs are deterministic. All work happens in per-test temp dirs, removed afterwards.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeFixtureTree, catalog, FIXTURE_VERSION } from './fixtures/make.mjs';

/** Recursively list file paths relative to root, '/'-separated, excluding the manifest itself. */
async function walk(root, prefix = '') {
  const out = [];
  for (const e of await readdir(join(root, ...prefix.split('/').filter(Boolean)), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(root, rel));
    else if (rel !== 'expected.json') out.push(rel);
  }
  return out;
}

async function makeTmpTree() {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-fixture-'));
  const manifest = await makeFixtureTree(dir);
  return { dir, manifest };
}

test('tree matches the manifest exactly (paths, sizes, nothing extra)', async () => {
  const { dir, manifest } = await makeTmpTree();
  try {
    assert.equal(manifest.fixtureVersion, FIXTURE_VERSION);
    const onDisk = (await walk(dir)).sort();
    const declared = manifest.files.map(f => f.path).sort();
    assert.deepEqual(onDisk, declared);
    for (const f of manifest.files) {
      const s = await stat(join(dir, ...f.path.split('/')));
      assert.equal(s.size, f.size, `size mismatch: ${f.path}`);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('planted duplicates are byte-identical; the "+"-twins are not', async () => {
  const { dir, manifest } = await makeTmpTree();
  try {
    const bytes = (p) => readFile(join(dir, ...p.split('/')));
    const dupPaths = manifest.files.filter(f => f.expected.dupGroup === 1).map(f => f.path);
    assert.equal(dupPaths.length, 3);
    const [a, b, c] = await Promise.all(dupPaths.map(bytes));
    assert.ok(a.equals(b) && b.equals(c), 'dup group 1 must be byte-identical');
    const twins = manifest.files.filter(f => f.expected.twin === 'plus-pair').map(f => f.path);
    assert.equal(twins.length, 2);
    const [t1, t2] = await Promise.all(twins.map(bytes));
    assert.ok(!t1.equals(t2), 'plus-twins must differ in content');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('planted EXIF and mvhd dates are really present in the bytes', async () => {
  const { dir } = await makeTmpTree();
  try {
    const exifJpeg = await readFile(join(dir, '2013', 'Лето 2013', 'DSC01529.JPG'));
    assert.ok(exifJpeg.includes(Buffer.from('2013:07:04 10:11:12', 'ascii')), 'EXIF date string missing');
    assert.equal(exifJpeg.readUInt16BE(0), 0xFFD8, 'not a JPEG (SOI missing)');
    const mp4 = await readFile(join(dir, 'видео', 'VID_20161210_100950.mp4'));
    const mvhdAt = mp4.indexOf(Buffer.from('mvhd', 'ascii'));
    assert.ok(mvhdAt > 0, 'mvhd box missing');
    // creation_time = 8 bytes after the box type start ('mvhd' + version/flags), seconds since 1904
    const secs = mp4.readUInt32BE(mvhdAt + 8);
    const iso = new Date((secs - 2082844800) * 1000).toISOString();
    assert.equal(iso, '2016-12-10T10:09:50.000Z');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('generation is deterministic — two trees are byte-for-byte equal', async () => {
  const [a, b] = [await makeTmpTree(), await makeTmpTree()];
  try {
    assert.deepEqual(a.manifest, b.manifest);
    for (const f of a.manifest.files) {
      const [ba, bb] = await Promise.all([
        readFile(join(a.dir, ...f.path.split('/'))), readFile(join(b.dir, ...f.path.split('/')))]);
      assert.ok(ba.equals(bb), `nondeterministic bytes: ${f.path}`);
    }
  } finally {
    await rm(a.dir, { recursive: true, force: true });
    await rm(b.dir, { recursive: true, force: true });
  }
});

test('the case catalog covers the survey chaos classes', () => {
  const kinds = new Set(catalog().map(c => c.expected.kind));
  for (const k of ['photo', 'video', 'audio', 'junk', 'other']) assert.ok(kinds.has(k), `no ${k} case`);
  const evidences = new Set(catalog().map(c => c.expected.evidence));
  for (const e of ['exif', 'filename', 'filename-epoch', 'dirname', 'dir-cohort', 'exif-implausible', 'none'])
    assert.ok(evidences.has(e), `no ${e} evidence case`);
});
