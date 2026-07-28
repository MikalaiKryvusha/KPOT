// tests/meta_reset_clock.test.mjs — the owner's rule of 2026-07-28: «сброшенным часам камеры не
// доверять, ЕСЛИ это факт, что они сброшены».
// [TESTED: 2026-07-28 · npm test green; both guards verified by breaking the code first — see the
// commit's justification block]
//
// The whole difficulty of this rule is in its second half. A photograph taken at 00:25 on the 1st of
// January is a completely ordinary New Year picture, and it is indistinguishable BY SHAPE from what a
// camera shows after its battery has been out. So the shape may never be the reason: the archive
// itself has to contradict the claim, by containing no photography from that era at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isResetClockShape, makeEvidence } from '../src/meta/evidence.mjs';
import { resolveDate } from '../src/meta/resolve.mjs';
import { corpusFloorYear } from '../src/meta/annotate.mjs';

const NOW = new Date('2026-07-28T00:00:00Z');
const exif = (year, month, day, hour, minute = 0, second = 0) => makeEvidence('exif-original', {
  wall: { year, month, day, hour, minute, second }, detail: 'DateTimeOriginal',
});

test('the reset SHAPE is 1 January in the first hour — and nothing else', () => {
  assert.equal(isResetClockShape({ year: 2000, month: 1, day: 1, hour: 0 }), true);
  assert.equal(isResetClockShape({ year: 2000, month: 1, day: 1, hour: 1 }), false, 'an hour later is a photo');
  assert.equal(isResetClockShape({ year: 2000, month: 1, day: 2, hour: 0 }), false);
  assert.equal(isResetClockShape({ year: 2000, month: 2, day: 1, hour: 0 }), false);
  assert.equal(isResetClockShape(null), false);
});

test('a reset-shaped date BELOW the collection’s own floor is refused, with the reason shown', () => {
  const v = resolveDate([exif(2000, 1, 1, 0, 25, 13)], { now: NOW, resetFloorYear: 2007 });
  assert.equal(v.status, 'unknown', 'the archive starts in 2007 — this camera’s clock was reset');
  assert.equal(v.date, null);
  assert.deepEqual(v.disputed.map((d) => d.reason), ['reset-camera-clock']);
});

test('THE SAME SHAPE inside the archive’s own era is a New Year photo, and must survive', () => {
  // This is the guard that keeps the rule honest. The owner's condition was «если это ФАКТ, что они
  // сброшены» — and about a 2016 photo in an archive that runs from 2007, nothing has been proven.
  const v = resolveDate([exif(2016, 1, 1, 0, 40, 12)], { now: NOW, resetFloorYear: 2007 });
  assert.equal(v.status, 'dated');
  assert.equal(v.date, '2016-01-01 00:40:12');
  assert.deepEqual(v.disputed, []);
});

test('a YEAR-ONLY source is not a clock reading, and the rule must not touch it', () => {
  // The trap this guards against was caught by the idempotence spec, not by reasoning: a year-only
  // claim (a folder named «2009», a bare year in a name, a cohort) is STORED as 1 January 00:00 —
  // the reset shape exactly. Refusing those threw away good verdicts and, because the file then
  // moved, broke the "sorting a sorted tree moves nothing" invariant.
  const dirname = makeEvidence('dirname', {
    wall: { year: 2009, month: 1, day: 1 }, dateOnly: true, detail: '2009/Лето', season: 'Лето',
  });
  const v = resolveDate([dirname], { now: NOW, resetFloorYear: 2011 });
  assert.equal(v.status, 'partial', 'a folder name is not a camera clock');
  assert.equal(v.year, 2009);
  assert.deepEqual(v.disputed, []);
});

test('with no floor known, nothing is proven and the date stands', () => {
  const v = resolveDate([exif(2000, 1, 1, 0, 25, 13)], { now: NOW, resetFloorYear: null });
  assert.equal(v.status, 'dated', 'suspicion alone may not refuse a date');
  assert.equal(v.date, '2000-01-01 00:25:13');
});

test('the floor is the earliest POPULATED year — a couple of stray claims cannot set it', () => {
  // Measured, and this is why the rule counts population instead of taking the minimum: over the
  // owner's whole archive the earliest claim is the year 2000, held by four files — two of which are
  // the broken-clock file itself. A minimum-based floor would have been set BY the defect and would
  // then have cleared it. The earliest year with real photography in it is 2005 (1 526 files).
  const many = (year, n) => Array.from({ length: n }, () => [exif(year, 6, 15, 12)]);
  const lists = [
    ...many(2011, 5),
    ...many(2013, 5),
    [exif(2004, 5, 13, 12)],                          // one stray claim: not an era
    [exif(2000, 1, 1, 0, 25, 13)],                    // a reset suspect: must not count at all
    [exif(1979, 1, 1, 0, 0, 3)],                      // implausible: not the start of a collection
    [makeEvidence('dir-cohort', { wall: { year: 1995, month: 1, day: 1 }, dateOnly: true })],
  ];
  assert.equal(corpusFloorYear(lists, NOW), 2011, 'only years the collection really lives in count');
  assert.equal(corpusFloorYear([], NOW), null, 'an archive with no capture claim proves nothing');
  assert.equal(corpusFloorYear([[exif(2011, 3, 4, 9)]], NOW), null,
    'one photograph is not an era — with nothing proven the rule must stay silent');
});
