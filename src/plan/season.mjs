// src/plan/season.mjs — month → season-bucket mapping.
// [TESTED: 2026-07-24 · tests/season.test.mjs — all 12 months + invalid inputs; suite 15/15 green]
//
// The season boundaries are an OWNER DECISION (interview #001 Q2, 2026-07-24) — do not "fix" them:
//   Зима начало года = Jan–Feb · Весна = Mar–May · Лето = Jun–Aug · Осень = Sep–Nov ·
//   Зима конец года = Dec.
// The two winters are deliberately separate buckets so a year's directory listing reads
// chronologically. Files with a certain year but no certain month go to the per-year 'прочее'
// bucket — that is the caller's (plan-phase) responsibility, not this function's.
//
// Bucket values are the CANONICAL target directory names (owner's format, Russian — GOAL.md).

/** Canonical season directory names, in chronological order within a year. */
export const SEASONS = Object.freeze({
  WINTER_START: 'Зима начало года',
  SPRING: 'Весна',
  SUMMER: 'Лето',
  AUTUMN: 'Осень',
  WINTER_END: 'Зима конец года',
});

/** Chronological order of season dirs — used for sorting listings and for tests. */
export const SEASON_ORDER = Object.freeze([
  SEASONS.WINTER_START, SEASONS.SPRING, SEASONS.SUMMER, SEASONS.AUTUMN, SEASONS.WINTER_END,
]);

/**
 * Map a calendar month to its season directory name.
 * @param {number} month  1–12 (January = 1, as humans and EXIF write it — NOT Date's 0-based month)
 * @returns {string} one of SEASONS
 * @throws {RangeError} on anything that is not an integer 1–12 — a wrong month here means a file
 *         would land in the wrong place, so this fails loudly instead of guessing.
 */
export function seasonForMonth(month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be an integer 1..12, got: ${month}`);
  }
  if (month <= 2) return SEASONS.WINTER_START;   // Jan, Feb
  if (month <= 5) return SEASONS.SPRING;         // Mar, Apr, May
  if (month <= 8) return SEASONS.SUMMER;         // Jun, Jul, Aug
  if (month <= 11) return SEASONS.AUTUMN;        // Sep, Oct, Nov
  return SEASONS.WINTER_END;                     // Dec
}
