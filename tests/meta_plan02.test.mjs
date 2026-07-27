// tests/meta_plan02.test.mjs — plans/02 step 1 unit specs: the editor-save demotion (§1.1), the
// XMP identity chain (§1.2 — end-to-end in the phase-2 acceptance) and family signs (§1.3).
// Each spec pins ONE guard so a break names its culprit; the fixture acceptance proves composition.
// [TESTED: 2026-07-27 · npm test green; guards verified by breaking the code first — see the
// commit's justification block]

import test from 'node:test';
import assert from 'node:assert/strict';
import { exifExtract, parseXmpDate, EDITOR_SOFTWARE_RE } from '../src/meta/exif.mjs';
import { resolveDate } from '../src/meta/resolve.mjs';
import { makeEvidence, formatWall } from '../src/meta/evidence.mjs';
import { familyFacts, familyEvidence, FAMILY_MIN_NEIGHBORS } from '../src/meta/family.mjs';
import { makeJpegEx } from './fixtures/make.mjs';

const NOW = new Date('2026-07-27T00:00:00Z');

// ---------------------------------------------------------------- §1.1 — the editor-save demotion

test('an editor export with no capture date yields editor-save, never exif-modify', () => {
  const { evidence, facts } = exifExtract(makeJpegEx({
    software: 'Adobe Photoshop CS3 Windows', dateTime: '2014:02:09 11:09:09',
    width: 2280, height: 2448, uniq: 'u1' }));
  assert.deepEqual(evidence.map(e => e.kind), ['editor-save']);
  assert.equal(formatWall(evidence[0].wall), '2014-02-09 11:09:09');
  assert.match(evidence[0].detail, /Adobe Photoshop/);
  assert.equal(facts.editor, true);
  assert.equal(facts.width, 2280);
  assert.equal(facts.height, 2448);
});

test('an editor export WITH a capture date is the healthy class — nothing is demoted', () => {
  const { evidence } = exifExtract(makeJpegEx({
    software: 'Picasa', dateTimeOriginal: '2013:07:04 10:11:12',
    dateTime: '2014:02:09 11:09:09', uniq: 'u2' }));
  assert.deepEqual(evidence.map(e => e.kind), ['exif-original', 'exif-modify']);
});

test('camera firmware in the Software tag is not an editor — exif-modify stays', () => {
  // real firmware strings look like GT-I9100XWLPG (researches/03) — a whitelist, not tag presence
  assert.equal(EDITOR_SOFTWARE_RE.test('GT-I9100XWLPG'), false);
  const { evidence, facts } = exifExtract(makeJpegEx({
    software: 'GT-I9100XWLPG', dateTime: '2014:02:09 11:09:09', uniq: 'u3' }));
  assert.deepEqual(evidence.map(e => e.kind), ['exif-modify']);
  assert.equal(facts.editor, undefined);
});

test('XMP dates parse as local wall time; the offset is dropped, not converted', () => {
  assert.equal(formatWall(parseXmpDate('2014-02-09T11:09:09+03:00')), '2014-02-09 11:09:09');
  assert.equal(formatWall(parseXmpDate('2014-02-09T11:09:09')), '2014-02-09 11:09:09');
  assert.equal(parseXmpDate('not a date'), null);
});

test('resolver: editor-save never determines — it lands in disputed as the ceiling it is', () => {
  const save = makeEvidence('editor-save', {
    wall: { year: 2014, month: 2, day: 9, hour: 11, minute: 9, second: 9 },
    detail: 'save date written by Adobe Photoshop CS3 Windows' });
  const alone = resolveDate([save], { now: NOW });
  assert.equal(alone.status, 'unknown', 'a save date alone must never date a file');
  assert.deepEqual(alone.disputed.map(d => d.reason), ['editor-save-date']);

  // …and when real evidence exists, it wins while the save date stays visibly rejected
  const filename = makeEvidence('filename-timestamp', {
    wall: { year: 2013, month: 7, day: 19, hour: 18, minute: 8, second: 41 } });
  const both = resolveDate([save, filename], { now: NOW });
  assert.equal(both.winner, 'filename-timestamp');
  assert.equal(both.date, '2013-07-19 18:08:41');
  assert.ok(both.disputed.some(d => d.reason === 'editor-save-date'));
});

// ---------------------------------------------------------------- §1.2 — the XMP identity chain

test('exifExtract reads the XMP identity chain: DocumentID and DerivedFrom', () => {
  const { facts: orig } = exifExtract(makeJpegEx({
    dateTimeOriginal: '2012:05:01 10:00:00', documentId: 'uuid:KPOT-ORIG-0001', uniq: 'u4' }));
  assert.equal(orig.documentId, 'uuid:KPOT-ORIG-0001');
  const { facts: exp } = exifExtract(makeJpegEx({
    software: 'Adobe Photoshop CS2 Windows', dateTime: '2015:03:03 09:00:00',
    derivedFromDocumentId: 'uuid:KPOT-ORIG-0001', uniq: 'u5' }));
  assert.equal(exp.derivedFrom, 'uuid:KPOT-ORIG-0001');
});

