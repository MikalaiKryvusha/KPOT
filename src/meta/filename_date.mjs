// src/meta/filename_date.mjs — date evidence from a file's NAME.
// [TESTED: 2026-07-24 · tests/meta_filename_date.test.mjs — verified against the fixture catalog's
// planted ground truth + survey conventions; suite 40/40 green]
//
// 44% of the owner's real archive carries a decodable date in the basename alone
// (researches/02 §Filename patterns) — this module is that survey's ordered first-match-wins
// classifier, productized: every detector that fires yields an Evidence object
// (src/meta/evidence.mjs), ordered strongest-first, so the Phase-2 resolver can weigh and
// corroborate (e.g. `2011-05-09 PIC16(1304952444364).jpg` legitimately yields TWO claims).
//
// Two claim shapes, and the distinction matters:
//   • device-written digits (`IMG_20140121_183801`) are LOCAL WALL-CLOCK time → `wall` claim;
//   • epoch numbers (`1374250121884`, `photo1711295489`) are ABSOLUTE UTC → `instant` claim.
// Epoch detectors sanity-check the decoded range (survey's explicit warning) — ten digits that
// decode to 1972 are a random number, not a timestamp. Structural validity (month 13, day 32) is
// checked here; *plausibility* of a well-formed year (broken 1979 clock) is the resolver's job.

import {
  makeEvidence, isPlausibleYear, isValidWall, MAX_FUTURE_YEARS,
} from './evidence.mjs';

/** Epoch-named files only exist in the smartphone/JS era — decoded years below this are noise. */
/**
 * Earliest year a filename-epoch claim may decode to — **2008, the year the convention itself
 * began** (Android 1.0 shipped September 2008; the messengers that use it came later).
 *
 * This is not a guess about how old the owner's photos are; it is a statement about the naming
 * convention. Epoch-in-filename is produced by Android and by messaging apps, so a decode landing
 * before they existed contradicts itself, and is evidence of a **sequential identifier** rather
 * than of an old photograph. Samsung's gallery IDs are the real case that forced this (bug 02):
 * `1000018552.jpg` is an ID, but read as epoch seconds it lands convincingly on 2001-09-09 and
 * dragged a 2024 photo into a year the archive has nothing in. IDs and epochs are the same shape,
 * so no regex separates them — the self-contradiction is the only local signal that does.
 *
 * Checked against the real archive sample: the earliest legitimate epoch decode there is 2011-08-04,
 * so this bound rejects fabrications without touching a single correct reading.
 */
export const EPOCH_MIN_YEAR = 2008;

/** Basename → stem (extension off). Keeps dot-files (`.nomedia`) and Cyrillic "extensions" whole. */
function stemOf(basename) {
  const dot = basename.lastIndexOf('.');
  return dot > 0 ? basename.slice(0, dot) : basename;
}

/** Build a wall claim from regex capture strings; null when structurally invalid (day 32 etc.). */
function wallFrom([y, mo, d, h = '0', mi = '0', s = '0']) {
  const wall = {
    year: Number(y), month: Number(mo), day: Number(d),
    hour: Number(h), minute: Number(mi), second: Number(s),
  };
  return isValidWall(wall) ? wall : null;
}

/** Decode an epoch string (10 digits = seconds, 13 = milliseconds) with the range sanity check. */
function epochInstant(digits, now) {
  const ms = digits.length === 13 ? Number(digits) : Number(digits) * 1000;
  const instant = new Date(ms);
  const year = instant.getUTCFullYear();
  if (year < EPOCH_MIN_YEAR || year > now.getFullYear() + MAX_FUTURE_YEARS) return null;
  return instant;
}

// ---------------------------------------------------------------------------------------------
// The detector table — ORDER IS PRIORITY (mirrors the survey's first-match-wins prototype).
// Each detector: (stem, now) → makeEvidence(...) or null. Specific device conventions first,
// generic "a date is in there somewhere" scavengers last with confidence demoted to 'medium'/'low'.
// ---------------------------------------------------------------------------------------------

