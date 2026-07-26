# Bug 04 — three whole formats went unrecognised, so 38 real files were never sorted

**Status:** ✅ DONE (2026-07-26)
**When/context:** the owner, reading the result of the first real sort, asked why two things had not
moved: a 2.1 GB video (`00035.MTS`) and a folder of scanned paper photographs.

## Symptom

Files that are plainly media were classified `kind: 'other'`, and "other" means *leave it exactly
where the owner put it* (interview #001 Q5). So they silently never took part in the sort at all.

Swept the whole real sample rather than fixing the two reported cases — **38 files, three formats**:

| Files | Format | What it is |
|---:|---|---|
| 19 | `.aac` | raw ADTS AAC — WhatsApp voice notes |
| 18 | `.jp2` | JPEG 2000 — the owner's scanned paper photographs |
| 1 | `.mts` | AVCHD camcorder video, 2.1 GB |

(Three further `.bmp`/`.3gp` files are also "other" and correctly so — they are 0 bytes.)

## Root cause

`identify.mjs` decides by content, and its table simply had no entry for these three. Two were
ordinary omissions; the third was structural:

- **JPEG 2000** — needs the JP2 signature box `00 00 00 0C 6A 50 20 20`, or the bare codestream
  `FF 4F FF 51`. Just missing.
- **ADTS AAC** — frame sync is 12 set bits plus a 2-bit layer field. The existing MP3 checks claim
  `FF FB`/`FF F3` (layer III); AAC keeps the layer bits at 00, so `(byte1 & 0xF6) === 0xF0`. The two
  cannot collide, and MP3 is checked first regardless.
- **MPEG transport stream** — *has no magic string at all.* It can only be recognised by the 0x47
  sync byte repeating on a fixed grid: every 188 bytes for plain `.ts`, every 192 for camcorder
  `.mts`/`.m2ts`, whose packets carry a 4-byte timecode first (which is why the byte sits at offset
  4). A single 0x47 would match any file beginning with the letter "G", so the signature is the
  *pair*: two syncs one packet apart. That required raising `SNIFF_LENGTH` from 16 to 208 so the
  second one is inside the sniff — one read per file either way, so the cost is nil.

## Why it mattered

Silently, and against the product's whole point: these files were not misplaced, they were *not
sorted at all*, and nothing in the report drew attention to them. A 2.1 GB video and 18 scanned
family photographs stayed behind while everything around them moved. The owner found them by
looking; the tool never said a word.

## The fix

Three entries in `identify.mjs` plus the `isTransportStream` helper. Re-swept the sample: **38 → 0**
media files classified as "other" (only the three 0-byte files remain, correctly).

## Decisions made without the owner

1. **`.jp2` is a photo, `.mts` is video, `.aac` is audio** — i.e. they follow the existing kind
   rules, including audio going to `<год>/<сезон>/аудио/`. No new policy, just missing rows.
2. **`SNIFF_LENGTH` 16 → 208.** It is a per-file read that already happens; 208 bytes is the
   smallest window that can hold the second sync byte of an M2TS packet (offset 4 + 192).
3. **Two syncs required, not one.** The stricter rule was chosen over the simpler one because a
   single 0x47 at offset 0 would reclassify text files starting with "G" as video — and a wrong
   *kind* is worse than an unknown one: it would move a document into the photo library.

## Links

- `researches/03_first_real_run.md` — the run whose output the owner was reading.
- `tests/scan.test.mjs` — the guards, including the "one stray sync byte is not a signature" case.