// ---------------------------------------------------------------- §1.3 — family signs

/** A dated neighbor shot on `model` in `year` with native dims. */
const neighbor = (path, model, year, width = 3264, height = 2448) => ({
  path, facts: { model, width, height },
  verdict: { status: 'dated', year, winner: 'exif-original', confidence: 'high' },
});

/** The undated editor export under test. */
const orphan = (width, height, saveYear = 2014, saveMonth = 2) => ({
  path: 'd/x.jpg', facts: { width, height, editor: true },
  verdict: { status: 'unknown' },
  evidence: [makeEvidence('editor-save', {
    wall: { year: saveYear, month: saveMonth, day: 1 }, dateOnly: true })],
});

test('family: one native side + a one-year fork → an assumed year, capped by the save ceiling', () => {
  const dir = [neighbor('d/a.jpg', 'GT-I9100', 2013), neighbor('d/b.jpg', 'GT-I9100', 2013),
               neighbor('d/c.jpg', 'GT-I9100', 2013)];
  const fam = familyFacts(orphan(2280, 2448), dir);
  assert.equal(fam.model, 'GT-I9100');
  assert.equal(fam.matchedBy, 'geometry');
  assert.deepEqual(fam.years, [2013, 2013]);
  assert.equal(fam.noLaterThan, '2014-02');
  const ev = familyEvidence(fam, 'd');
  assert.equal(ev.kind, 'family');
  assert.equal(ev.wall.year, 2013);
  assert.match(ev.detail, /GT-I9100/);
});

test('family: a multi-year fork narrates but never dates', () => {
  const dir = [neighbor('d/a.jpg', 'GT-I9100', 2011), neighbor('d/b.jpg', 'GT-I9100', 2012),
               neighbor('d/c.jpg', 'GT-I9100', 2013)];
  const fam = familyFacts(orphan(2280, 2448), dir);
  assert.deepEqual(fam.years, [2011, 2013], 'the fork itself is still told to the owner');
  assert.equal(familyEvidence(fam, 'd'), null, 'a fork is not a year');
});

test('family: a year AFTER the save ceiling is a contradiction, not evidence', () => {
  const dir = [neighbor('d/a.jpg', 'GT-I9100', 2015), neighbor('d/b.jpg', 'GT-I9100', 2015),
               neighbor('d/c.jpg', 'GT-I9100', 2015)];
  const fam = familyFacts(orphan(2280, 2448, 2014, 2), dir);   // saved Feb 2014, neighbors 2015
  assert.equal(familyEvidence(fam, 'd'), null, 'shot after it was saved — impossible');
});

test('family: geometry shared by two camera populations names no model', () => {
  const dir = [
    neighbor('d/a.jpg', 'GT-I9100', 2013), neighbor('d/b.jpg', 'GT-I9100', 2013),
    neighbor('d/c.jpg', 'GT-I9100', 2013),
    neighbor('d/p.jpg', 'iPhone 4', 2012, 2592, 2448), neighbor('d/q.jpg', 'iPhone 4', 2012, 2592, 2448),
    neighbor('d/r.jpg', 'iPhone 4', 2012, 2592, 2448),
  ];
  const fam = familyFacts(orphan(2280, 2448), dir);            // 2448 is native to BOTH
  assert.equal(fam.model, null, 'guessing between cameras is invented precision');
  assert.equal(fam.noLaterThan, '2014-02', 'the ceiling still reaches the owner');
});

test('family: fewer same-camera neighbors than the minimum say nothing', () => {
  const dir = [neighbor('d/a.jpg', 'GT-I9100', 2013), neighbor('d/b.jpg', 'GT-I9100', 2013)];
  assert.ok(dir.length < FAMILY_MIN_NEIGHBORS + 1);
  const fam = familyFacts(orphan(2280, 2448), dir);
  assert.equal(fam.model, null);
});

test('family: weak or assumed neighbors never feed a family (same bar as dir-cohort)', () => {
  const weak = (path) => ({ path, facts: { model: 'GT-I9100', width: 3264, height: 2448 },
    verdict: { status: 'partial', year: 2013, winner: 'family', confidence: 'low' } });
  const fam = familyFacts(orphan(2280, 2448), [weak('d/a.jpg'), weak('d/b.jpg'), weak('d/c.jpg')]);
  assert.equal(fam.model, null, 'an assumption must not compound into another assumption');
});
