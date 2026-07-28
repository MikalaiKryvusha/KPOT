// src/meta/resolve.mjs — the DateVerdict resolver: many Evidence claims in, ONE explainable
// verdict out. [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs — honesty rules + full fixture
// acceptance (every planted date recovered, undatables unknown); 55/55]
//
// This is RULE 3 executable: a verdict names its winner, keeps every claim it overruled (the
// disputed list — GOAL.md demands disputed cases be documented, so losers are data, not noise),
// and says *unknown* out loud instead of guessing. Three honesty rules baked in:
//
//   1. Implausible years (broken camera clocks: 1979 EXIF in the real archive) never win —
//      they go to `disputed`, and if nothing plausible remains the verdict is unknown.
//   2. fs-mtime NEVER determines a date. The real archive has 18 656 files "modified" on one
//      bulk-copy day (researches/02) — mtime is informational at best, and on a detected copy
//      spike it is explicitly discounted. Defaulting to mtime would fabricate chronology
//      (internal map, "Unknown is a real answer").
//   3. Year-only sources (dirname, bare filename year) produce a PARTIAL verdict — year (and the
//      owner's own season word, when the dir carries one), date honestly null.
//   4. An editor's save date (editor-save, plans/02 §1.1) NEVER determines — it is pushed to
//      disputed as the upper bound it is, so the owner sees why the file lost its false year.
//   5. A RESET CAMERA CLOCK is not a date (owner's decision, 2026-07-28). A claim of 1 January just
//      after midnight is what a camera shows when its battery has been out — but a real New Year
//      photograph has the same shape, so the shape alone decides nothing. It is rejected only when
//      the archive itself proves the clock was wrong: the claimed year is earlier than the earliest
//      year ANY trustworthy capture claim in the whole collection reports. The owner asked for
//      exactly that condition — «сброшенным часам камеры не доверять, ЕСЛИ это факт, что они
//      сброшены» — so suspicion is not enough; the collection has to contradict the claim.

import { EVIDENCE_RANK, formatWall, isPlausibleYear, isResetClockShape, makeEvidence } from './evidence.mjs';

/** Kinds that can only ever narrow the date to a year(+season) — they yield 'partial' verdicts. */
const PARTIAL_KINDS = new Set(['dirname', 'filename-year', 'family', 'dir-cohort']);

/** Kinds whose verdict is a flagged ASSUMPTION the plan must surface to the owner. */
const ASSUMED_KINDS = new Set(['family', 'dir-cohort']);

/** Spike detection defaults: a UTC day owning ≥ MIN_COUNT files AND ≥ MIN_SHARE of them is a bulk-copy artifact. */
export const SPIKE_MIN_COUNT = 3;
export const SPIKE_MIN_SHARE = 0.1;

const utcDayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Find bulk-copy mtime spikes across a corpus: UTC days that own an implausibly large share of
 * all files' mtimes. Run once per scan, over MEDIA files' mtimes.
 * @param {number[]} mtimesMs
 * @returns {Set<string>}  spiked days as 'YYYY-MM-DD'
 */
