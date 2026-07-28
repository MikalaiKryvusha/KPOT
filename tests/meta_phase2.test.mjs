// tests/meta_phase2.test.mjs — specs for the Phase-2 metadata pipeline: EXIF & MP4 extractors,
// dirname evidence, mtime spike discounting, the DateVerdict resolver — and the phase's
// ACCEPTANCE test straight from MASTER_PLAN: on the fixture tree every planted date is recovered,
// every planted undatable is *unknown* (not guessed), and each verdict lists its evidence.
// [TESTED: 2026-07-24 · runs green via npm test — suite 55/55]

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exifEvidence, parseExifDate } from '../src/meta/exif.mjs';
import { mp4CreationInstant } from '../src/meta/mp4.mjs';
import { dirnameEvidence } from '../src/meta/dirname_date.mjs';
import { detectMtimeSpikeDays, mtimeEvidence, resolveDate } from '../src/meta/resolve.mjs';
import { cohortYearByDir } from '../src/meta/cohort.mjs';
import { makeEvidence, formatWall } from '../src/meta/evidence.mjs';
import { annotateAssets } from '../src/meta/annotate.mjs';
import { scanTree } from '../src/scan/scan.mjs';
import { makeFixtureTree, makeJpeg, makeMp4 } from './fixtures/make.mjs';

const NOW = new Date('2026-07-24T00:00:00Z');

test('EXIF extractor reads the planted DateTimeOriginal; EXIF-less files yield silence', () => {
  const [ev] = exifEvidence(makeJpeg('2013:07:04 10:11:12', 'u'));
  assert.equal(ev.kind, 'exif-original');
  assert.equal(formatWall(ev.wall), '2013-07-04 10:11:12');
  assert.deepEqual(exifEvidence(makeJpeg(null, 'u')), []);
  assert.deepEqual(exifEvidence(Buffer.from('not an image at all')), []);
  assert.equal(parseExifDate('2013:13:04 10:11:12'), null); // month 13 → structurally invalid
});

