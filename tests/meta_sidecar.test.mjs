// tests/meta_sidecar.test.mjs — sidecar evidence (researches/04): pairing rules, what a sidecar
// may claim, and what it must refuse to claim.
//
// Every case here is modelled on a shape that was OBSERVED in the owner's real archive, not
// imagined: the stem-matched THM+AVI pair (25 real files), the orphan THM (9), the full-name XMP
// (1), and the mixed-case extensions Windows delivers. The one exception is documented in the
// spec that needs it: no real XMP in that archive carries a date at all, so the XMP date path is
// guarded by fixture only — researches/04 §5 says so out loud and this file must not pretend
// otherwise.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  pairSidecars, sidecarClaim, xmpCaptureDate, parseSidecarXmpDate, isSidecarPath,
} from '../src/meta/sidecar.mjs';
import { makeFixtureTree, makeJpegEx, makeXmp } from './fixtures/make.mjs';
import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';

const NOW = new Date('2026-07-28T00:00:00Z');

/** Shorthand for a scanned asset record — pairing only reads `path` and `kind`. */
const asset = (path, kind) => ({ path, kind });

test('pairing rule A: same stem, different extension — the camera convention', () => {
  const pairs = pairSidecars([
    asset('видео/MVI_0042.avi', 'video'),
    asset('видео/MVI_0042.THM', 'photo'),
  ]);
  assert.deepEqual([...pairs.entries()], [['видео/MVI_0042.avi', ['видео/MVI_0042.THM']]]);
});

test('pairing rule B: the sidecar names its twin outright (photo.jpg.xmp)', () => {
  const pairs = pairSidecars([
    asset('сканы/скан.jpg', 'photo'),
    asset('сканы/скан.jpg.xmp', 'other'),
  ]);
  assert.deepEqual([...pairs.entries()], [['сканы/скан.jpg', ['сканы/скан.jpg.xmp']]]);
});

test('pairing is case-insensitive — Windows delivers mixed-case extensions', () => {
  const pairs = pairSidecars([
    asset('d/Clip_01.AVI', 'video'),
    asset('d/clip_01.thm', 'photo'),
  ]);
  assert.deepEqual([...pairs.values()], [['d/clip_01.thm']]);
});

test('an ORPHAN sidecar pairs with nothing and invents no twin', () => {
  // 9 of the archive's 34 THMs are in exactly this state: their video is gone.
  const pairs = pairSidecars([
    asset('видео/MVI_9999.THM', 'photo'),
    asset('видео/что-то ещё.mp4', 'video'),
  ]);
  assert.equal(pairs.size, 0);
});

test('an AMBIGUOUS stem pairs with nothing — which twin would it even describe?', () => {
  const pairs = pairSidecars([
    asset('d/CLIP.avi', 'video'),
    asset('d/CLIP.mp4', 'video'),
    asset('d/CLIP.thm', 'photo'),
  ]);
  assert.equal(pairs.size, 0, 'two candidates is an ambiguity, and invariant 3 forbids guessing');
});

test('pairing never crosses a directory boundary, and never picks a non-media twin', () => {
  const acrossDirs = pairSidecars([
    asset('a/CLIP.avi', 'video'),
    asset('b/CLIP.thm', 'photo'),
  ]);
  assert.equal(acrossDirs.size, 0, 'a sidecar describes the file BESIDE it, not one elsewhere');

  const nonMedia = pairSidecars([
    asset('d/отчёт.doc', 'other'),
    asset('d/отчёт.thm', 'photo'),
  ]);
  assert.equal(nonMedia.size, 0, 'a sidecar next to a document describes nothing KPOT sorts by date');
});

test('isSidecarPath recognises the two extensions and nothing else', () => {
  assert.equal(isSidecarPath('d/x.thm'), true);
  assert.equal(isSidecarPath('d/x.THM'), true);
  assert.equal(isSidecarPath('d/x.jpg.xmp'), true);
  assert.equal(isSidecarPath('d/x.jpg'), false);
  assert.equal(isSidecarPath('d/thm'), false, 'an extensionless file named "thm" is not a sidecar');
});

test('a THM donates its DateTimeOriginal, and names itself in the evidence detail', () => {
  const thm = makeJpegEx({ dateTimeOriginal: '2012:04:11 20:18:02',
    make: 'SONY', model: 'DSC-S3000', width: 160, height: 120, uniq: 'u1' });
  const ev = sidecarClaim(thm, 'видео/MVI_0042.THM');
  assert.equal(ev.kind, 'sidecar');
  assert.deepEqual(ev.wall, { year: 2012, month: 4, day: 11, hour: 20, minute: 18, second: 2 });
  assert.match(ev.detail, /MVI_0042\.THM/, 'the owner must be able to see WHICH file dated this one');
});

test('a THM with no capture date donates nothing — its write time is not a capture claim', () => {
  // A camera thumbnail's DateTime is when the thumbnail was written. Taking it would be the exact
  // mistake plans/02 §1.1 removed for editor exports.
  const thm = makeJpegEx({ dateTime: '2012:04:11 20:18:02', make: 'SONY', uniq: 'u2' });
  assert.equal(sidecarClaim(thm, 'd/x.thm'), null);
});