const DETECTORS = [
  // Android camera/gallery: IMG_/VID_/PANO_/BURST_YYYYMMDD_HHMMSS (18 400 + 1 740 + 59 real files)
  { id: 'android-camera',
    detect(stem) {
      const m = /^(?:IMG|VID|PANO|BURST)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i.exec(stem);
      const wall = m && wallFrom(m.slice(1));
      return wall && makeEvidence('filename-timestamp', { wall, detail: 'android-camera' });
    } },
  // Android screenshots: Screenshot_YYYY-MM-DD-HH-MM-SS[-ms][_app] (3 432 real files)
  { id: 'screenshot',
    detect(stem) {
      const m = /^Screenshot[ _-](\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/i.exec(stem);
      const wall = m && wallFrom(m.slice(1));
      return wall && makeEvidence('filename-timestamp', { wall, detail: 'screenshot' });
    } },
  // WhatsApp: IMG-/VID-/AUD-YYYYMMDD-WA#### — date only, no time of day
  { id: 'whatsapp',
    detect(stem) {
      const m = /^(?:IMG|VID|AUD)-(\d{4})(\d{2})(\d{2})-WA\d+/i.exec(stem);
      const wall = m && wallFrom(m.slice(1));
      return wall && makeEvidence('filename-timestamp', { wall, dateOnly: true, detail: 'whatsapp' });
    } },
  // Windows Phone: WP_YYYYMMDD_### — date only
  { id: 'windows-phone',
    detect(stem) {
      const m = /^WP_(\d{4})(\d{2})(\d{2})_/i.exec(stem);
      const wall = m && wallFrom(m.slice(1));
      return wall && makeEvidence('filename-timestamp', { wall, dateOnly: true, detail: 'windows-phone' });
    } },
  // iOS/Dropbox export: YYYY-MM-DD hh.mm.ss (41 real files)
  { id: 'ios-dotted',
    detect(stem) {
      const m = /^(\d{4})-(\d{2})-(\d{2})[ _](\d{2})\.(\d{2})\.(\d{2})/.exec(stem);
      const wall = m && wallFrom(m.slice(1));
      return wall && makeEvidence('filename-timestamp', { wall, detail: 'ios-dotted' });
    } },
  // A leading plain ISO date: `2011-05-09 PIC16…` — date only
  { id: 'leading-iso-date',
    detect(stem) {
      const m = /^(\d{4})-(\d{2})-(\d{2})(?:\D|$)/.exec(stem);
      const wall = m && wallFrom(m.slice(1, 4));
      return wall && makeEvidence('filename-timestamp', { wall, dateOnly: true, detail: 'leading-iso-date' });
    } },
  // Telegram-ish: photo<epoch-seconds> (72 real files)
  { id: 'telegram-photo',
    detect(stem, now) {
      const m = /^photo(\d{10})$/i.exec(stem);
      const instant = m && epochInstant(m[1], now);
      return instant && makeEvidence('filename-epoch', { instant, detail: 'telegram-photo' });
    } },
  // Whole stem is an epoch number: 13-digit ms (`1374250121884`) or 10-digit seconds (7 895 real files)
  { id: 'epoch-stem',
    detect(stem, now) {
      const m = /^(\d{10}|\d{13})$/.exec(stem);
      const instant = m && epochInstant(m[1], now);
      return instant && makeEvidence('filename-epoch', { instant, detail: 'epoch-stem' });
    } },
  // Epoch in parentheses: `2011-05-09 PIC16(1304952444364)` — the second claim in a double-dated name
  { id: 'paren-epoch',
    detect(stem, now) {
      const m = /\((\d{10}|\d{13})\)/.exec(stem);
      const instant = m && epochInstant(m[1], now);
      return instant && makeEvidence('filename-epoch', { instant, detail: 'paren-epoch' });
    } },
  // Scavenger: compact YYYYMMDD[_-]HHMMSS anywhere in the name (demoted — context unknown)
  { id: 'compact-anywhere',
    detect(stem) {
      const m = /(?:^|[^\d])(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?=[^\d]|$)/.exec(stem);
      const wall = m && wallFrom(m.slice(1));
      const ev = wall && makeEvidence('filename-timestamp', { wall, detail: 'compact-anywhere' });
      if (ev) ev.confidence = 'medium';
      return ev;
    } },
  // Scavenger: plain ISO date anywhere (`fix_…_2024-04-24_<uuid>_4k`) — date only, demoted
  { id: 'iso-date-anywhere',
    detect(stem) {
      const m = /(?:^|[^\d])(\d{4})-(\d{2})-(\d{2})(?=[^\d]|$)/.exec(stem);
      const wall = m && wallFrom(m.slice(1, 4));
      const ev = wall && makeEvidence('filename-timestamp', { wall, dateOnly: true, detail: 'iso-date-anywhere' });
      if (ev) ev.confidence = 'medium';
      return ev;
    } },
  // Weakest: a standalone plausible year (17 858 real files have "a year somewhere")
  { id: 'year-anywhere',
    detect(stem, now) {
      const m = /(?:^|[^\d])((?:19|20)\d{2})(?=[^\d]|$)/.exec(stem);
      const year = m && Number(m[1]);
      if (!year || !isPlausibleYear(year, now)) return null;
      return makeEvidence('filename-year', { wall: { year, month: 1, day: 1 }, dateOnly: true,
                                             detail: 'year-anywhere' });
    } },
];

/**
 * All date evidence a basename yields, in detector-priority order (strongest first).
 * Later detectors that merely re-see the same digits as an earlier one are suppressed only by
 * regex specificity, not dedup — the resolver treats agreeing claims as corroboration.
 *
 * @param {string} basename  the file's name (with extension; no directory)
 * @param {{now?: Date}} [opts]  injectable clock for deterministic tests
 * @returns {object[]}  Evidence objects (see src/meta/evidence.mjs), possibly empty
 */
export function allNameEvidence(basename, { now = new Date() } = {}) {
  const stem = stemOf(basename);
  const found = [];
  for (const d of DETECTORS) {
    const ev = d.detect(stem, now);
    if (ev) found.push(ev);
  }
  return found;
}

/**
 * The single strongest name-derived claim, or null for undatable names
 * (`DSC01304.JPG`, `6V2qnCITQIE.jpg`, `image.jpg` — EXIF's job, not ours).
 * @param {string} basename
 * @param {{now?: Date}} [opts]
 * @returns {object|null}
 */
export function bestNameEvidence(basename, opts) {
  return allNameEvidence(basename, opts)[0] ?? null;
}
