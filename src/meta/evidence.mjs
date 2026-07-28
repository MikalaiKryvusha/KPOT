// src/meta/evidence.mjs — the date-evidence model: what a "date claim" about a file looks like,
// where claims can come from, and how strongly each source is trusted.
// [TESTED: 2026-07-24 · tests/meta_evidence.test.mjs — 5 specs; suite 40/40 green]
//
// This is the data model behind RULE 3 ("evidence, not guesses"): a date is never a bare value —
// it is a claim carried by a piece of Evidence, and the Phase-2 DateVerdict resolver will weigh a
// file's evidence list by the precedence encoded here. Precedence is seeded from Elodie's
// field-proven order (researches/01_prior_art.md §5: DateTimeOriginal → CreateDate/QuickTime →
// ModifyDate → fs times) interleaved with the tiers observed in the owner's real archive
// (researches/02 §Implications: EXIF → filename timestamp/epoch → dirname → sidecar → mtime,
// with mtime bulk-copy spikes discounted).
//
// Two shapes of date claim, kept deliberately distinct:
//   • wall    — naive local wall-clock components {year..second}, no timezone. What camera EXIF
//               and `IMG_20140121_183801`-style names actually encode.
//   • instant — an absolute UTC moment (a JS Date). What epoch filenames and MP4 `mvhd` encode.
//               Converting an instant to a year/season is a *plan-phase* decision (owner's local
//               time), not something this layer does silently.

/** Evidence kinds, strongest first. The array IS the precedence order for the Phase-2 resolver.
 * NOTE on wall-vs-instant ordering (EXP-0004): the library buckets by LOCAL year/season, so at the
 * same trust tier a wall-clock source (what the device wrote in local time) outranks a UTC instant
 * (mvhd, epoch) whose timezone is unknown — an instant can mis-shelve a midnight/New-Year shot.
 * Instants still win when no wall source exists, and corroborate when both agree. */
export const EVIDENCE_PRECEDENCE = Object.freeze([
  'exif-original',       // EXIF DateTimeOriginal — the shutter moment (wall)
  'derived-original',    // the ORIGINAL file's DateTimeOriginal, inherited via an exact XMP
                         // DocumentID ↔ DerivedFrom match (plans/02 §1.2) — a real shutter moment,
                         // just read from the file this one was exported from
  'pixel-original',      // the ORIGINAL's DateTimeOriginal, inherited after finding that original
                         // BY ITS PIXELS among the same-camera neighbours (plans/02 §Шаг 2,
                         // designed by researches/05 §7). Also a real shutter moment read from
                         // another file — one notch below the XMP chain because that match is an
                         // exact identifier and this one is a decisive comparison
  'filename-timestamp',  // full date(+time) written into the name by the device (wall)
  'container-created',   // MP4/MOV mvhd or QuickTime creation date (instant, UTC)
  'filename-epoch',      // unix epoch in the name, seconds or ms (instant)
  'exif-modify',         // EXIF ModifyDate — edited/exported time, weaker than original
  'sidecar',             // THM/XMP twin file's metadata, inherited by the media file
  'dirname',             // year and/or season in an ancestor directory name (owner's hand-sorting)
  'filename-year',       // a bare year somewhere in the name — weak
  'family',              // camera-family inference: same-camera neighbors' year range narrowed to
                         // one year (plans/02 §1.3) — always an assumption, like dir-cohort but
                         // camera-filtered, hence one notch stronger
  'dir-cohort',          // INFERRED from confidently-dated neighbors in the same dir (owner-approved
                         // 2026-07-24); always an assumption — verdicts flag it and plans surface it
  'editor-save',         // a photo EDITOR's save date on a file with no capture date (plans/02
                         // §1.1) — an upper bound («снято не позже»), NEVER determines a verdict
  'fs-mtime',            // filesystem mtime — weakest; bulk-copy spikes make it lie (researches/02)
]);

/** kind → rank (0 = strongest). Lower rank wins in the resolver. */
export const EVIDENCE_RANK = Object.freeze(
  Object.fromEntries(EVIDENCE_PRECEDENCE.map((kind, i) => [kind, i])),
);

/** Default confidence class per kind — the resolver's starting point, not its verdict. */
export const DEFAULT_CONFIDENCE = Object.freeze({
  'exif-original': 'high',
  'derived-original': 'high',
  'pixel-original': 'high',
  'filename-timestamp': 'high',
  'container-created': 'high',
  'filename-epoch': 'high',
  'exif-modify': 'medium',
  'sidecar': 'medium',
  'dirname': 'medium',
  'filename-year': 'low',
  'family': 'low',
  'dir-cohort': 'low',
  'editor-save': 'low',
  'fs-mtime': 'low',
});

// --- Plausibility window -----------------------------------------------------------------------
// The owner's real archive contains EXIF dates from 1979/1980 — broken camera clocks
// (researches/02 §Filesystem times). A claimed capture year outside this window is not evidence,
// it is a defect to be surfaced as disputed. Consumer digital photography does not predate 1990.

