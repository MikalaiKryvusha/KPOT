// tests/scan.test.mjs — specs for the scan phase (identify + walk + hash).
// [TESTED: 2026-07-24 · runs green via npm test — suite 48/48]
// Ground truth is the fixture tree's manifest: every planted file has a known kind and size, the
// duplicate group is known byte-identical, the "+"-twins are known different. Fixture trees are
// generated into per-test OS temp dirs and removed after.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identify, isJunkName } from '../src/scan/identify.mjs';
import { scanTree } from '../src/scan/scan.mjs';
import { makeFixtureTree, makeJpeg, makeMp4, makePng, makeOgg } from './fixtures/make.mjs';

/** Generate a fixture tree in a fresh temp dir, run `fn`, always clean up. */
async function withFixtureTree(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-scan-'));
  try {
    const manifest = await makeFixtureTree(dir);
    return await fn(dir, manifest);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('every planted file is found and classified to its ground-truth kind', () =>
  withFixtureTree(async (dir, manifest) => {
    const { assets, errors } = await scanTree(dir);
    assert.deepEqual(errors, []);
    const byPath = new Map(assets.map(a => [a.path, a]));
    for (const f of manifest.files) {
      const asset = byPath.get(f.path);
      assert.ok(asset, `missing from scan: ${f.path}`);
      assert.equal(asset.kind, f.expected.kind, f.path);
      assert.equal(asset.size, f.size, f.path);
      assert.match(asset.sha256, /^[0-9a-f]{64}$/, f.path);
    }
    // nothing extra beyond the manifest — except the manifest file itself, which lives in the tree
    assert.equal(assets.length, manifest.files.length + 1);
    assert.equal(byPath.get('expected.json').kind, 'other');
  }));

test('content hashing: planted duplicates collide, the "+"-twins do not', () =>
  withFixtureTree(async (dir, manifest) => {
    const { assets } = await scanTree(dir);
    const byPath = new Map(assets.map(a => [a.path, a.sha256]));
    const dupPaths = manifest.files.filter(f => f.expected.dupGroup === 1).map(f => f.path);
    assert.equal(dupPaths.length, 3);
    const dupHashes = new Set(dupPaths.map(p => byPath.get(p)));
    assert.equal(dupHashes.size, 1, 'byte-identical copies must share one hash');
    assert.notEqual(byPath.get('Мобилка/IMG_20140121_184626.jpg'),
                    byPath.get('Мобилка/IMG_20140121_184626+.jpg'),
                    'the "+"-twin is a different shot, never a duplicate');
  }));

test('scan is strictly read-only: no size or mtime in the tree changes', () =>
  withFixtureTree(async (dir, manifest) => {
    const before = new Map();
    for (const f of manifest.files) {
      const s = await stat(join(dir, ...f.path.split('/')));
      before.set(f.path, `${s.size}:${s.mtimeMs}`);
    }
    await scanTree(dir);
    for (const [path, sig] of before) {
      const s = await stat(join(dir, ...path.split('/')));
      assert.equal(`${s.size}:${s.mtimeMs}`, sig, `scan touched ${path}`);
    }
  }));

test('identify: magic bytes decide the kind, extensions are ignored', () => {
  assert.deepEqual(identify('x.bin', makeJpeg('2014:08:10 12:00:00', 'u')), { kind: 'photo', format: 'jpeg' });
  assert.deepEqual(identify('скан.без названия', makeJpeg(null, 'u')), { kind: 'photo', format: 'jpeg' });
  assert.deepEqual(identify('x.dat', makePng('u')), { kind: 'photo', format: 'png' });
  assert.deepEqual(identify('x.jpg', makeMp4('2016-12-10T10:09:50Z', 'u')), { kind: 'video', format: 'isom' });
  assert.deepEqual(identify('x.txt', makeOgg('u')), { kind: 'audio', format: 'ogg' });
  assert.deepEqual(identify('заметка.txt', Buffer.from('просто заметка', 'utf8')), { kind: 'other', format: null });
});

test('identify: survey format classes — HEIC vs MP4 brands, RIFF family, RAW, PSD, audio', () => {
  const bmff = (brand) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftyp' + brand, 'latin1'),
                                         Buffer.alloc(8)]);
  assert.deepEqual(identify('x.heic', bmff('heic')), { kind: 'photo', format: 'heic' });
  assert.deepEqual(identify('x.mp4', bmff('mp42')), { kind: 'video', format: 'mp42' });
  assert.deepEqual(identify('x.3gp', bmff('3gp4')), { kind: 'video', format: '3gp4' });

  const riff = (sub) => Buffer.concat([Buffer.from('RIFF\0\0\0\0' + sub, 'latin1'), Buffer.alloc(4)]);
  assert.deepEqual(identify('x.avi', riff('AVI ')), { kind: 'video', format: 'avi' });
  assert.deepEqual(identify('x.webp', riff('WEBP')), { kind: 'photo', format: 'webp' });
  assert.deepEqual(identify('x.wav', riff('WAVE')), { kind: 'audio', format: 'wav' });

  assert.equal(identify('x.cr2', Buffer.from('II*\0rest', 'latin1')).kind, 'photo');   // TIFF-based RAW
  assert.equal(identify('арт.psd', Buffer.from('8BPSrest', 'latin1')).kind, 'photo');  // owner: psd = media
  assert.equal(identify('x.mp3', Buffer.from('ID3\x03rest', 'latin1')).kind, 'audio');
  assert.equal(identify('голос.amr', Buffer.from('#!AMR\n', 'latin1')).kind, 'audio');
});

test('junk is junk BY NAME, whatever the content claims to be', () => {
  assert.equal(isJunkName('Thumbs.db'), true);
  assert.equal(isJunkName('THUMBS.DB'), true); // Windows case-insensitivity
  assert.equal(isJunkName('.nomedia'), true);
  assert.equal(isJunkName('desktop.ini'), true);
  assert.equal(isJunkName('старый.tmp'), true);
  assert.equal(isJunkName('фотка.jpg'), false);
  assert.equal(isJunkName('database.db.jpg'), false);
  // even a valid JPEG named Thumbs.db is litter, not a photo to sort
  assert.equal(identify('Thumbs.db', makeJpeg(null, 'u')).kind, 'junk');
});

test('a vanished root yields an error entry, not a crash', async () => {
  const ghost = join(tmpdir(), 'kpot-scan-never-existed-000');
  const { assets, errors } = await scanTree(ghost);
  assert.deepEqual(assets, []);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].path.includes('kpot-scan-never-existed-000'), 'error carries the path');
});
