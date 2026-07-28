// tests/meta_pixels.test.mjs — plans/02 §Шаг 2: finding an edited photo's ACTUAL original by its
// pixels. Each spec pins ONE guard so a break names its culprit; the phase-2 acceptance spec proves
// the composition (an export inherits the original's real date, and the report names the file).
// [TESTED: 2026-07-28 · npm test green; every guard verified by breaking the code first — see the
// commit's justification block]
//
// The measurements these constants come from live in researches/06_pixel_original_calibration.md.
// The specs below deliberately assert BEHAVIOUR (a wrong match must not be accepted), not the
// numbers themselves — the thresholds are calibrated on real photographs and may be re-calibrated,
// but "an unconvincing match yields no date" may never change (internal map invariant 3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanTree } from '../src/scan/scan.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { makeFixtureTree, makeJpegEx, photoPixels, cropPixels } from './fixtures/make.mjs';
import {
  cropWindows, decideByMargin, grayPreview, hamming, imagePreviews, nominateCandidates,
  searchOriginal, windowHash, FINE_BITS, PIXEL_MIN_CANDIDATES,
} from '../src/meta/pixels.mjs';

const NOW = new Date('2026-07-28T00:00:00Z');

/** A decodable JPEG of a synthetic photograph. */
const photo = (seed, uniq) => makeJpegEx({ pixels: photoPixels({ width: 320, height: 240, seed }), uniq });
/** The same photograph, cropped the way an editor export is, and re-encoded. */
const crop = (seed, uniq) => makeJpegEx({
  pixels: cropPixels(photoPixels({ width: 320, height: 240, seed })), uniq });

// ------------------------------------------------------------------ decoding is silence on failure

test('a file that is not a decodable JPEG yields no preview and no exception', () => {
  assert.equal(grayPreview(Buffer.from('not a jpeg at all')), null);
  // the metadata-only JPEGs the rest of the fixture is built from carry no scan data at all:
  // they must decode to nothing rather than throw, or one broken file would abort a whole scan
  assert.equal(grayPreview(makeJpegEx({ dateTimeOriginal: '2013:06:15 10:00:00', uniq: 'meta' })), null);
});

test('a preview keeps the image geometry, which is what the window search reasons about', () => {
  const p = grayPreview(photo(7, 'p7'));
  assert.equal(p.srcWidth, 320);
  assert.equal(p.srcHeight, 240);
  assert.equal(p.width / p.height, 320 / 240);
  assert.equal(p.data.length, p.width * p.height);
});

// ------------------------------------------------------------------------------ the hash behaviour

test('a crop matches the corresponding window of its original far better than another photo', () => {
  const original = grayPreview(photo(11, 'o11'));
  const other = grayPreview(photo(12, 'o12'));
  const cropped = grayPreview(crop(11, 'c11'));
  const queryHash = windowHash(cropped);
  const aspect = cropped.srcWidth / cropped.srcHeight;

  const bestOf = (preview) => Math.min(...cropWindows(preview, aspect)
    .map((r) => hamming(queryHash, windowHash(preview, r))));

  const mine = bestOf(original);
  const stranger = bestOf(other);
  assert.ok(mine < stranger, `own original ${mine} must beat a stranger ${stranger}`);
});

test('every searched window lies inside the candidate and keeps the query’s shape', () => {
  const p = { width: 128, height: 96 };
  const windows = cropWindows(p, 0.93); // a narrower query: the width was cut, the height kept
  assert.ok(windows.length > 1, 'a crop can sit anywhere along the cut axis — sweep it');
  for (const w of windows) {
    assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.w <= p.width && w.y + w.h <= p.height,
      `window outside the image: ${JSON.stringify(w)}`);
  }
  assert.ok(windows.some((w) => w.h === p.height), 'the full-height crop must be among them');
});

// ------------------------------------------------------------------------- who may be a candidate

const candidate = (path, date, over = {}) => ({
  path, kind: 'photo', format: 'jpeg',
  evidence: [{ kind: 'exif-original' }],
  verdict: { status: 'dated', date },
  facts: { model: 'DSC-HX9V' },
  ...over,
});