test('MP4 box walk finds mvhd creation time as a UTC instant; unset/absent yields null', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-mp4-'));
  try {
    const dated = join(dir, 'a.mp4'), unset = join(dir, 'b.mp4'), alien = join(dir, 'c.bin');
    await writeFile(dated, makeMp4('2016-12-10T10:09:50Z', 'u1'));
    await writeFile(unset, makeMp4(null, 'u2'));                 // creation_time = 0 (unset)
    await writeFile(alien, makeJpeg(null, 'u3'));                // not a container at all
    assert.equal((await mp4CreationInstant(dated)).getTime(), Date.parse('2016-12-10T10:09:50Z'));
    assert.equal(await mp4CreationInstant(unset), null);
    assert.equal(await mp4CreationInstant(alien), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('dirname evidence: the owner\'s own year/season dirs, innermost segment wins', () => {
  const [ev] = dirnameEvidence('2013/осень 2013/день рождения.jpg', { now: NOW });
  assert.equal(ev.kind, 'dirname');
  assert.equal(ev.wall.year, 2013);
  assert.equal(ev.season, 'осень');
  assert.equal(ev.dateOnly, true);

  const [spelled] = dirnameEvidence('Зима_2020/x.jpg', { now: NOW }); // separator/case variants
  assert.equal(spelled.wall.year, 2020);
  assert.equal(spelled.season, 'зима');

  const [yearOnly] = dirnameEvidence('2014/DSC02000.JPG', { now: NOW });
  assert.equal(yearOnly.wall.year, 2014);
  assert.equal(yearOnly.season, undefined);

  assert.deepEqual(dirnameEvidence('Мобилка/IMG_1.jpg', { now: NOW }), []);   // no year anywhere
  assert.deepEqual(dirnameEvidence('старое/1899/x.jpg', { now: NOW }), []);   // implausible year
});

test('mtime copy spikes are detected corpus-wide and discount the claim', () => {
  const spikeDay = Date.parse('2023-05-15T12:00:00Z');
  const mtimes = [spikeDay, spikeDay + 1000, spikeDay + 2000,
                  Date.parse('2019-03-01T10:00:00Z'), Date.parse('2020-07-07T10:00:00Z'),
                  Date.parse('2021-01-02T10:00:00Z'), Date.parse('2021-08-09T10:00:00Z'),
                  Date.parse('2022-02-03T10:00:00Z'), Date.parse('2022-09-10T10:00:00Z'),
                  Date.parse('2024-04-05T10:00:00Z')];
  const spiked = detectMtimeSpikeDays(mtimes);
  assert.deepEqual([...spiked], ['2023-05-15']); // 3/10 on one day; singles stay trusted
  const [discounted] = mtimeEvidence(spikeDay, spiked);
  assert.equal(discounted.discounted, true);
  assert.equal(discounted.detail, 'mtime-copy-spike');
  const [normal] = mtimeEvidence(Date.parse('2019-03-01T10:00:00Z'), spiked);
  assert.equal(normal.discounted, undefined);
});

test('resolver honesty: implausible years are disputed, mtime never determines, dirname → partial', () => {
  const brokenClock = makeEvidence('exif-original', { wall: { year: 1979, month: 1, day: 1 } });
  const mtime = mtimeEvidence(Date.parse('2015-01-01T00:00:00Z'))[0];
  const broken = resolveDate([brokenClock, mtime], { now: NOW });
  assert.equal(broken.status, 'unknown');
  assert.equal(broken.date, null);
  assert.deepEqual(broken.disputed.map(d => d.reason), ['implausible-year']);

  const mtimeOnly = resolveDate([mtime], { now: NOW });
  assert.equal(mtimeOnly.status, 'unknown', 'mtime alone must never date a file');

  const dirOnly = resolveDate(dirnameEvidence('2013/осень 2013/x.jpg', { now: NOW }), { now: NOW });
  assert.equal(dirOnly.status, 'partial');
  assert.equal(dirOnly.year, 2013);
  assert.equal(dirOnly.season, 'осень');
  assert.equal(dirOnly.date, null, 'a season dir narrows the date, it does not invent one');
});

test('resolver: precedence picks the winner, agreements corroborate, conflicts are kept visible', () => {
  const exif = makeEvidence('exif-original', { wall: { year: 2013, month: 7, day: 4, hour: 10, minute: 11, second: 12 } });
  const dirname = dirnameEvidence('2013/Лето 2013/x.jpg', { now: NOW })[0];
  const agreeing = resolveDate([dirname, exif], { now: NOW }); // insertion order must not matter
  assert.equal(agreeing.winner, 'exif-original');
  assert.equal(agreeing.date, '2013-07-04 10:11:12');
  assert.equal(agreeing.corroborated, true);
  assert.deepEqual(agreeing.disputed, []);

  const otherYear = makeEvidence('filename-timestamp', { wall: { year: 2018, month: 1, day: 1 } });
  const conflicted = resolveDate([exif, otherYear], { now: NOW });
  assert.equal(conflicted.winner, 'exif-original');
  assert.deepEqual(conflicted.disputed.map(d => [d.kind, d.reason]),
    [['filename-timestamp', 'conflicts-with-winner']]);
});

test('dir-cohort fires only on strong consensus of confident neighbors', () => {
  const asset = (path, year, winner = 'exif-original', confidence = 'high') =>
    ({ path, verdict: year === null ? { status: 'unknown', year: null } : { status: 'dated', year, winner, confidence } });

  const cohorts = cohortYearByDir([
    // a device dump: three confident 2011 files + one unknown → consensus
    asset('dump/a.jpg', 2011), asset('dump/b.jpg', 2011), asset('dump/c.jpg', 2011),
    asset('dump/x.jpg', null),
    // a mixed dir: 2×2015 + 2×2016 → top share 0.5 < 0.8 → NO consensus
    asset('mixed/a.jpg', 2015), asset('mixed/b.jpg', 2015),
    asset('mixed/c.jpg', 2016), asset('mixed/d.jpg', 2016),
    // too few neighbors → no consensus
    asset('small/a.jpg', 2019), asset('small/b.jpg', 2019),
    // weak years must not feed a cohort: low-confidence and cohort-derived neighbors don't count
    asset('weak/a.jpg', 2013, 'filename-year', 'low'), asset('weak/b.jpg', 2013, 'dir-cohort', 'low'),
    asset('weak/c.jpg', 2013, 'filename-year', 'low'),
  ]);
  assert.deepEqual([...cohorts.entries()], [['dump', { year: 2011, count: 3 }]]);
});

// ---------------------------------------------------------------------------------------------
// The Phase-2 ACCEPTANCE test (MASTER_PLAN §Phase 2): full pipeline over the fixture tree.
// ---------------------------------------------------------------------------------------------

/** The planted epoch-ms value (fixture catalog case `1374250121884.jpg`) — its expected.date string
 * is written in the OWNER'S local time, so the portable assertion is the exact UTC instant. */
const PLANTED_EPOCH_MS = 1374250121884;

test('ACCEPTANCE: every planted date recovered, every undatable honestly unknown, evidence attached', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kpot-accept-'));
  try {
    const manifest = await makeFixtureTree(dir);
    const { assets } = await scanTree(dir);
    const counts = await annotateAssets(dir, assets, { now: NOW });
    assert.deepEqual(counts.errors, []);
    const byPath = new Map(assets.map(a => [a.path, a]));

    for (const f of manifest.files) {
      const a = byPath.get(f.path);
      const exp = f.expected;
      if (!['photo', 'video', 'audio'].includes(exp.kind)) {
        assert.equal(a.verdict, undefined, `non-media must carry no verdict: ${f.path}`);
        continue;
      }
      const v = a.verdict;
      assert.ok(v, `media asset without a verdict: ${f.path}`);
      assert.ok(a.evidence.length > 0, `verdict with no evidence list: ${f.path}`);

      switch (exp.evidence) {
        case 'filename':
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'filename-timestamp', f.path);
          assert.equal(v.date, exp.date, f.path);
          assert.equal(v.dateOnly, Boolean(exp.dateOnly), f.path);
          break;
        case 'exif':
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'exif-original', f.path);
          assert.equal(v.date, exp.date, f.path);
          break;
        case 'filename-epoch':
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'filename-epoch', f.path);
          assert.equal(v.instant.getTime(), PLANTED_EPOCH_MS, f.path);
          break;
        case 'mvhd-utc':
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'container-created', f.path);
          // the fixture plants mvhd times as UTC ISO strings — expected.date is that UTC moment
          assert.equal(v.instant.getTime(), Date.parse(exp.date.replace(' ', 'T') + 'Z'), f.path);
          break;
        case 'dirname':
          assert.equal(v.status, 'partial', f.path);
          assert.equal(v.date, null, f.path);
          assert.equal(v.year, exp.year, f.path);
          assert.equal(v.season, exp.season, f.path);
          break;
        case 'dir-cohort': // an ASSUMED year from confidently-dated neighbors — flagged, date null
          assert.equal(v.status, 'partial', f.path);
          assert.equal(v.winner, 'dir-cohort', f.path);
          assert.equal(v.assumed, true, f.path);
          assert.equal(v.confidence, 'low', f.path);
          assert.equal(v.date, null, f.path);
          assert.equal(v.year, exp.year, f.path);
          break;
        case 'derived-original': // plans/02 §1.2 — the original's REAL capture date, inherited exactly
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'derived-original', f.path);
          assert.equal(v.date, exp.date, f.path);
          assert.ok(a.evidence.find(e => e.kind === 'derived-original')?.detail.includes('оригинал.jpg'),
            `the report must name the original it took the date from: ${f.path}`);
          break;
        case 'pixel-original': // plans/02 §Шаг 2 — the original found BY ITS PIXELS among neighbours
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'pixel-original', f.path);
          assert.equal(v.date, exp.date, `the ORIGINAL's real capture date, not the save date: ${f.path}`);
          assert.ok(a.evidence.find(e => e.kind === 'pixel-original')?.detail.includes(exp.original),
            `the report must name the file the date came from: ${f.path}`);
          assert.ok(v.disputed.some(d => d.reason === 'editor-save-date'),
            `the overruled save date must stay visible even when pixels won: ${f.path}`);
          break;
        case 'family': // plans/02 §1.3 — camera family narrowed to one year: flagged ASSUMPTION
          assert.equal(v.status, 'partial', f.path);
          assert.equal(v.winner, 'family', f.path);
          assert.equal(v.assumed, true, f.path);
          assert.equal(v.confidence, 'low', f.path);
          assert.equal(v.date, null, `family narrows to a year, it must never invent a date: ${f.path}`);
          assert.equal(v.year, exp.year, f.path);
          assert.ok(v.disputed.some(d => d.reason === 'editor-save-date'),
            `the rejected save date must stay visible: ${f.path}`);
          assert.ok(v.family && v.family.model === 'GT-I9100' && v.family.matchedBy === 'geometry',
            `family signs must name the camera and how it was matched: ${f.path}`);
          break;
        case 'editor-upper-bound': // plans/02 §1.1 — save date is a ceiling, the file stays unknown
          assert.equal(v.status, 'unknown', `an editor save date must never date a file: ${f.path}`);
          assert.equal(v.date, null, f.path);
          assert.ok(v.disputed.some(d => d.reason === 'editor-save-date'), f.path);
          assert.ok(v.family?.noLaterThan, `the ceiling must reach the owner as a family sign: ${f.path}`);
          break;
        case 'sidecar': // researches/04 — the date comes from a THM/XMP twin, not from the file
          assert.equal(v.status, 'dated', f.path);
          assert.equal(v.winner, 'sidecar', f.path);
          assert.equal(v.date, exp.date, f.path);
          assert.ok(a.evidence.find(e => e.kind === 'sidecar')?.detail,
            `the report must name the sidecar the date came from: ${f.path}`);
          break;
        case 'exif-reset-clock': // owner 2026-07-28 — a proven reset clock is not a date
          assert.equal(v.status, 'unknown', `a reset camera clock must not date a file: ${f.path}`);
          assert.equal(v.date, null, f.path);
          assert.ok(v.disputed.some(d => d.reason === 'reset-camera-clock'),
            `the owner must see WHY the date was refused: ${f.path}`);
          break;
        case 'exif-implausible':
          assert.equal(v.status, 'unknown', `broken clock must not be trusted: ${f.path}`);
          assert.ok(v.disputed.some(d => d.reason === 'implausible-year'), f.path);
          break;
        case 'none':
          assert.equal(v.status, 'unknown', `must not guess: ${f.path}`);
          assert.equal(v.date, null, f.path);
          break;
        default:
          assert.fail(`unhandled expected.evidence '${exp.evidence}' for ${f.path}`);
      }
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
