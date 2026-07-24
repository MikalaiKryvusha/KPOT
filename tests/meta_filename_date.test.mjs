// tests/meta_filename_date.test.mjs — specs for filename-date detection.
// [TESTED: 2026-07-24 · runs green via npm test — suite 40/40]
// Ground truth is the fixture catalog (tests/fixtures/make.mjs), which itself mirrors the
// real-archive survey — so these specs tie the detectors to reality, not to the regexes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { allNameEvidence, bestNameEvidence } from '../src/meta/filename_date.mjs';
import { formatWall } from '../src/meta/evidence.mjs';
import { catalog } from './fixtures/make.mjs';

const NOW = new Date('2026-07-24T00:00:00Z'); // injected clock for epoch range checks
const opts = { now: NOW };
const base = (p) => p.split('/').at(-1);

test('every fixture file with filename evidence resolves to its planted date', () => {
  const cases = catalog().filter(c => c.expected.evidence === 'filename');
  assert.ok(cases.length >= 6, 'fixture catalog lost its filename-evidence cases?');
  for (const c of cases) {
    const ev = bestNameEvidence(base(c.path), opts);
    assert.ok(ev, `no evidence found in ${c.path}`);
    assert.equal(ev.kind, 'filename-timestamp', c.path);
    assert.equal(formatWall(ev.wall), c.expected.date, c.path);
    assert.equal(ev.dateOnly, Boolean(c.expected.dateOnly), `dateOnly mismatch: ${c.path}`);
  }
});

test('epoch filenames decode to the exact UTC instant (never a local guess)', () => {
  // fixture ground truth: 1374250121884 is the epoch-ms case planted in the catalog
  const c = catalog().find(x => x.expected.evidence === 'filename-epoch');
  const ev = bestNameEvidence(base(c.path), opts);
  assert.equal(ev.kind, 'filename-epoch');
  assert.equal(ev.instant.getTime(), 1374250121884);
  // telegram convention: epoch SECONDS after a `photo` prefix
  const tg = bestNameEvidence('photo1711295489.jpeg', opts);
  assert.equal(tg.instant.getTime(), 1711295489000);
});

test('undatable fixture names yield nothing — EXIF is their only hope, not a guess', () => {
  const undatable = catalog().filter(c =>
    ['exif', 'none', 'dirname', 'dir-cohort', 'mvhd-utc', 'exif-implausible'].includes(c.expected.evidence));
  assert.ok(undatable.length >= 10);
  for (const c of undatable) {
    assert.equal(bestNameEvidence(base(c.path), opts), null, `false positive on ${c.path}`);
  }
});

test('double-dated name yields BOTH claims for the resolver to corroborate', () => {
  // real-archive pattern: `2011-05-09 PIC16(1304952444364).jpg` — ISO date + epoch-ms in one name
  const all = allNameEvidence('2011-05-09 PIC16(1304952444364).jpg', opts);
  const iso = all.find(e => e.detail === 'leading-iso-date');
  const epoch = all.find(e => e.detail === 'paren-epoch');
  assert.equal(formatWall(iso.wall), '2011-05-09 00:00:00');
  assert.equal(iso.dateOnly, true);
  assert.equal(epoch.instant.getTime(), 1304952444364);
  assert.equal(all[0], iso, 'wall timestamp outranks the epoch claim in detector order');
});

test('remaining survey conventions: iOS dotted, Windows Phone, scavengers, bare year', () => {
  const ios = bestNameEvidence('2011-04-28 19.05.49 PIC12.jpg', opts);
  assert.equal(formatWall(ios.wall), '2011-04-28 19:05:49');
  assert.equal(ios.dateOnly, false);

  const wp = bestNameEvidence('WP_20151102_038.jpg', opts);
  assert.equal(formatWall(wp.wall), '2015-11-02 00:00:00');
  assert.equal(wp.dateOnly, true);

  // AI-upscaler-style name — a date buried mid-name is found but demoted to medium confidence
  const scav = bestNameEvidence('fix_light_output_image_2024-04-24_0af3_4k.jpg', opts);
  assert.equal(scav.detail, 'iso-date-anywhere');
  assert.equal(scav.confidence, 'medium');
  assert.equal(formatWall(scav.wall), '2024-04-24 00:00:00');

  // a bare year is the weakest evidence, never a date
  const yr = bestNameEvidence('отпуск 2013 море.jpg', opts);
  assert.equal(yr.kind, 'filename-year');
  assert.equal(yr.confidence, 'low');
  assert.equal(yr.wall.year, 2013);
});

test('garbage that LOOKS like a date is rejected: bad calendars, out-of-range epochs', () => {
  assert.equal(bestNameEvidence('IMG_20141301_120000.jpg', opts), null); // month 13
  assert.equal(bestNameEvidence('IMG_20140132_120000.jpg', opts), null); // day 32
  assert.equal(bestNameEvidence('0123456789.jpg', opts), null);         // epoch → 1973, pre-digital
  assert.equal(bestNameEvidence('9999999999.jpg', opts), null);         // epoch → 2286
  assert.equal(bestNameEvidence('1979-01-01 photo.jpg', opts)?.kind, 'filename-timestamp',
    'structural validity is separate from plausibility — the resolver judges 1979, not the detector');
});
