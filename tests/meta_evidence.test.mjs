// tests/meta_evidence.test.mjs — specs for the date-evidence model.
// [TESTED: 2026-07-24 · runs green via npm test — suite 40/40]

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_PRECEDENCE, EVIDENCE_RANK, DEFAULT_CONFIDENCE,
  makeEvidence, isPlausibleYear, isValidWall, formatWall, MIN_PLAUSIBLE_YEAR,
} from '../src/meta/evidence.mjs';

const NOW = new Date('2026-07-24T00:00:00Z'); // injected clock — specs never read the real one

test('precedence encodes the researched order: EXIF strongest, mtime weakest', () => {
  // Seeded from Elodie's proven order + the real-archive survey tiers (researches/01 §5, 02 §Impl.),
  // with one product-driven amendment: wall-clock sources outrank UTC instants at the same tier,
  // because the library buckets by LOCAL season (see the note in evidence.mjs / EXP-0004).
  assert.equal(EVIDENCE_PRECEDENCE[0], 'exif-original');
  assert.equal(EVIDENCE_PRECEDENCE.at(-1), 'fs-mtime');
  assert.ok(EVIDENCE_RANK['filename-timestamp'] < EVIDENCE_RANK['container-created']);
  assert.ok(EVIDENCE_RANK['container-created'] < EVIDENCE_RANK['filename-epoch']);
  assert.ok(EVIDENCE_RANK['filename-epoch'] < EVIDENCE_RANK['dirname']);
  assert.ok(EVIDENCE_RANK['dirname'] < EVIDENCE_RANK['fs-mtime']);
  // every kind has a rank and a default confidence — no orphans in either table
  for (const kind of EVIDENCE_PRECEDENCE) {
    assert.ok(kind in DEFAULT_CONFIDENCE, `no confidence for ${kind}`);
  }
});

test('makeEvidence builds a well-formed claim and stamps rank + confidence', () => {
  const wall = { year: 2014, month: 1, day: 21, hour: 18, minute: 38, second: 1 };
  const ev = makeEvidence('filename-timestamp', { wall, detail: 'android-camera' });
  assert.equal(ev.rank, EVIDENCE_RANK['filename-timestamp']);
  assert.equal(ev.confidence, 'high');
  assert.equal(ev.dateOnly, false);
  assert.equal(formatWall(ev.wall), '2014-01-21 18:38:01');

  const inst = makeEvidence('filename-epoch', { instant: new Date(1374250121884) });
  assert.equal(inst.instant.getTime(), 1374250121884);
});

test('malformed evidence fails loudly instead of corrupting verdicts downstream', () => {
  const wall = { year: 2014, month: 1, day: 21 };
  assert.throws(() => makeEvidence('vibes', { wall }), RangeError);                    // unknown kind
  assert.throws(() => makeEvidence('exif-original', {}), TypeError);                   // no claim
  assert.throws(() => makeEvidence('exif-original', { wall, instant: NOW }), TypeError); // both claims
  assert.throws(() => makeEvidence('exif-original', { wall: { year: 2014, month: 13, day: 1 } }), RangeError);
  assert.throws(() => makeEvidence('filename-epoch', { instant: new Date(NaN) }), TypeError);
});

test('wall-clock validation knows real calendars', () => {
  assert.equal(isValidWall({ year: 2012, month: 2, day: 29 }), true);  // leap year
  assert.equal(isValidWall({ year: 2013, month: 2, day: 29 }), false); // not a leap year
  assert.equal(isValidWall({ year: 2013, month: 4, day: 31 }), false);
  assert.equal(isValidWall({ year: 2013, month: 7, day: 4, hour: 24 }), false);
});

test('plausibility window: broken-clock 1979 is rejected, near-future tolerated', () => {
  // the real archive contains EXIF from 1979/1980 — broken camera clocks (researches/02)
  assert.equal(isPlausibleYear(1979, NOW), false);
  assert.equal(isPlausibleYear(MIN_PLAUSIBLE_YEAR, NOW), true);
  assert.equal(isPlausibleYear(2014, NOW), true);
  assert.equal(isPlausibleYear(2027, NOW), true);  // now + 1 — clock drift slack
  assert.equal(isPlausibleYear(2028, NOW), false); // now + 2 — implausible
});
