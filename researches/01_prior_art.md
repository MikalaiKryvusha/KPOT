# Research 01 — Prior art: what we reuse, what we write

> Phase 1, step 1 (`MASTER_PLAN.md`). Desk research on existing metadata extractors, photo organizers
> and duplicate detectors, evaluated against KPOT's needs: date-extraction breadth (JPEG / HEIC / RAW /
> MP4 / MOV), duplicate detection, licence, install weight, Windows 11 behaviour, maintenance status,
> and — decisively — *library vs. competing end-user app*.
>
> Desk research performed 2026-07-24 (web sources; nothing installed or benchmarked yet).
> **This document ends in a recommendation, not a survey.** One decision is deliberately left to the
> owner — see [The fork the owner must decide](#the-fork-the-owner-must-decide).

---

## 1. What KPOT actually needs from prior art

From `GOAL.md` / `MASTER_PLAN.md`, the reusable-candidate surface is exactly three capabilities:

1. **Evidence extraction** — capture dates (and camera meta) from JPEG, HEIC, TIFF-based RAW, PNG, MP4, MOV.
2. **Duplicate detection** — same shot stored under different names in different directories.
3. Everything else — scan orchestration, DateVerdict resolution, season mapping, SortPlan, backup /
   dry-run / rollback, reports — is KPOT's own product logic. **No candidate below provides it as a
   library**; the tools that have it (phockup, Elodie, sortphotos, PhotoPrism) are competing end-user
   apps in other languages.

Key physical insight that shapes the whole recommendation: **date extraction never requires decoding
pixels.** EXIF lives in a container box/segment that pure JS can parse in milliseconds. The patented
HEVC/HEIF *codecs* (the reason sharp's prebuilt binaries ship without HEIC) are irrelevant to reading
the Exif box of a `.heic` file. Only *perceptual* duplicate detection needs pixel decoding.

## 2. Candidates evaluated

### 2.1 Metadata / date extraction

#### ExifTool (Phil Harvey) via [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js)
- **What:** Node wrapper around the canonical Perl ExifTool, maintained by PhotoStructure. Vendors a
  per-platform binary via optional deps: [`exiftool-vendored.exe`](https://www.npmjs.com/package/exiftool-vendored.exe)
  on Windows (a self-contained `exiftool.exe`, **~34.5 MB unpacked, 514 files**, currently ExifTool 13.59),
  `exiftool-vendored.pl` on POSIX. Runs a stay-open ExifTool child-process pool (`-stay_open`), ~20+ files/s/thread.
- **Date breadth:** the gold standard — everything. JPEG, HEIC, every RAW flavour, MP4/MOV QuickTime tags
  (`CreateDate`, `com.apple.quicktime.creationdate`), sidecars, MakerNotes. Uniquely, it has serious
  **timezone inference** (`ExifDateTime` classes, GPS-based TZ lookup, UTC-vs-local disambiguation for
  QuickTime dates) — a real problem for video files, where spec dates are UTC but cameras lie.
- **Duplicates:** none (not its job).
- **Licence:** MIT (wrapper); ExifTool itself is Perl Artistic/GPL dual — redistribution of the binary is
  explicitly permitted, but it *is* redistribution of a third-party binary.
- **Windows:** first-class; the `.exe` package exists precisely for win32.
- **Maintenance:** excellent — v37.0.0 released 2025-07-15, continuous releases. ⚠️ **v36.0.0 (2025-06)
  dropped Node 20; current versions require Node ≥ 22.** KPOT targets Node ≥ 20 — using the current
  wrapper forces our floor to 22, or pins us to 35.x.
- **Reuse verdict:** library, perfectly reusable — at the cost of a 34 MB vendored binary and child
  processes. This is the fork the owner must decide (§4).

#### [exifr](https://github.com/MikeKovarik/exifr) (npm `exifr`)
- **What:** "the fastest and most versatile JS EXIF library." Pure JS, zero deps, chunked reads (~1–2.5 ms/file).
- **Date breadth:** JPEG, **HEIC/HEIF**, TIFF (hence TIFF-based RAW: CR2/NEF/ARW usually readable), PNG,
  AVIF, IIQ; EXIF + XMP + IPTC + ICC; revives dates into `Date` instances. **No video (MP4/MOV).**
- **Licence:** MIT. **Maintenance: effectively abandoned — last publish v7.1.3 in August 2021**, 53+ open
  issues (including HEIC edge-case crashes). Nearly 5 years without a release.
- **Reuse verdict:** technically the best-fitting pure-JS parser, but adopting an unmaintained parser for
  hostile real-world files means we inherit its bug backlog.

#### [ExifReader](https://github.com/mattiasw/ExifReader) (npm `exifreader`, mattiasw)
- **What:** pure-JS metadata parser, browser + Node, tree-shakeable custom builds (down to ~9 KiB).
- **Date breadth:** JPEG, TIFF (→ TIFF-based RAW), **HEIC/HEIF**, AVIF, PNG, WebP, GIF, JPEG XL; Exif,
  IPTC, XMP, ICC, MPF, partial MakerNotes; exposes `DateTimeOriginal` etc. **No video (MP4/MOV).**
- **Licence:** **MPL-2.0** — file-level copyleft. Using it *unmodified as an npm dependency of an MIT app
  is fine*; only modifications to ExifReader's own files must be shared. Worth stating in our README.
- **Windows:** pure JS — no platform surface at all.
- **Maintenance:** **actively maintained in 2025–2026**, ~1k stars, continuous releases.
- **Reuse verdict:** the best *maintained* pure-JS image-metadata library today. Same coverage class as
  exifr, alive. Primary pure-JS candidate.

#### [exif-reader](https://github.com/devongovett/exif-reader) (npm `exif-reader`)
- **What:** tiny parser that takes an **already-extracted raw EXIF buffer** (it does not open files).
  Co-maintained by Lovell Fuller (sharp's author); designed to pair with `sharp().metadata().exif`.
- **Date breadth:** whatever container you can pull the buffer from — i.e. it solves the easy half of
  the problem. Alone it is not a file reader.
- **Licence:** MIT. **Maintenance:** active (v2.0.3, Dec 2025).
- **Reuse verdict:** only makes sense in a sharp-centric pipeline; not a standalone answer.

#### [sharp](https://sharp.pixelplumbing.com/) (metadata route)
- **What:** libvips-based native image processor; `metadata()` returns raw `exif`/`xmp`/`iptc` buffers
  (needs `exif-reader` on top) plus dimensions/orientation.
- **Date breadth:** JPEG, PNG, WebP, GIF, TIFF, AVIF… but ⚠️ **prebuilt binaries ship without HEIC/HEIF**
  (HEVC patent licensing; requires a custom-compiled global libvips —
  [sharp#3680](https://github.com/lovell/sharp/issues/3680)). No video.
- **Install weight:** native prebuilt binaries, tens of MB. **Windows:** prebuilds work fine.
- **Licence:** Apache-2.0. **Maintenance:** excellent.
- **Reuse verdict:** *overkill and underpowered* as a metadata source (heavy native dep, and misses HEIC —
  the one modern format that matters most). Its real role, if any, is pixel decoding for perceptual
  hashing later (§2.3).

#### MP4/MOV dates in pure JS
- No maintained npm library exists. [`mp4-metadata`](https://github.com/nadr0/mp4-metadata) (streams to the
  `moov`→`mvhd` atom, exactly our use case) is MIT but **dead since April 2020**;
  [`moov-atom-js`](https://github.com/haukurh/moov-atom-js) is browser-oriented. The format itself is
  trivial: walk ISO-BMFF boxes to `moov/mvhd`, read `creation_time` (seconds since 1904-01-01 UTC);
  additionally read `moov/meta` / `udta` for Apple's `com.apple.quicktime.creationdate` (local time with
  offset — better evidence than mvhd's UTC). This is **~100–150 lines of `.mjs` we can own and test**,
  which beats adopting a dead dependency. Caveat we must encode in confidence levels: bare `mvhd` time is
  UTC (or a camera lie); without the Apple tag or GPS we cannot know local season boundaries exactly —
  ExifTool itself can only *infer* here.

### 2.2 Photo-organizer applications (competing apps, mined for design, not code)

- **[phockup](https://github.com/ivandokov/phockup)** — Python 3 CLI, MIT, ~1k stars, still active. Sorts
  photos+videos into `YYYY/MM/DD`-style trees using an **externally installed ExifTool**; ordered
  `--date-field` fallbacks; regex date-from-filename; `--dry-run`; **checksum comparison on target
  collision** (skip if identical, suffix if not); keeps original filenames. Windows supported (manual
  ExifTool install). *Closest existing tool to KPOT's core loop.* Not reusable as a Node library; its
  collision/dedup/dry-run semantics are the design prior art to match and exceed (it has no backup/rollback,
  no evidence report, no season buckets).
- **[Elodie](https://github.com/jmathai/elodie)** — Python, Apache-2.0, **abandoned (last commit Aug 2020)**.
  Valuable as prior art for its documented **date-precedence rule**: `DateTimeOriginal` → `CreateDate` →
  `ModifyDate` → filesystem times (QuickTime/H264 fields first for video). That ordering is field-proven;
  our DateVerdict resolver should start from it.
- **[sortphotos](https://github.com/andrewning/sortphotos)** — Python + bundled ExifTool, popular, low
  maintenance. Same class as phockup; nothing extra to take.
- **[PhotoPrism](https://github.com/photoprism/photoprism)** — Go + Docker self-hosted gallery server,
  **AGPL-3.0**, very active, 40k+ stars. A destination for a *sorted* library, not a sorter we can embed:
  not a library, wrong language, and AGPL is a licence we do not want coupled to an MIT CLI. Out of scope.
- **Node CLIs on npm** ([picsort](https://github.com/mateuszjanusz/picsort),
  [sortr](https://github.com/okize/sortr), imageorganize, etc.) — toy-grade: JPEG-only, `node-exif`-era
  dependencies, abandoned, no dedup/safety story. Confirms the niche KPOT targets is genuinely open in
  the Node ecosystem — **nothing here to reuse**.

### 2.3 Duplicate detection in Node

- **Exact duplicates** (same bytes under different names — the case `GOAL.md` actually names): needs no
  dependency at all. `node:crypto` streamed SHA-256, staged as *size → 64 KiB-prefix hash → full hash*
  so full reads happen only on candidate collisions. ~50 lines of `.mjs`. Nothing on npm earns its place
  against the built-in.
- **Perceptual near-duplicates** (re-encodes, resizes, thumbnail copies):
  - [sharp-phash](https://github.com/btd/sharp-phash) — DCT pHash on top of sharp; MIT; maintained
    (v2.2.0, Oct 2024); Hamming-distance comparison.
  - [imghash](https://www.npmjs.com/package/imghash) + [blockhash-core](https://www.npmjs.com/package/blockhash-core) —
    blockhash algorithm; also rides on sharp for decoding.
  - All practical options **require sharp** (native, tens of MB) and **cannot hash HEIC** with prebuilt
    binaries (§2.1 sharp) — precisely the iPhone-photo case where near-dupes are most common.
  - Verdict: real value, bad cost/benefit *for the MVP*. Exact hashing catches the dominant "copied the
    folder twice" chaos. Defer perceptual to a post-MVP optional phase (design the DuplicateGroup model
    now so a second hash type slots in without schema change).

## 3. Comparison table

| Candidate | Kind | JPEG | HEIC | RAW (TIFF-based) | MP4/MOV | Dup detection | Pure JS? | Install weight | Windows | Licence | Maintained (as of 2026-07) | Reusable as library? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js) | lib (wraps binary) | ✅ | ✅ | ✅ all | ✅ + TZ logic | — | ❌ vendored `exiftool.exe` | **~34.5 MB** (win32) | ✅ first-class | MIT (tool: Artistic/GPL) | ✅ v37.0.0 Jul 2025 · ⚠️ needs Node ≥ 22 | ✅ |
| [exifr](https://github.com/MikeKovarik/exifr) | lib | ✅ | ✅ | ⚠️ most | ❌ | — | ✅ zero deps | tiny | ✅ | MIT | ❌ **last release Aug 2021** | ✅ but stale |
| [ExifReader](https://github.com/mattiasw/ExifReader) | lib | ✅ | ✅ | ⚠️ most | ❌ | — | ✅ | tiny (tree-shakeable) | ✅ | **MPL-2.0** | ✅ active 2025–26 | ✅ |
| [exif-reader](https://github.com/devongovett/exif-reader) | lib (buffer-in) | n/a — needs extractor | — | — | ❌ | — | ✅ | tiny | ✅ | MIT | ✅ Dec 2025 | ⚠️ only with sharp |
| [sharp](https://sharp.pixelplumbing.com/) `metadata()` | lib | ✅ | ❌ (prebuilt) | ⚠️ | ❌ | (enables phash) | ❌ native libvips | heavy | ✅ prebuilds | Apache-2.0 | ✅ | ✅ |
| [mp4-metadata](https://github.com/nadr0/mp4-metadata) | lib | — | — | — | ✅ mvhd only | — | ✅ | tiny | ✅ | MIT | ❌ dead since 2020 | ⚠️ better rewritten |
| [phockup](https://github.com/ivandokov/phockup) | **app** (Python) | ✅ | ✅ | ✅ | ✅ | ✅ checksum-on-collision | ❌ Python + ext. ExifTool | — | ⚠️ manual setup | MIT | ✅ active | ❌ design prior art only |
| [Elodie](https://github.com/jmathai/elodie) | **app** (Python) | ✅ | ✅ | ✅ | ✅ | ⚠️ reject-on-import | ❌ Python + ExifTool | — | ⚠️ | Apache-2.0 | ❌ dead since 2020 | ❌ precedence-rule prior art |
| [sortphotos](https://github.com/andrewning/sortphotos) | **app** (Python) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | — | ⚠️ | MIT | ⚠️ low | ❌ |
| [PhotoPrism](https://github.com/photoprism/photoprism) | **app** (Go server) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ Docker | huge | ⚠️ Docker | **AGPL-3.0** | ✅ very active | ❌ out of scope |
| [sharp-phash](https://github.com/btd/sharp-phash) | lib | ✅ | ❌ (via sharp) | ⚠️ | ❌ | ✅ perceptual | ❌ (peer: sharp) | heavy (sharp) | ✅ | MIT | ✅ Oct 2024 | ✅ post-MVP |
| `node:crypto` SHA-256 | built-in | any file | any | any | any | ✅ exact | ✅ | zero | ✅ | — | — | ✅ **use this** |

## 4. The fork the owner must decide

⚠️ **Vision-level decision — requires `/interview`, not an agent default** (`MASTER_PLAN.md`, open decision
"reuse vs. write-our-own for metadata extraction").

**Option A — vendor ExifTool** (`exiftool-vendored` + `exiftool-vendored.exe`):
- \+ Maximum extraction breadth: every RAW, every video quirk, MakerNotes, sidecars, real timezone inference.
- − `npm install kpot` pulls a **~34.5 MB third-party Windows binary (514 files)**; KPOT's distribution now
  *redistributes* Perl-Artistic/GPL-licensed ExifTool alongside our MIT code; child processes at runtime;
  current wrapper **forces Node ≥ 22** (KPOT declared Node ≥ 20); contradicts the "near-zero dependencies"
  principle in `MASTER_PLAN.md`.

**Option B — pure JS** (ExifReader + our own ~150-line MP4/MOV box parser):
- \+ Near-zero deps honoured; instant install; no binary redistribution; single-language debuggability;
  everything testable with `node --test` fixtures.
- − Narrower coverage: exotic RAW containers (CR3, some proprietary formats) and weird video metadata may
  yield "date unknown" where ExifTool would find one. Files land in ПРОЧЕЕ instead of a year — *safe* but
  less complete. No GPS-timezone inference.

The architecture below makes the fork cheap either way; the owner chooses the default, not the design.

## 5. RECOMMENDATION

**Reuse exactly this, nothing more:**

1. **[ExifReader](https://github.com/mattiasw/ExifReader) (npm `exifreader`, MPL-2.0)** as the image
   metadata extractor — JPEG / HEIC / TIFF-based RAW / PNG / WebP / AVIF. Chosen over exifr for one
   decisive reason: exifr is unmaintained since Aug 2021 and we would inherit its HEIC edge-case bug
   backlog; ExifReader has equivalent coverage and is alive. (Note the MPL-2.0 dependency in the README;
   it is compatible with our MIT distribution as long as we don't fork its files.)
2. **`node:crypto` (built-in)** for exact duplicate detection — staged size → prefix-hash → full SHA-256.
   No package.
3. **[exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js) (MIT wrapper)** — **only
   if the owner picks Option A**, and then as an *optional* extractor behind the same interface, never a
   hard dependency. If the owner picks B, it can still become a later opt-in ("deep mode") without
   re-architecture.

**Write ourselves in `.mjs` (no fitting library exists):**

- **MP4/MOV date parser** — ISO-BMFF box walk to `mvhd` + Apple `com.apple.quicktime.creationdate`
  (~150 lines; the only candidates are dead since 2020).
- **Filename/directory-name date patterns** (`IMG_20190316_…`, `WhatsApp Image 2019-03-16…`,
  `2019-03-16 12.00.00.jpg`, Cyrillic folder names) — nothing reusable exists; this is fixture-driven
  KPOT logic.
- **The extractor interface + DateVerdict resolver** — evidence precedence seeded from Elodie's proven
  order (`DateTimeOriginal` → `CreateDate`/QuickTime → `ModifyDate` → fs times), each verdict carrying
  its evidence and confidence. This interface is what makes the §4 fork a config choice.
- **Everything else** — scan orchestration, duplicate grouping/keeper selection, season mapping, SortPlan,
  collision handling, backup / dry-run / rollback / journals, reports. All prior-art tools implement these
  as apps in other languages; none is importable. phockup's collision semantics (checksum-compare, suffix
  on true difference, keep original names) is the behaviour bar to meet and exceed.

**Explicitly deferred:** perceptual (near-duplicate) hashing — would force the native sharp stack in and
still miss HEIC with prebuilt binaries. Design `DuplicateGroup` to admit a second hash type post-MVP
(`sharp` + `sharp-phash` is the ready-made pair when wanted).

**Confirmed:** nothing in the Node ecosystem occupies KPOT's niche (safety-first, evidence-carrying,
season-bucketed organizer). The competition is Python CLIs without backup/rollback and an AGPL server app.
The niche is open.

---

### Next actions (feeding Phase 1)

1. `/interview` the owner: §4 fork (Option A/B) — and note the coupled sub-question: staying on Node ≥ 20
   vs. moving to ≥ 22 if Option A is chosen. (The season-boundary question from `MASTER_PLAN.md` can ride
   the same interview.)
2. Regardless of the outcome: start `tests/fixtures/make.mjs` and the extractor interface — both are
   identical under A and B.

### Sources

- https://github.com/photostructure/exiftool-vendored.js · https://www.npmjs.com/package/exiftool-vendored.exe · releases: https://github.com/photostructure/exiftool-vendored.js/releases
- https://github.com/MikeKovarik/exifr · https://registry.npmjs.org/exifr/latest
- https://github.com/mattiasw/ExifReader
- https://github.com/devongovett/exif-reader
- https://sharp.pixelplumbing.com/api-input/ · HEIC limits: https://github.com/lovell/sharp/issues/3680 · https://obviy.us/blog/sharp-heic-on-aws-lambda/
- https://github.com/nadr0/mp4-metadata · https://github.com/haukurh/moov-atom-js · https://kevinnadro.com/blog/parsing-creation-time-from-mp4-metadata-in-javascript/
- https://github.com/ivandokov/phockup · https://github.com/jmathai/elodie · https://github.com/andrewning/sortphotos · https://github.com/photoprism/photoprism
- https://github.com/btd/sharp-phash · https://www.npmjs.com/package/imghash · https://www.npmjs.com/package/blockhash-core
- Node organizer survey: https://github.com/mateuszjanusz/picsort · https://github.com/okize/sortr
