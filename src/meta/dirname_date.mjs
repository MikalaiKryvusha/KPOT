// src/meta/dirname_date.mjs — date evidence from the ENCLOSING DIRECTORY names.
// [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs — owner spellings, innermost-wins, implausible
// years rejected; 55/55]
//
// The owner already sorts by hand: year dirs (`2013/`) and season dirs in several spellings
// (`Весна 2013`, `Зима_2020`, `осень 2013`) exist in the real archive, and directory names carry a
// year for 54% of all files (researches/02 §Directory structure). So an ancestor dir name is
// medium-strength evidence — often the ONLY evidence for scans and EXIF-less photos.
//
// The claim is deliberately partial: a year (wall {year,1,1}, dateOnly) plus, when a season word is
// present, the observed season — the resolver turns this into a *partial* verdict (year/season
// known, exact date honestly unknown) instead of fabricating a date.

import { makeEvidence, isPlausibleYear } from './evidence.mjs';

/** Season words as the owner writes them (case-insensitive match, normalized to lowercase). */
const SEASON_WORDS = ['зима', 'весна', 'лето', 'осень'];
const SEASON_RE = new RegExp(`(?:^|[^а-яё])(${SEASON_WORDS.join('|')})(?:[^а-яё]|$)`, 'i');
const YEAR_RE = /(?:^|[^\d])((?:19|20)\d{2})(?=[^\d]|$)/;

/**
 * Date evidence from a file's relative path (its directory part; '/'-separated as scan emits it).
 * The INNERMOST informative segment wins — `2013/осень 2013/x.jpg` yields year 2013 + season
 * "осень" from the deeper segment, not two competing claims.
 *
 * @param {string} relPath  e.g. '2013/осень 2013/день рождения.jpg'
 * @param {{now?: Date}} [opts]  injectable clock for the year plausibility check
 * @returns {object[]}  zero or one 'dirname' Evidence
 */
export function dirnameEvidence(relPath, { now = new Date() } = {}) {
  const segments = relPath.split('/').slice(0, -1); // directories only, outer→inner
  for (let i = segments.length - 1; i >= 0; i--) {  // innermost informative segment wins
    const seg = segments[i];
    const yearMatch = YEAR_RE.exec(seg);
    const year = yearMatch && Number(yearMatch[1]);
    if (!year || !isPlausibleYear(year, now)) continue;
    const seasonMatch = SEASON_RE.exec(seg);
    return [makeEvidence('dirname', {
      wall: { year, month: 1, day: 1 },
      dateOnly: true,
      detail: seg,
      ...(seasonMatch ? { season: seasonMatch[1].toLowerCase() } : {}),
    })];
  }
  return [];
}
