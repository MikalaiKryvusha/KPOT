// src/meta/sidecar.mjs — sidecar evidence: a THM/XMP twin file donates its capture date to the
// media file it describes.
// [TESTED: 2026-07-28 · tests/meta_sidecar.test.mjs (13 specs) + the Phase-2 acceptance case;
//  all five guards verified by breaking them first (1/5/3/1/1 specs go red). Real data, read-only:
//  the archive's 25 THM-twinned videos went from `partial` (a year, no season) to `dated` to the
//  second — 25/25 winner `sidecar`, 0 errors. The XMP DATE path is fixture-only: the single real
//  .xmp carries no date at all (researches/04 §5), and no observation claims otherwise.]
//
// The last deliberate cut of Phase 2, deferred until a fixture case existed (MASTER_PLAN §Phase 2).
// The `sidecar` evidence kind and its rank have been in `evidence.mjs` since then; this is the
// collector that finally fills it.
//
// Everything here is coded FROM `researches/04_sidecars.md`, which read the real files rather than
// recalling the format. The three facts that shape this module:
//
//   1. A `.thm` IS a JPEG — a 160x120 camera thumbnail with a full EXIF block. All 34 in the
//      owner's archive carry `DateTimeOriginal`. So parsing it is not new work: it is `exifExtract`.
//   2. Its twin is an `.avi` in 25 of 34 cases, and AVI is RIFF, not ISO-BMFF — `mp4.mjs` extracts
//      NOTHING from it. Measured: all 25 of those videos are `partial` today (a year from the
//      folder name, no season). The sidecar is their ONLY real date.
//   3. Pairing follows two conventions, both observed, neither assumable:
//        A. stem match       VID_0042.THM  <-> VID_0042.AVI      (25 real cases)
//        B. full-name suffix photo.jpg.xmp <-> photo.jpg         (1 real case)
//      Matching is case-insensitive: the archive is on Windows and extensions arrive in mixed case.
//
// Honesty rules this module enforces (internal map, invariants 3 and 4):
//   - an orphan sidecar (no twin) donates its date to nobody, and never invents a twin;
//   - a stem matching MORE THAN ONE media file is an ambiguity, so nothing is paired at all;
//   - a sidecar never outranks the media file's own capture date — `sidecar` sits below
//     exif-original / filename-timestamp / container-created in EVIDENCE_PRECEDENCE, so it fills a
//     gap rather than competing. researches/04 §4 confirms that is the correct rank.

import { readFile } from 'node:fs/promises';
import { exifExtract } from './exif.mjs';
import { isValidWall, makeEvidence } from './evidence.mjs';

/** Extensions treated as sidecars (lower case, with the dot). researches/04 §1. */
export const SIDECAR_EXTS = new Set(['.thm', '.xmp']);

/** Media kinds a sidecar may describe — a sidecar next to a .docx pairs with nothing. */
const MEDIA_KINDS = new Set(['photo', 'video', 'audio']);

/** Lower-cased extension of a filename, including the dot ('' when there is none). */
function extOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i).toLowerCase() : '';
}

/** Everything before the LAST dot ('photo.jpg.xmp' -> 'photo.jpg'). */
function stemOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** '/'-separated parent directory of a relative asset path ('' for the root). */
const dirOf = (relPath) => relPath.split('/').slice(0, -1).join('/');
/** Last segment of a relative asset path. */
const baseOf = (relPath) => relPath.split('/').at(-1);

/** Is this path a sidecar file, by extension? */
export function isSidecarPath(relPath) {
  return SIDECAR_EXTS.has(extOf(baseOf(relPath)));
}

/**
 * Pair every sidecar with the media file it describes.
 *
 * Rule B (full-name suffix) is tried first because it is the more specific claim: `photo.jpg.xmp`
 * names its twin outright, leaving nothing to infer. Rule A (stem match) is the camera convention.
 *
 * @param {Array<{path: string, kind: string}>} assets  every scanned asset, media and not
 * @returns {Map<string, string[]>}  media path -> its sidecar paths, sorted (canonical order:
 *   the map is consumed to build evidence that ends up in a diffed artifact)
 */
export function pairSidecars(assets) {
  // Index the possible TWINS (media, non-sidecar) per directory, under lower-cased keys.
  const byFullName = new Map(); // dir -> Map(lower(name) -> path)
  const byStem = new Map();     // dir -> Map(lower(stem) -> path[])   (a list: ambiguity is data)
  for (const a of assets) {
    if (!MEDIA_KINDS.has(a.kind) || isSidecarPath(a.path)) continue;
    const dir = dirOf(a.path);
    const name = baseOf(a.path);
    if (!byFullName.has(dir)) byFullName.set(dir, new Map());
    if (!byStem.has(dir)) byStem.set(dir, new Map());
    byFullName.get(dir).set(name.toLowerCase(), a.path);
    const stems = byStem.get(dir);
    const key = stemOf(name).toLowerCase();
    if (!stems.has(key)) stems.set(key, []);
    stems.get(key).push(a.path);
  }

  const out = new Map();
  // Sorted iteration so the produced evidence order never depends on scan order.
  for (const sc of [...assets].sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0))) {
    if (!isSidecarPath(sc.path)) continue;
    const dir = dirOf(sc.path);
    const stem = stemOf(baseOf(sc.path));

    // Rule B — the sidecar's stem IS a whole filename in the same directory.
    let twin = byFullName.get(dir)?.get(stem.toLowerCase()) ?? null;

    // Rule A — same stem, different extension. More than one match is an ambiguity: which video
    // does this thumbnail describe? Unanswerable, so nothing is claimed (invariant 3).
    if (!twin) {
      const candidates = byStem.get(dir)?.get(stem.toLowerCase()) ?? [];
      if (candidates.length === 1) [twin] = candidates;
    }
    if (!twin) continue; // orphan, or ambiguous — no evidence, no invention

    if (!out.has(twin)) out.set(twin, []);
    out.get(twin).push(sc.path);
  }
  return out;
}