/** Earliest capture year we accept as plausible. */
export const MIN_PLAUSIBLE_YEAR = 1990;
/** Slack over "now" for clocks slightly ahead (New Year timezone edge, camera drift). */
export const MAX_FUTURE_YEARS = 1;

/**
 * Is `year` a plausible capture year?
 * @param {number} year
 * @param {Date} [now]  injectable for deterministic tests
 * @returns {boolean}
 */
export function isPlausibleYear(year, now = new Date()) {
  return Number.isInteger(year)
    && year >= MIN_PLAUSIBLE_YEAR
    && year <= now.getFullYear() + MAX_FUTURE_YEARS;
}

/**
 * Does this claim have the SHAPE of a camera whose clock was reset — 1 January, in the first hour
 * after midnight? That is what a camera shows after the battery has been out: the manufacturer's
 * default date, plus however long the owner then spent taking pictures.
 *
 * The shape ALONE proves nothing, and this function is deliberately not a rejection rule: a New
 * Year photograph taken at 00:25 on 1 January has exactly the same shape and is perfectly real.
 * The resolver only distrusts such a claim when the archive itself says the clock must have been
 * wrong — see `resolveDate`'s `resetFloorYear` (the owner's rule, 2026-07-28: «сброшенным часам
 * камеры не доверять, ЕСЛИ это факт, что они сброшены»).
 *
 * @param {{year:number,month:number,day:number,hour?:number}} [wall]
 * @returns {boolean}
 */
export function isResetClockShape(wall) {
  return Boolean(wall) && wall.month === 1 && wall.day === 1 && (wall.hour ?? 0) === 0;
}

// --- Wall-clock helpers ------------------------------------------------------------------------

/** Days per month, February resolved per year (leap rules). */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based here → day 0 of next
}

/**
 * Validate naive wall-clock components. Date-only claims pass hour/min/sec as 0.
 * @param {{year: number, month: number, day: number, hour?: number, minute?: number, second?: number}} w
 * @returns {boolean}
 */
export function isValidWall({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  return Number.isInteger(year) && year >= 1 && year <= 9999
    && Number.isInteger(month) && month >= 1 && month <= 12
    && Number.isInteger(day) && day >= 1 && day <= daysInMonth(year, month)
    && Number.isInteger(hour) && hour >= 0 && hour <= 23
    && Number.isInteger(minute) && minute >= 0 && minute <= 59
    && Number.isInteger(second) && second >= 0 && second <= 60; // 60: leap-second tolerance
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/**
 * Canonical display/ground-truth format for a wall claim: `YYYY-MM-DD HH:MM:SS`
 * (the format `tests/fixtures` `expected.json` uses).
 * @param {{year:number,month:number,day:number,hour?:number,minute?:number,second?:number}} w
 * @returns {string}
 */
export function formatWall({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

// --- Evidence constructor ----------------------------------------------------------------------

/**
 * Build one Evidence object — a single dated claim about a file from a single source.
 * Exactly one of `wall` / `instant` must be present; shape and kind are validated loudly, because
 * malformed evidence would corrupt verdicts silently downstream.
 *
 * @param {string} kind  one of EVIDENCE_PRECEDENCE
 * @param {object} claim
 * @param {{year:number,month:number,day:number,hour?:number,minute?:number,second?:number}} [claim.wall]
 * @param {Date} [claim.instant]
 * @param {boolean} [claim.dateOnly]  true when the source carries a date but no time of day
 * @param {string} [claim.detail]    human-readable provenance, e.g. the matched pattern id
 * @param {string} [claim.season]    observed season word (dirname evidence: owner's own "осень" dirs)
 * @returns {{kind: string, rank: number, confidence: string,
 *            wall?: object, instant?: Date, dateOnly: boolean, detail?: string, season?: string}}
 */
export function makeEvidence(kind, { wall, instant, dateOnly = false, detail, season } = {}) {
  if (!(kind in EVIDENCE_RANK)) {
    throw new RangeError(`unknown evidence kind: ${kind}`);
  }
  if ((wall === undefined) === (instant === undefined)) {
    throw new TypeError(`evidence needs exactly one of wall/instant (kind: ${kind})`);
  }
  if (wall !== undefined && !isValidWall(wall)) {
    throw new RangeError(`invalid wall-clock claim for ${kind}: ${JSON.stringify(wall)}`);
  }
  if (instant !== undefined && !(instant instanceof Date && Number.isFinite(instant.getTime()))) {
    throw new TypeError(`instant must be a valid Date (kind: ${kind})`);
  }
  return {
    kind,
    rank: EVIDENCE_RANK[kind],
    confidence: DEFAULT_CONFIDENCE[kind],
    ...(wall !== undefined ? { wall } : { instant }),
    dateOnly,
    ...(detail !== undefined ? { detail } : {}),
    ...(season !== undefined ? { season } : {}),
  };
}