test('only a same-camera JPEG with a REAL capture date before the ceiling may be an original', () => {
  const query = candidate('dir/export.jpg', null, { verdict: { status: 'unknown' }, evidence: [] });
  const pool = [
    query,
    candidate('dir/ok1.jpg', '2012-06-15 12:30:00'),
    candidate('dir/ok2.jpg', '2013-07-20 18:05:00'),
    candidate('dir/after-the-ceiling.jpg', '2015-09-01 10:00:00'),
    candidate('dir/other-camera.jpg', '2012-01-01 10:00:00', { facts: { model: 'GT-I9100' } }),
    candidate('dir/not-jpeg.png', '2012-01-01 10:00:00', { format: 'png' }),
    candidate('dir/video.mp4', '2012-01-01 10:00:00', { kind: 'video' }),
    // an ASSUMED year is not a capture date — inheriting it would launder a guess into a fact
    candidate('dir/assumed.jpg', null, { evidence: [{ kind: 'dir-cohort' }], verdict: { status: 'partial', date: null } }),
  ];
  const { candidates, available } = nominateCandidates(query, pool,
    { model: 'DSC-HX9V', noLaterThan: '2015-03' });
  assert.deepEqual(candidates.map((c) => c.path), ['dir/ok1.jpg', 'dir/ok2.jpg']);
  assert.equal(available, 2);
});

test('candidates come out in path order — enumeration order cannot change what is compared', () => {
  const query = candidate('dir/export.jpg', null, { verdict: { status: 'unknown' }, evidence: [] });
  const pool = ['dir/c.jpg', 'dir/a.jpg', 'dir/b.jpg'].map((p) => candidate(p, '2012-06-15 12:30:00'));
  const forwards = nominateCandidates(query, pool, {}).candidates.map((c) => c.path);
  const backwards = nominateCandidates(query, [...pool].reverse(), {}).candidates.map((c) => c.path);
  assert.deepEqual(forwards, ['dir/a.jpg', 'dir/b.jpg', 'dir/c.jpg']);
  assert.deepEqual(backwards, forwards);
});

// --------------------------------------------------------------------------------- the decision

const scored = (path, distance, date) => ({ path, distance, date });

test('a winner without a decisive margin decides NOTHING — the file stays undated', () => {
  const close = decideByMargin([
    scored('a.jpg', 40, '2012-06-15 00:00:00'),
    scored('b.jpg', 52, '2013-01-01 00:00:00'),
    scored('c.jpg', 300, '2014-01-01 00:00:00'),
  ]);
  assert.equal(close.best.path, 'a.jpg');
  assert.equal(close.decisive, false, 'a 12-bit lead over another day is not proof of anything');
});

test('a decisive lead over a different day IS a decision', () => {
  const clear = decideByMargin([
    scored('a.jpg', 20, '2012-06-15 00:00:00'),
    scored('b.jpg', 400, '2013-01-01 00:00:00'),
    scored('c.jpg', 500, '2014-01-01 00:00:00'),
  ]);
  assert.equal(clear.decisive, true);
  assert.equal(clear.best.path, 'a.jpg');
  assert.equal(clear.runnerUp.path, 'b.jpg');
  assert.equal(clear.margin, 380);
});

test('a second copy of the same shoot is not a rival — it would give the very same date', () => {
  // Most archives hold duplicates and burst frames. If those counted as rivals, no archive with a
  // duplicated original could ever be decided, while the answer would have been identical either way.
  const withTwin = decideByMargin([
    scored('a.jpg', 20, '2012-06-15 00:00:00'),
    scored('a-copy.jpg', 21, '2012-06-15 00:00:00'),
    scored('b.jpg', 400, '2013-01-01 00:00:00'),
  ]);
  assert.equal(withTwin.decisive, true);
  assert.equal(withTwin.runnerUp.path, 'b.jpg', 'the rival must be the best candidate of ANOTHER day');
});

