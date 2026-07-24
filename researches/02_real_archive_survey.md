# Research 02 — Survey of a real messy archive (read-only)

> **Status:** ✅ done 2026-07-24 · **Method:** read-only recursive inventory of the owner's real photo
> archive, analyzed with a throwaway Node script. **Privacy:** this document contains ONLY aggregate
> statistics and generic camera-generated filename examples. No real paths, no personal directory or
> file names, no media content — per repo rule 5 (the archive root path lives in agent memory, never
> in the repo). The inventory CSV and the analysis script stayed in the session scratchpad and were
> not committed.

The owner granted **read-only** access to the real collection on 2026-07-24 for study purposes only —
no writes of any kind until the Phase 4 safety mechanisms exist and the owner explicitly approves.
Purpose of this survey: learn what real chaos looks like so fixtures, the date-evidence model and the
architecture are built against reality, not imagination.

---

## Scale

| Metric | Value |
|--------|-------|
| Files | **71 606** |
| Total size | **551 GB** (photos ≈ 130 GB, video ≈ 415 GB) |
| Distinct extensions | 43 |
| Max directory depth | 6 |
| Longest full path | 196 chars (none over 260 — but a `<year>/<season>/` re-nest could push some over; keep long-path support anyway) |
| Top-level directories | ~60: year-dirs `2007`…`2026` side by side with thematic dirs (people, events, devices, "prочее"-style catch-alls), some prefixed `#` |

## File types actually present

| Class | Extensions (count) | Notes |
|-------|--------------------|-------|
| Photos | `.jpg` 61 435 · `.png` 2 023 · `.heic` 1 054 · `.jpeg` 254 · `.webp` 30 · `.jp2` 18 · `.gif` 5 · `.bmp` 2 | HEIC (modern iPhone) is a first-class citizen — 1k+ files |
| RAW | `.cr2` 159 · `.dng` 47 | Canon RAW + DNG; dates live in their EXIF/TIFF headers |
| Video | `.mp4` 4 943 (**372 GB!**) · `.3gp` 367 · `.avi` 311 · `.mov` 84 · `.vob/.ifo/.bup` 20 (DVD rip) · `.mts` 1 · `.mod` 1 · `.wmv` 7 · `.mkv` 1 · `.webm` 1 | Video is 75% of all bytes. `.3gp` = old phones; DVD/AVCHD relics exist |
| Audio | `.ogg` 531 · `.aac` 19 · `.mp3` 13 · `.amr` 6 · `.3ga` 5 · `.wav` 4 | Voice notes / recordings. GOAL.md says photo+video — audio policy is an open question |
| Sidecars | `.thm` 34 (video thumbnails) · `.xmp` 1 | THM often carries the EXIF for its video twin |
| Editor files | `.psd` 37 · `.sfk` 2 | Owner's edits — human-named, valuable |
| Junk / system | `.db` 152 (Thumbs.db) · `.nomedia` 4 · `.tmp` 6 · `.ini` · `.lnk` · `.bak` · `.html` · `.txt` · `.docx` · `.zip` | Needs an explicit ignore/leave-behind policy |
| Broken | `.без названия` 14 | A *Cyrillic phrase as the extension* — extension parsing must not assume ASCII |

**Design consequence:** identify media by content signature, not extension (`.без названия` proves it),
and keep an explicit junk-file policy in the plan phase.

## Filename patterns (share of 71 606 files)

Ordered detector prototype was run over every basename; first match wins:

