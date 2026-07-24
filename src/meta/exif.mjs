// src/meta/exif.mjs — EXIF date evidence for images, via `exifreader`.
// [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs — planted EXIF recovered, EXIF-less silent; 55/55]
//
// exifreader (npm, MPL-2.0, actively maintained) is the ONE runtime dependency the project allows
// itself — the decision and the comparison behind it live in researches/01_prior_art.md §5 and the
// MASTER_PLAN decision log (2026-07-24, interview #001 Q1 = pure JS). It parses JPEG / HEIC /
// TIFF-based RAW / PNG / WebP metadata segments without decoding pixels.
//
// Only two tags become evidence, per the precedence model:
//   DateTimeOriginal (0x9003) → 'exif-original'  — the shutter moment, the strongest claim there is
//   DateTime         (0x0132) → 'exif-modify'    — file save/edit time, a weaker fallback
// Both are naive local wall-clock strings ("YYYY:MM:DD HH:MM:SS") → wall claims, never instants.

import ExifReader from 'exifreader';
import { makeEvidence, isValidWall } from './evidence.mjs';

/** Parse the EXIF date string format "YYYY:MM:DD HH:MM:SS" into a wall claim (null if malformed). */
export function parseExifDate(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  const wall = { year, month, day, hour, minute, second };
  return isValidWall(wall) ? wall : null;
}

/**
 * Extract date evidence from an image file's bytes.
 * Unparseable/absent EXIF yields [] — silence, not an error: most social-export files have none.
 * @param {Buffer} buffer  the image file's content
 * @returns {object[]}  Evidence list (possibly empty)
 */
export function exifEvidence(buffer) {
  let tags;
  try {
    tags = ExifReader.load(buffer);
  } catch {
    return []; // not a metadata-bearing file — no evidence, no crash
  }
  const out = [];
  const original = parseExifDate(tags.DateTimeOriginal?.description);
  if (original) out.push(makeEvidence('exif-original', { wall: original, detail: 'DateTimeOriginal' }));
  const modify = parseExifDate(tags.DateTime?.description);
  if (modify) out.push(makeEvidence('exif-modify', { wall: modify, detail: 'DateTime' }));
  return out;
}