test('an XMP donates exif:DateTimeOriginal, as an attribute or as an element', () => {
  const attrForm = makeXmp({ dateTimeOriginal: '2009-08-14T16:20:00+03:00' });
  const ev = sidecarClaim(attrForm, 'сканы/скан.jpg.xmp');
  assert.equal(ev.kind, 'sidecar');
  assert.deepEqual(ev.wall, { year: 2009, month: 8, day: 14, hour: 16, minute: 20, second: 0 });
  assert.equal(ev.dateOnly, false);

  const elemForm = '<rdf:Description><exif:DateTimeOriginal>2009-08-14T16:20:00</exif:DateTimeOriginal></rdf:Description>';
  assert.deepEqual(xmpCaptureDate(elemForm).wall,
    { year: 2009, month: 8, day: 14, hour: 16, minute: 20, second: 0 });
});

test('an XMP carrying ONLY a save date donates nothing', () => {
  // The honesty rule this whole module inherits: a sidecar cannot distinguish a copied capture
  // date from the moment an editor pressed save, so the ambiguous properties are not read at all.
  const saveOnly = makeXmp({ modifyDate: '2014-11-20T20:15:00' });
  assert.equal(sidecarClaim(saveOnly, 'сканы/только_правка.jpg.xmp'), null);
  assert.equal(xmpCaptureDate('<rdf:Description xmp:CreateDate="2014-11-20T20:15:00"/>'), null,
    'xmp:CreateDate is what editors write on save — excluded deliberately');
});

test('sidecar date parsing accepts the date-only form and rejects nonsense', () => {
  assert.deepEqual(parseSidecarXmpDate('2009-08-14'),
    { wall: { year: 2009, month: 8, day: 14, hour: 0, minute: 0, second: 0 }, dateOnly: true });
  assert.equal(parseSidecarXmpDate('2009-13-14T00:00:00'), null, 'month 13 is not a date');
  assert.equal(parseSidecarXmpDate('вчера'), null);
  assert.equal(parseSidecarXmpDate(undefined), null);
});

test('ACCEPTANCE: on the fixture tree the sidecar dates its twin, and only its twin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-sidecar-'));
  try {
    await makeFixtureTree(dir);
    const { assets } = await scanTree(dir);
    await annotateAssets(dir, assets, { now: NOW });
    const byPath = new Map(assets.map(a => [a.path, a]));

    // The video that AVI+serial-name leaves undatable is dated exactly, from its twin.
    const avi = byPath.get('видео/MVI_0042.avi');
    assert.equal(avi.verdict.status, 'dated');
    assert.equal(avi.verdict.winner, 'sidecar');
    assert.equal(avi.verdict.date, '2012-04-11 20:18:02');
    assert.match(avi.evidence.find(e => e.kind === 'sidecar').detail, /MVI_0042\.THM/);

    // The orphan's date stays its own: it is not donated to anything in that directory.
    for (const [path, a] of byPath) {
      if (path === 'видео/MVI_9999.THM' || !a.evidence) continue;
      const donated = a.evidence.find(e => e.kind === 'sidecar');
      assert.ok(!donated || !donated.detail.includes('MVI_9999'),
        `an orphan sidecar dated ${path} — it has no twin to date`);
    }

    // The photo with no metadata of its own gets its date from the XMP beside it...
    const scan = byPath.get('сканы/скан_без_даты.jpg');
    assert.equal(scan.verdict.winner, 'sidecar');
    assert.equal(scan.verdict.date, '2009-08-14 16:20:00');

    // ...while the one whose XMP holds only a save date stays honestly unknown.
    const saveOnly = byPath.get('сканы/только_правка.jpg');
    assert.equal(saveOnly.verdict.status, 'unknown',
      'a save date in a sidecar must not date a photograph');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a sidecar never overrides the media file own capture date', async () => {
  // Rank check with real files rather than a hand-built evidence list: if the twin has EXIF of its
  // own, that EXIF wins and the sidecar becomes a corroboration or a documented conflict.
  const dir = await mkdtemp(join(tmpdir(), 'kpot-sidecar-rank-'));
  try {
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(join(dir, 'd'), { recursive: true });
    await writeFile(join(dir, 'd', 'A.jpg'), makeJpegEx({ dateTimeOriginal: '2015:05:05 05:05:05', uniq: 'r1' }));
    await writeFile(join(dir, 'd', 'A.thm'), makeJpegEx({ dateTimeOriginal: '2001:01:01 01:01:01', uniq: 'r2' }));
    const { assets } = await scanTree(dir);
    await annotateAssets(dir, assets, { now: NOW });
    const a = assets.find(x => x.path === 'd/A.jpg');
    assert.equal(a.verdict.winner, 'exif-original');
    assert.equal(a.verdict.date, '2015-05-05 05:05:05');
    assert.ok(a.verdict.disputed.some(d => d.kind === 'sidecar' && d.reason === 'conflicts-with-winner'),
      'the disagreeing sidecar must stay visible to the owner, not be dropped');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