| Count | Pattern | Generic example | Date recoverable from name? |
|------:|---------|-----------------|------------------------------|
| 18 400 | Android `IMG_YYYYMMDD_HHMMSS` | `IMG_20120907_233145.jpg` | ✅ full timestamp |
| 17 858 | contains a year somewhere | `fix_light_output_image_2024-04-24_<uuid>_4k.jpg` (AI upscaler output), event-named dirs/files | ⚠️ year, sometimes date — weak-to-medium evidence |
| 7 895 | **unix-timestamp name** (10+ digits) | `1374250121884.jpg` (ms epoch) | ✅ decode epoch (sanity-check the range!) |
| 7 828 | camera serial `S#######`/`SAM`/`MVI`/`SDC` | `S8307961.jpg` | ❌ EXIF needed |
| 4 128 | camera `DSC`/`DSCN`/`DSCF` | `DSC01304.JPG` | ❌ EXIF needed |
| 3 451 | camera `img###` (no date) | `img102.jpg` | ❌ EXIF needed |
| 3 432 | `Screenshot_YYYY-MM-DD-HH-MM-SS[-ms][_app]` | `Screenshot_2017-05-27-19-34-56-006_com.android.chrome.png` | ✅ full timestamp + app suffix |
| 3 362 | no pattern at all | `image.jpg`, `x_ca30f2a5.jpg` | ❌ |
| 1 951 | VK/social 11-char base64-ish | `6V2qnCITQIE.jpg` | ❌ usually stripped EXIF too — expect "прочее" |
| 1 740 | Android `VID_YYYYMMDD_HHMMSS` | `VID_20161210_100950.mp4` | ✅ |
| 907 | Cyrillic human-named | (owner's own names — preserve!) | ❌ but human-meaningful |
| 356 | short pure digits | `172.jpg`, `00035.MTS` | ❌ |
| 72 | telegram-ish `photo##########` | `photo1711295489.jpeg` — **epoch seconds** | ✅ decode |
| 59 | `PANO_`/`BURST_` | `PANO_20170827_103441.jpg` | ✅ |
| 41 | `YYYY-MM-DD hh.mm.ss` (iOS/Dropbox style) | `2011-04-28 19.05.49 PIC12.jpg` | ✅ |
| 20 | `YYYY-MM-DD` + suffix `(epoch-ms)` | `2011-05-09 PIC16(1304952444364).jpg` — *two* date evidences in one name | ✅ |
| 13 | hex hash names | `617b44be…f9.jpg` | ❌ |
| 9 | WhatsApp `IMG-YYYYMMDD-WA####` | `IMG-20160404-WA0001.jpg` | ✅ date only |
| 1 | Windows Phone `WP_YYYYMMDD_###` | `WP_20151102_038.jpg` | ✅ date only |

≈ **31 700 files (44%)** carry a decodable date/timestamp in the filename alone; ≈ 15 400 are
camera-serial names where EXIF is the only hope; ≈ 5 300 (social exports, hashes, `image.jpg`) will
likely end in "прочее" unless directory context saves them.

## Name hazards (all real, all counted)

- **334** stems ending in a dot or space (Windows reserved-name trouble).
- **1 108** non-ASCII basenames (Cyrillic everywhere) + Cyrillic *extension* (`.без названия`).
- **742** `+`-suffix variants: `IMG_20140121_184626+.jpg` next to `IMG_20140121_184626.jpg` — an
  HDR/edited twin that differs by one char and must not collide or be treated as a duplicate blindly.
- **411** names containing `копия`/`copy`/`(1)` — explicit human copy-markers.

## Duplicates (cheap proxy, no hashing yet)

- 6 749 distinct basenames occur in more than one directory (17 158 files involved).
- **Same (size + name): 5 571 groups, 13 372 files → ≥ 7 801 redundant copies (~11% of the archive)**
  before any content hashing. Real hashing will find more (renamed copies).

## Directory structure observations

- **The owner already sorts by year and season by hand.** Year dirs `2007`…`2026` exist at the root;
  inside them season dirs in several spellings: `Весна 2013`, `Зима_2020`, `осень 2013`,
  `Лето_2020` (case, separator and word order vary). KPOT's target format is literally the owner's
  own convention, formalized. **Consequence:** the tool must recognize an already-sorted subtree,
  merge into it idempotently, and treat existing `<year>/<season>` dir names as strong date evidence.
  Note: the real tree HAS autumn ("осень") — supports asking the owner about the 4-bucket list in
  GOAL.md being an omission.
- Directory names carry years for ~38 700 files (54%) — directory-name evidence is high-value.
- Thematic dirs named after people/events/devices (Cyrillic) sit beside year dirs — these names must
  survive the sort (GOAL.md requirement).
- Device-dump dirs exist (`100MEDIA`-style, phone-model-named) — classic camera-roll copies.
- Depth histogram: bulk at depth 2–3, tail to 6.

## Filesystem times are UNRELIABLE here

`LastWriteTime` histogram has a huge artificial spike: **18 656 files "modified" in 2023** (a bulk
copy year) and 1 532 in 2005 (disk migration), plus files "from" 1979/1980 (broken camera clock).
mtime can only ever be the weakest evidence tier, and *copy spikes must be detected and discounted*.

## Implications for KPOT design (feeds fixtures + src/meta + MASTER_PLAN)

1. **Fixture generator must reproduce:** every pattern class above, the `+`-twin, Cyrillic extension,
   trailing-dot names, Thumbs.db/.nomedia junk, THM sidecar next to its video, an already-sorted
   `<year>/<season>` subtree, a bulk-copy mtime spike, an epoch-named file, a broken-clock date.
2. **Evidence tiers observed in reality:** EXIF → filename timestamp (incl. epoch decode) → directory
   year/season → sidecar (THM/XMP) → mtime (discounted, spike-aware). This grounds the DateVerdict
   precedence work in Phase 2.
3. **Backup mechanism fork now has numbers:** 551 GB / 372 GB of video makes a git-based backup
   commit unrealistic for the full archive — strengthens manifest + hardlink snapshot (same-volume
   moves) in the Phase 4 decision. Also: **moving within one volume must be `rename`, never
   copy+delete** — 551 GB does not fit anywhere twice.
4. **Scale requirements:** 71k files → streamed hashing with bounded concurrency, resumable runs,
   progress output; hashing 551 GB is hours, not seconds — the scan phase needs a persistent cache
   keyed by (path, size, mtime).
5. **Audio policy** (`.ogg`/`.amr` voice notes) and **junk policy** (Thumbs.db etc.) are new small
   open questions for the owner interview (fold into the season-boundaries interview).

---

**Verdict:** реальный хаос богаче, чем предполагал план, но на 100% покрывается моделью
"evidence + confidence". Ни одно наблюдение не ломает целевую архитектуру; два решения она усиливает:
identify-by-content и manifest-backup вместо git-backup. Fixtures should be built from this catalog.
