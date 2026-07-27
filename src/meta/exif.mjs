// src/meta/exif.mjs — EXIF/XMP evidence and image facts for photos, via `exifreader`.
// [TESTED: 2026-07-24 · tests/meta_phase2.test.mjs — planted EXIF recovered, EXIF-less silent ·
//  2026-07-27 · tests/meta_plan02.test.mjs — editor-save demotion, facts extraction]
//
// exifreader (npm, MPL-2.0, actively maintained) is the ONE runtime dependency the project allows
// itself — the decision and the comparison behind it live in researches/01_prior_art.md §5 and the
// MASTER_PLAN decision log (2026-07-24, interview #001 Q1 = pure JS). It parses JPEG / HEIC /
// TIFF-based RAW / PNG / WebP metadata segments without decoding pixels.
//
// Date evidence, per the precedence model:
//   DateTimeOriginal (0x9003) → 'exif-original'  — the shutter moment, the strongest claim there is
//   DateTime         (0x0132) → 'exif-modify'    — file save/edit time, a weaker fallback
//   …EXCEPT when the file is an EDITOR EXPORT with no capture date (plans/02 §1.1): then the save
//   date is NOT a capture claim at all — it becomes 'editor-save', an upper bound («снято не позже»)
//   the resolver never dates by. This is the fix for the 113-file broken class measured on the
//   owner's real sample (researches/03): a summer photo edited in February was shelved into winter.
//
// Beyond dates, `exifExtract` also returns FACTS the plans/02 passes need: Software/CreatorTool
// (who saved it), Make/Model (which camera), pixel dimensions (sensor geometry), and the XMP
// identity chain (DocumentID / DerivedFrom) that lets an export find its original exactly.

import ExifReader from 'exifreader';
import { makeEvidence, isValidWall } from './evidence.mjs';

/**
 * Photo editors OBSERVED in the owner's real sample (researches/03: Photoshop CS3/CS2 ×86,
 * Picasa ×74, Snapseed ×15, Paint.NET ×10, Lightroom ×4). Sourced, not invented — camera firmware
 * also writes a Software tag (`GT-I9100XWLPG`), so this must be a whitelist of editors, never a
 * "Software tag present" test. Extend it only from observed data.
 */
export const EDITOR_SOFTWARE_RE = /photoshop|picasa|snapseed|paint\.net|lightroom/i;

/** Parse the EXIF date string format "YYYY:MM:DD HH:MM:SS" into a wall claim (null if malformed). */
export function parseExifDate(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  const wall = { year, month, day, hour, minute, second };
  return isValidWall(wall) ? wall : null;
}

/** Parse an XMP ISO date ("2014-02-09T11:09:09+03:00") into a wall claim — the LOCAL components
 * exactly as written; the offset is deliberately dropped (it IS the local wall time at save). */
export function parseXmpDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  const wall = { year, month, day, hour, minute, second };
  return isValidWall(wall) ? wall : null;
}

/** A tag's string description, or null — exifreader wraps every value. */
const str = (tag) => (typeof tag?.description === 'string' && tag.description !== '' ? tag.description : null);

/** A tag's numeric pixel count ("2280px" or 2280), or null. */
const px = (tag) => {
  const n = Number.parseInt(tag?.description ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Extract date evidence AND image facts from a photo's bytes in one metadata parse.
 * Unparseable/absent metadata yields empty results — silence, not an error.
 *
 * @param {Buffer} buffer  the image file's content
 * @returns {{evidence: object[],
 *            facts: {software?: string, make?: string, model?: string,
 *                    width?: number, height?: number,
 *                    documentId?: string, derivedFrom?: string, editor?: boolean}}}
 */
export function exifExtract(buffer) {
  let tags;
  try {
    tags = ExifReader.load(buffer);
  } catch {
    return { evidence: [], facts: {} }; // not a metadata-bearing file — no evidence, no crash
  }

  // --- facts -------------------------------------------------------------
  const software = str(tags.Software) ?? str(tags.CreatorTool);       // EXIF 0x0131, else XMP
  const make = str(tags.Make);
  const model = str(tags.Model);
  const width = px(tags['Image Width']);
  const height = px(tags['Image Height']);
  const documentId = str(tags.DocumentID);                            // XMP xmpMM:DocumentID
  const derivedFrom = tags.DerivedFrom?.value?.documentID?.value ?? null; // XMP stRef:documentID
  const editor = software !== null && EDITOR_SOFTWARE_RE.test(software);

  const facts = {
    ...(software !== null ? { software } : {}),
    ...(make !== null ? { make } : {}),
    ...(model !== null ? { model } : {}),
    ...(width !== null ? { width } : {}),
    ...(height !== null ? { height } : {}),
    ...(documentId !== null ? { documentId } : {}),
    ...(derivedFrom !== null ? { derivedFrom } : {}),
    ...(editor ? { editor } : {}),
  };

  // --- date evidence -------------------------------------------------------
  const out = [];
  const original = parseExifDate(tags.DateTimeOriginal?.description);
  if (original) out.push(makeEvidence('exif-original', { wall: original, detail: 'DateTimeOriginal' }));

  // The save/edit date: EXIF DateTime first, XMP ModifyDate/CreateDate as the fallback the
  // editors themselves write (Photoshop's XMP triple, researches/03).
  const modify = parseExifDate(tags.DateTime?.description)
    ?? parseXmpDate(tags.ModifyDate?.description)
    ?? parseXmpDate(tags.CreateDate?.description);
  if (modify) {
    if (editor && !original) {
      // plans/02 §1.1 — the unambiguous local signature of the broken class: an editor wrote the
      // file AND there is no capture date. The save date is a ceiling, not a capture claim.
      out.push(makeEvidence('editor-save', { wall: modify, detail: `save date written by ${software}` }));
    } else {
      out.push(makeEvidence('exif-modify', { wall: modify, detail: 'DateTime' }));
    }
  }
  return { evidence: out, facts };
}

/**
 * Extract date evidence only (the original Phase-2 surface — kept so callers that need no facts
 * stay unchanged).
 * @param {Buffer} buffer
 * @returns {object[]}
 */
export function exifEvidence(buffer) {
  return exifExtract(buffer).evidence;
}
