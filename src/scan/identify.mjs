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
/**
 * How many bytes of a file are read to identify it.
 *
 * 16 was enough while every format announced itself with a magic string in the first bytes. MPEG
 * transport streams do not (see `isTransportStream`): they can only be recognised by a sync byte
 * repeating at a 188- or 192-byte stride, so the sniff must reach the SECOND one — offset 4 + 192.
 * Raised to 208 with bug 04; it is one read per file either way, so the cost is nil.
 */
export const SNIFF_LENGTH = 208;

/** System litter identified by exact basename (case-insensitive). */
const JUNK_BASENAMES = new Set(['thumbs.db', '.nomedia', 'desktop.ini', '.ds_store']);
/**
 * Litter identified by extension (case-insensitive).
 *
 * `.thm` is here by the OWNER'S decision (2026-07-28): a THM is a camera's 160x120 video
 * thumbnail, and although it is a perfectly valid JPEG it is not a photograph — filing all 34 of
 * the archive's into the chronological library put thumbnails among real pictures (and three
 * byte-identical ones into a duplicate group). It is camera litter in the same sense `Thumbs.db`
 * is Windows litter, so it takes the same route: quarantine with provenance, deleted never.
 *
 * This costs nothing in evidence: `src/meta/sidecar.mjs` pairs sidecars over the WHOLE asset list
 * regardless of kind, so a quarantined THM still donates its capture date to its video twin.
 */
const JUNK_EXTS = new Set(['.tmp', '.lnk', '.bak', '.thm']);

/** ISO-BMFF (`ftyp`) major brands that are still-image containers, not video. */
const BMFF_PHOTO_BRANDS = new Set(['heic', 'heix', 'heif', 'hevc', 'mif1', 'msf1', 'avif']);

const ascii = (buf, from, to) => buf.toString('latin1', from, to);
const startsWith = (buf, bytes, at = 0) =>
  buf.length >= at + bytes.length && bytes.every((b, i) => buf[at + i] === b);

/** MPEG-TS sync byte, and the two packet strides that carry it. */
const TS_SYNC = 0x47;
const TS_PACKET = 188;        // plain .ts — sync at offset 0
const M2TS_PACKET = 192;      // camcorder .mts/.m2ts — 4-byte timecode first, so sync at offset 4

/**
 * Is this an MPEG transport stream (AVCHD `.MTS`/`.M2TS`, or plain `.TS`)?
 *
 * These containers have no magic string at all — only the sync byte repeating on a fixed grid. A
 * single 0x47 would match any file that happens to start with the letter "G", so we require a
 * SECOND sync at exactly one packet's distance. Two hits on the grid is the actual signature.
 */
function isTransportStream(head) {
  for (const [offset, stride] of [[0, TS_PACKET], [4, M2TS_PACKET]]) {
    const next = offset + stride;
    if (head.length > next && head[offset] === TS_SYNC && head[next] === TS_SYNC) return true;
  }
  return false;
}

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
  // JPEG 2000 — the JP2 signature box, and the bare codestream. 18 real files in the archive; they
  // were classified as "other" and therefore never sorted at all (bug 04).
  if (startsWith(head, [0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20])) {
    return { kind: 'photo', format: 'jp2' };
  }
  if (startsWith(head, [0xFF, 0x4F, 0xFF, 0x51])) return { kind: 'photo', format: 'jp2' };

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
  // MPEG transport stream — camcorder AVCHD (`.MTS`/`.M2TS`) and plain `.TS`. There is no magic
  // string, only the 0x47 sync byte repeating on a fixed grid: every 188 bytes for TS, and every
  // 192 for M2TS, whose packets carry a 4-byte timecode first (which is why the byte sits at
  // offset 4, not 0). One sync byte alone would match any file beginning with "G", so a SECOND
  // sync at the expected distance is required — that pair is the signature (bug 04, found on a
  // 2.1 GB `.MTS` the tool had been leaving behind as "not media").
  if (isTransportStream(head)) return { kind: 'video', format: 'mpeg-ts' };

  // — audio —
  if (ascii(head, 0, 4) === 'OggS') return { kind: 'audio', format: 'ogg' };
  if (ascii(head, 0, 3) === 'ID3' || startsWith(head, [0xFF, 0xFB]) || startsWith(head, [0xFF, 0xF3])) {
    return { kind: 'audio', format: 'mp3' };
  }
  if (ascii(head, 0, 5) === '#!AMR') return { kind: 'audio', format: 'amr' };
  // Raw ADTS AAC — what WhatsApp voice notes are (19 real files, all left unsorted before bug 04).
  // Frame sync is 12 set bits, then a version bit and a 2-bit layer field that AAC keeps at 00:
  // so byte0 == 0xFF and (byte1 & 0xF6) == 0xF0. The MP3 checks above run FIRST and claim 0xFB/0xF3
  // (layer III), which is exactly what the layer bits distinguish — the two cannot collide.
  if (head.length >= 2 && head[0] === 0xFF && (head[1] & 0xF6) === 0xF0) {
    return { kind: 'audio', format: 'aac' };
  }

  return { kind: 'other', format: null };
}