// --- Reading a date out of a sidecar -------------------------------------------------------------

/**
 * XMP properties that assert when the photograph was TAKEN.
 *
 * Deliberately short. `xmp:CreateDate`, `xmp:ModifyDate` and `xmp:MetadataDate` are excluded: the
 * plans/02 measurement found editors writing all three as the SAVE time (Photoshop's identical
 * triple), and a sidecar gives no way to tell a copied capture date from a save date. Honest
 * ignorance beats a fabricated date — the same rule that made `editor-save` a ceiling.
 * Lightroom and darktable both write `exif:DateTimeOriginal`, so the real cases are covered.
 */
export const XMP_CAPTURE_PROPS = Object.freeze(['exif:DateTimeOriginal', 'photoshop:DateCreated']);

/**
 * Parse an XMP date value into a wall claim. Accepts the full ISO form and the date-only form
 * XMP also permits; any timezone offset is dropped, exactly as `parseXmpDate` does for embedded
 * XMP — the local components ARE the wall clock the camera recorded.
 * @param {string} value
 * @returns {{wall: object, dateOnly: boolean}|null}
 */
export function parseSidecarXmpDate(value) {
  const full = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(value ?? '');
  if (full) {
    const [year, month, day, hour, minute, second] = full.slice(1).map(Number);
    const wall = { year, month, day, hour, minute, second };
    return isValidWall(wall) ? { wall, dateOnly: false } : null;
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    const wall = { year, month, day, hour: 0, minute: 0, second: 0 };
    return isValidWall(wall) ? { wall, dateOnly: true } : null;
  }
  return null;
}

/**
 * The capture date an XMP sidecar asserts, read from its text. XMP writes a property either as an
 * attribute or as an element, and both forms occur in the wild, so both are read.
 * @param {string} xml
 * @returns {{wall: object, dateOnly: boolean, prop: string}|null}
 */
export function xmpCaptureDate(xml) {
  for (const prop of XMP_CAPTURE_PROPS) {
    const attr = new RegExp(`${prop}\\s*=\\s*"([^"]*)"`).exec(xml);
    const elem = new RegExp(`<${prop}>([^<]*)<`).exec(xml);
    const parsed = parseSidecarXmpDate(attr?.[1]) ?? parseSidecarXmpDate(elem?.[1]);
    if (parsed) return { ...parsed, prop };
  }
  return null;
}

/**
 * Build the `sidecar` evidence one sidecar file donates to its twin, or null when it carries no
 * capture date (the common real-world case for XMP — researches/04 §5).
 *
 * A THM is read as the JPEG it is, and ONLY its `DateTimeOriginal` is taken: `DateTime` on a
 * thumbnail is when the camera wrote the thumbnail, which is a save time by any other name.
 *
 * @param {Buffer} buffer     the sidecar file's bytes
 * @param {string} relPath    the sidecar's path, quoted in the evidence detail so the owner's
 *                            report can say WHICH file the date came from
 * @returns {object|null}
 */
export function sidecarClaim(buffer, relPath) {
  const ext = extOf(baseOf(relPath));
  const name = baseOf(relPath);

  if (ext === '.thm') {
    const { evidence } = exifExtract(buffer);
    const original = evidence.find((e) => e.kind === 'exif-original');
    if (!original) return null;
    return makeEvidence('sidecar', {
      wall: original.wall,
      dateOnly: original.dateOnly,
      detail: `${name} (DateTimeOriginal)`,
    });
  }

  if (ext === '.xmp') {
    const found = xmpCaptureDate(buffer.toString('utf8'));
    if (!found) return null;
    return makeEvidence('sidecar', {
      wall: found.wall,
      dateOnly: found.dateOnly,
      detail: `${name} (${found.prop})`,
    });
  }

  return null;
}

/**
 * Read a sidecar from disk and return the evidence it donates ([] when it donates none).
 * Read-only over user files (RULE 1). An unreadable sidecar is silence, not a failed scan: it is
 * a supplementary file, and losing its date must never cost the twin its own evidence.
 *
 * @param {string} absPath  the sidecar's absolute path
 * @param {string} relPath  its path relative to the scanned root (for the evidence detail)
 * @returns {Promise<object[]>}
 */
export async function sidecarEvidence(absPath, relPath) {
  let buffer;
  try {
    buffer = await readFile(absPath);
  } catch {
    return [];
  }
  const claim = sidecarClaim(buffer, relPath);
  return claim ? [claim] : [];
}