test('too few candidates is not a comparison — nothing is decided', () => {
  const thin = decideByMargin([
    scored('a.jpg', 4, '2012-06-15 00:00:00'),
    scored('b.jpg', 900, '2013-01-01 00:00:00'),
  ]);
  assert.equal(thin.decisive, false, `fewer than ${PIXEL_MIN_CANDIDATES} candidates cannot decide`);
});

test('an equally-good pair is broken by path, never by enumeration order', () => {
  const rows = [scored('b.jpg', 10, '2012-06-15 00:00:00'), scored('a.jpg', 10, '2012-06-15 00:00:00'),
    scored('z.jpg', 900, '2013-01-01 00:00:00')];
  assert.equal(decideByMargin(rows).best.path, 'a.jpg');
  assert.equal(decideByMargin([...rows].reverse()).best.path, 'a.jpg');
});

test('the comparison always gets a rival from another day, even past the finalists', () => {
  // Calibration caught exactly this (researches/06 §5): with the true original gone, all five
  // finalists happened to be from ONE day, so there was no runner-up, the margin was infinite and a
  // stranger was accepted at 61/1024. The rival must therefore be reached for further down the
  // ranking. Construction: MORE than TOP_K candidates share day 1, and the single day-2 candidate is
  // a flat grey frame — which cannot rank anywhere but last, so it can only appear as the pulled-in
  // rival, never as a finalist.
  const flat = { data: new Uint8Array(320 * 240 * 4).fill(128), width: 320, height: 240 };
  const day = (n) => `2013-0${n}-01 10:00:00`;
  const query = { previews: imagePreviews(crop(500, 'q500')) }; // its original is NOT in the pool
  const pool = [
    ...[1, 2, 3, 4, 5, 6].map((seed) => ({
      path: `day1-${seed}.jpg`, date: day(1), previews: imagePreviews(photo(seed, `look${seed}`)),
    })),
    { path: 'day2-flat.jpg', date: day(2), previews: imagePreviews(makeJpegEx({ pixels: flat, uniq: 'flat' })) },
  ];
  const decision = searchOriginal(query, pool);
  assert.ok(pool.length > 5, 'the point of the case is that the finalists cannot hold everyone');
  assert.ok(decision.runnerUp, 'a rival from another day must be pulled in for the comparison');
  assert.equal(decision.runnerUp.path, 'day2-flat.jpg');
  assert.equal(decision.decisive, false, 'no candidate is the original — none may be accepted');
});

// ------------------------------------------------------------------------- end to end, on the tree

test('an export whose original is in the tree inherits the ORIGINAL’s real capture date', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-pixels-'));
  try {
    await makeFixtureTree(dir);
    const { assets } = await scanTree(dir);
    await annotateAssets(dir, assets, { now: NOW });
    const byPath = new Map(assets.map((a) => [a.path, a]));

    const found = byPath.get('101MEDIA/правка кадра.jpg').verdict;
    assert.equal(found.status, 'dated');
    assert.equal(found.winner, 'pixel-original');
    assert.equal(found.date, '2012-06-15 12:30:00', 'the original’s date, not the 2015 save date');

    // and the one whose original was never planted must stay honestly undated
    const lost = byPath.get('101MEDIA/правка чужого.jpg').verdict;
    assert.equal(lost.status, 'unknown', 'no original in the tree → no date may be invented');
    assert.equal(lost.date, null);
    assert.ok(lost.disputed.some((d) => d.reason === 'editor-save-date'),
      'the ceiling still reaches the owner');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('--no-pixels turns the search off completely', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-nopixels-'));
  try {
    await makeFixtureTree(dir);
    const { assets } = await scanTree(dir);
    await annotateAssets(dir, assets, { now: NOW, pixels: false });
    const v = new Map(assets.map((a) => [a.path, a])).get('101MEDIA/правка кадра.jpg').verdict;
    assert.equal(v.status, 'unknown', 'without the pixel pass this file has no date at all');
    assert.notEqual(v.winner, 'pixel-original');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the fine distance is measured in the unit the evidence reports', () => {
  // A guard against the two grids drifting apart: the detail line quotes «x/FINE_BITS», so a
  // change of grid without a change of the reported unit would make the report lie.
  assert.equal(FINE_BITS, 32 * 32);
});