export function detectMtimeSpikeDays(mtimesMs, { minCount = SPIKE_MIN_COUNT, minShare = SPIKE_MIN_SHARE } = {}) {
  const perDay = new Map();
  for (const ms of mtimesMs) {
    const day = utcDayOf(ms);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const spiked = new Set();
  for (const [day, count] of perDay) {
    if (count >= minCount && count / mtimesMs.length >= minShare) spiked.add(day);
  }
  return spiked;
}

/**
 * The fs-mtime claim for one file — informational evidence, discounted on a detected copy spike.
 * @param {number} mtimeMs
 * @param {Set<string>} spikeDays  from detectMtimeSpikeDays
 * @returns {object[]}
 */
export function mtimeEvidence(mtimeMs, spikeDays = new Set()) {
  const spiked = spikeDays.has(utcDayOf(mtimeMs));
  const ev = makeEvidence('fs-mtime', {
    instant: new Date(mtimeMs),
    detail: spiked ? 'mtime-copy-spike' : 'mtime',
  });
  if (spiked) ev.discounted = true;
  return [ev];
}

/** The year a claim asserts (wall year, or the instant's UTC year — good enough for plausibility). */
const claimYear = (ev) => (ev.wall ? ev.wall.year : ev.instant.getUTCFullYear());

/**
 * Resolve one file's evidence list into a DateVerdict.
 *
 * @param {object[]} evidence  Evidence objects (any order; the resolver sorts by rank)
 * @param {{now?: Date}} [opts]  injectable clock for plausibility
 * @returns {{status: 'dated'|'partial'|'unknown', date: string|null, dateOnly: boolean,
 *            instant: Date|null, year: number|null, season: string|null,
 *            confidence: string|null, winner: string|null, corroborated: boolean,
 *            evidence: object[], disputed: Array<{kind: string, detail?: string, reason: string}>}}
 */
export function resolveDate(evidence, { now = new Date(), resetFloorYear = null } = {}) {
  const sorted = [...evidence].sort((a, b) => EVIDENCE_RANK[a.kind] - EVIDENCE_RANK[b.kind]);
  const disputed = [];
  const candidates = [];

  for (const ev of sorted) {
    if (!isPlausibleYear(claimYear(ev), now)) {
      disputed.push({ kind: ev.kind, detail: ev.detail, reason: 'implausible-year' });
      continue;
    }
    // A camera whose battery was out shows 1 January, just after midnight (rule 5 above). The SHAPE
    // is not enough to reject — a real New Year photograph looks identical — so the claim is only
    // distrusted when the archive itself proves the clock was wrong: its year is EARLIER than the
    // earliest year any trustworthy capture claim in this whole collection reports.
    if (resetFloorYear !== null && ev.wall && isResetClockShape(ev.wall) && ev.wall.year < resetFloorYear) {
      disputed.push({ kind: ev.kind, detail: ev.detail, reason: 'reset-camera-clock' });
      continue;
    }
    if (ev.kind === 'fs-mtime') continue; // informational only — never a candidate (rule 2 above)
    if (ev.kind === 'editor-save') {
      // plans/02 §1.1 — an editor's save date is an upper bound, never a capture claim. Unlike
      // mtime it is pushed to disputed EXPLICITLY: the owner must see why this file lost the date
      // it used to be (wrongly) shelved by.
      disputed.push({ kind: ev.kind, detail: ev.detail, reason: 'editor-save-date' });
      continue;
    }
    candidates.push(ev);
  }

  const verdict = {
    status: 'unknown', date: null, dateOnly: false, instant: null,
    year: null, season: null, confidence: null, winner: null, corroborated: false,
    assumed: false, evidence: sorted, disputed,
  };
  if (candidates.length === 0) return verdict;

  const winner = candidates[0];
  verdict.winner = winner.kind;
  verdict.confidence = winner.confidence;
  verdict.year = claimYear(winner);
  // an inferred year (camera family or dir cohort) is a flagged GUESS — the plan phase must
  // surface it to the owner
  verdict.assumed = ASSUMED_KINDS.has(winner.kind);

  if (PARTIAL_KINDS.has(winner.kind)) {
    verdict.status = 'partial';
    verdict.season = winner.season ?? null;
  } else if (winner.wall) {
    verdict.status = 'dated';
    verdict.date = formatWall(winner.wall);
    verdict.dateOnly = winner.dateOnly;
  } else {
    verdict.status = 'dated';
    verdict.instant = winner.instant; // UTC — local conversion is the plan phase's decision
  }

  // Losers: same year = corroboration; a different year = a real conflict the owner must see.
  for (const ev of candidates.slice(1)) {
    if (claimYear(ev) === verdict.year) verdict.corroborated = true;
    else disputed.push({ kind: ev.kind, detail: ev.detail, reason: 'conflicts-with-winner' });
  }
  return verdict;
}
