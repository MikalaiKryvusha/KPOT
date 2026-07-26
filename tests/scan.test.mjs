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

// Bug 04 — three whole formats the owner found sitting unsorted in his real archive, because
// `identify` did not know them and "not media" means "leave it alone": 18 JPEG-2000 scans, 19
// WhatsApp voice notes, and a 2.1 GB camcorder video.
test('identify: the formats bug 04 added — JPEG 2000, MPEG-TS camcorder video, raw ADTS AAC', () => {
  // JPEG 2000: the JP2 signature box, and the bare codestream.
  const jp2 = Buffer.concat([Buffer.from([0, 0, 0, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A]), Buffer.alloc(4)]);
  assert.deepEqual(identify('скан.jp2', jp2), { kind: 'photo', format: 'jp2' });
  assert.deepEqual(identify('скан.j2k', Buffer.from([0xFF, 0x4F, 0xFF, 0x51, 0, 0, 0, 0])), { kind: 'photo', format: 'jp2' });

  // MPEG-TS has NO magic string — only the 0x47 sync byte on a fixed grid. Both layouts must work:
  // plain .ts (sync at 0, stride 188) and camcorder .mts (4-byte timecode first, stride 192).
  const ts = Buffer.alloc(400); ts[0] = 0x47; ts[188] = 0x47;
  assert.deepEqual(identify('x.ts', ts), { kind: 'video', format: 'mpeg-ts' });
  const mts = Buffer.alloc(400); mts[4] = 0x47; mts[4 + 192] = 0x47;
  assert.deepEqual(identify('00035.MTS', mts), { kind: 'video', format: 'mpeg-ts' });

  // …and ONE stray 0x47 must not be enough, or every file starting with "G" becomes a video.
  const notTs = Buffer.alloc(400); notTs[0] = 0x47;              // "G" and nothing else
  assert.equal(identify('GONE.txt', notTs).kind, 'other', 'a single sync byte is not a signature');

  // Raw ADTS AAC (WhatsApp voice notes) — and it must not steal MP3, whose layer bits differ.
  assert.deepEqual(identify('AUD-WA0003.aac', Buffer.from([0xFF, 0xF1, 0x4C, 0x80, 0x20, 0xFF, 0xFC, 0x21])),
    { kind: 'audio', format: 'aac' });
  assert.equal(identify('x.mp3', Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0])).format, 'mp3',
    'MP3 layer III must still be MP3, not AAC');
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
