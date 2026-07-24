// src/scan/identify.mjs — media identification by CONTENT, not extension.
// [TESTED: 2026-07-24 · tests/scan.test.mjs — fixture kinds + survey format classes; suite 48/48]
//
// The real archive proves extensions lie: 14 files there have the Cyrillic phrase `.без названия`
// as their "extension" while being perfectly valid JPEGs (researches/02 §File types). So the kind
// of a file is decided by its magic bytes; the basename is consulted only for the junk policy
// (Thumbs.db and friends are junk BY NAME regardless of content — interview #001 Q4).
//
// Kinds (the vocabulary of the whole pipeline, mirrored in fixture `expected.json`):
//   photo · video · audio  — media, gets sorted into <year>/<season>/
//   junk                   — OS/system litter → quarantine with provenance
//   other                  — non-media user files → stay in place, listed in the report
//
// The signature table covers every format class observed in the real archive survey. Formats not
// in the table fall to 'other' — safe by design: KPOT leaves what it does not recognize.

/** How many leading bytes identification needs (longest offset used: ISO-BMFF brand at 8–12). */
export const SNIFF_LENGTH = 16;

/** System litter identified by exact basename (case-insensitive). */
const JUNK_BASENAMES = new Set(['thumbs.db', '.nomedia', 'desktop.ini', '.ds_store']);
/** System litter identified by extension (case-insensitive). */
const JUNK_EXTS = new Set(['.tmp', '.lnk', '.bak']);

/** ISO-BMFF (`ftyp`) major brands that are still-image containers, not video. */
const BMFF_PHOTO_BRANDS = new Set(['heic', 'heix', 'heif', 'hevc', 'mif1', 'msf1', 'avif']);

const ascii = (buf, from, to) => buf.toString('latin1', from, to);
const startsWith = (buf, bytes, at = 0) =>
  buf.length >= at + bytes.length && bytes.every((b, i) => buf[at + i] === b);

/** Is this basename system junk (per the quarantine policy)? Exported for the plan phase. */
export function isJunkName(basename) {
  const lower = basename.toLowerCase();
  if (JUNK_BASENAMES.has(lower)) return true;
  const dot = lower.lastIndexOf('.');
  return dot > 0 && JUNK_EXTS.has(lower.slice(dot));
}

/**
 * Classify a file from its basename + first SNIFF_LENGTH bytes.
 * @param {string} basename
 * @param {Buffer} head  the file's leading bytes (may be shorter for tiny files)
 * @returns {{kind: 'photo'|'video'|'audio'|'junk'|'other', format: string|null}}
 */
export function identify(basename, head) {
  // Junk-by-name outranks content — a real Thumbs.db is an OLE container, but it is still junk.
  if (isJunkName(basename)) return { kind: 'junk', format: null };

  // — photos —
  if (startsWith(head, [0xFF, 0xD8])) return { kind: 'photo', format: 'jpeg' };
  if (startsWith(head, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return { kind: 'photo', format: 'png' };
  if (ascii(head, 0, 4) === 'GIF8') return { kind: 'photo', format: 'gif' };
  if (ascii(head, 0, 4) === '8BPS') return { kind: 'photo', format: 'psd' }; // owner: .psd is media
  if (ascii(head, 0, 4) === 'II*\0' || ascii(head, 0, 4) === 'MM\0*') {
    return { kind: 'photo', format: 'tiff' }; // covers CR2/DNG RAW (TIFF-based)
  }
  if (startsWith(head, [0x42, 0x4D])) return { kind: 'photo', format: 'bmp' };

  // — ISO-BMFF family: MP4/MOV/3GP/HEIC share the `ftyp` box; the brand splits photo from video —
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12).toLowerCase();
    if (BMFF_PHOTO_BRANDS.has(brand.trim())) return { kind: 'photo', format: 'heic' };
    return { kind: 'video', format: brand.trim() || 'mp4' };
  }

  // — RIFF family: the sub-type at offset 8 decides —
  if (ascii(head, 0, 4) === 'RIFF') {
    const sub = ascii(head, 8, 12);
    if (sub === 'WEBP') return { kind: 'photo', format: 'webp' };
    if (sub === 'AVI ') return { kind: 'video', format: 'avi' };
    if (sub === 'WAVE') return { kind: 'audio', format: 'wav' };
  }

  // — other video containers seen in the survey —
  if (startsWith(head, [0x1A, 0x45, 0xDF, 0xA3])) return { kind: 'video', format: 'matroska' }; // mkv/webm
  if (startsWith(head, [0x30, 0x26, 0xB2, 0x75])) return { kind: 'video', format: 'asf' };      // wmv
  if (startsWith(head, [0x00, 0x00, 0x01, 0xBA])) return { kind: 'video', format: 'mpeg-ps' };  // vob

  // — audio —
  if (ascii(head, 0, 4) === 'OggS') return { kind: 'audio', format: 'ogg' };
  if (ascii(head, 0, 3) === 'ID3' || startsWith(head, [0xFF, 0xFB]) || startsWith(head, [0xFF, 0xF3])) {
    return { kind: 'audio', format: 'mp3' };
  }
  if (ascii(head, 0, 5) === '#!AMR') return { kind: 'audio', format: 'amr' };

  return { kind: 'other', format: null };
}
