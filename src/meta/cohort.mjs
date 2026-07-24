// src/meta/cohort.mjs — the "neighbors in the same directory" year inference.
// [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs (consensus/mixed/small/weak dirs + fixture
// acceptance case) + CLI smoke: IMAG0181 → assumed 2011, single-file dirs untouched; 56/56]
//
// Owner-approved heuristic (chat, 2026-07-24; file-size dating explicitly rejected): if a
// directory's confidently-dated media points overwhelmingly at one year — a classic device-dump
// dir where most shots carry EXIF — then an undatable neighbor PROBABLY belongs to that year too.
//
// Honesty contract for this evidence (the reason it is safe to have at all):
//   • it is an ASSUMPTION, ranked just above mtime, confidence 'low', and verdicts it wins are
//     flagged `assumed` — the plan phase must show these to the owner as guesses, never silently;
//   • it fires only on strong consensus (≥ COHORT_MIN_NEIGHBORS confident files, ≥ COHORT_MIN_SHARE
//     of them on one year) — a mixed folder of many years yields nothing;
//   • it can only ever narrow to a YEAR (partial verdict) — never a date.

import { makeEvidence } from './evidence.mjs';

/** Minimum confidently-dated neighbors before a dir is a cohort at all. */
export const COHORT_MIN_NEIGHBORS = 3;
/** Minimum share of those neighbors that must agree on ONE year. */
export const COHORT_MIN_SHARE = 0.8;

const dirOf = (relPath) => relPath.split('/').slice(0, -1).join('/');

/** A neighbor counts toward a cohort only when its own year is NOT itself a weak guess. */
function isConfident(verdict) {
  return verdict != null && verdict.year != null
    && verdict.winner !== 'dir-cohort' && verdict.confidence !== 'low';
}

/**
 * Corpus pass: which directories have a year consensus, and what year.
 * @param {object[]} mediaAssets  assets already carrying `verdict` (first resolve pass done)
 * @param {{minNeighbors?: number, minShare?: number}} [opts]
 * @returns {Map<string, {year: number, count: number}>}  dir → consensus
 */
export function cohortYearByDir(mediaAssets, { minNeighbors = COHORT_MIN_NEIGHBORS, minShare = COHORT_MIN_SHARE } = {}) {
  const perDir = new Map(); // dir → Map<year, count>
  for (const a of mediaAssets) {
    if (!isConfident(a.verdict)) continue;
    const dir = dirOf(a.path);
    if (!perDir.has(dir)) perDir.set(dir, new Map());
    const years = perDir.get(dir);
    years.set(a.verdict.year, (years.get(a.verdict.year) ?? 0) + 1);
  }
  const consensus = new Map();
  for (const [dir, years] of perDir) {
    const total = [...years.values()].reduce((s, n) => s + n, 0);
    const [topYear, topCount] = [...years.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCount >= minNeighbors && topCount / total >= minShare) {
      consensus.set(dir, { year: topYear, count: topCount });
    }
  }
  return consensus;
}

/**
 * The dir-cohort Evidence for one undatable file in a consensus directory.
 * @param {{year: number, count: number}} cohort  from cohortYearByDir
 * @param {string} dir  the directory (provenance for the owner-facing report)
 * @returns {object}
 */
export function cohortEvidence({ year, count }, dir) {
  return makeEvidence('dir-cohort', {
    wall: { year, month: 1, day: 1 },
    dateOnly: true,
    detail: `${count} dated neighbors in '${dir}'`,
  });
}
