// src/meta/dirname_date.mjs — date evidence from the ENCLOSING DIRECTORY names.
// [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs — owner spellings, innermost-wins, implausible
// years rejected · 2026-07-26 · tests/idempotence.test.mjs — year and season in SEPARATE segments
// (`2013/Осень/`), and a different year in a deeper segment is never crossed (bug 01)]
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
 * The year and the season may live in DIFFERENT segments. The owner writes them together
 * (`осень 2013`), which is what this extractor was originally built and tested against — but KPOT's
 * own output splits them (`2013/Осень/`), and reading only the year-bearing segment silently dropped
 * the season there, demoting an already-correctly-shelved file to `<год>/прочее` on the next run
 * (bug 01). So once the innermost year is found, the season is looked for in that segment and in any
 * segment BELOW it — deeper wins, since it is the more specific statement about this file.
 *
 * @param {string} relPath  e.g. '2013/осень 2013/день рождения.jpg' or '2013/Осень/день рождения.jpg'
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

    // Innermost season at or below the year segment. A segment carrying a DIFFERENT year is not
    // crossed: `2013/2014 поездка/` must not lend its season to the 2013 claim.
    let season = null, seasonSeg = null;
    for (let j = segments.length - 1; j >= i; j--) {
      const other = YEAR_RE.exec(segments[j]);
      if (j !== i && other && Number(other[1]) !== year) continue;
      const m = SEASON_RE.exec(segments[j]);
      if (m) { season = m[1].toLowerCase(); seasonSeg = segments[j]; break; }
    }

    return [makeEvidence('dirname', {
      wall: { year, month: 1, day: 1 },
      dateOnly: true,
      detail: seasonSeg && seasonSeg !== seg ? `${seg}/${seasonSeg}` : seg,
      ...(season ? { season } : {}),
    })];
  }
  return [];
}
