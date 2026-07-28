# Research 04 — sidecar files (THM / XMP): what they really are in this archive

> **Status:** ✅ done 2026-07-28 · **Method:** read-only walk of the owner's real archive (path in
> agent memory), plus a library composition of KPOT's own pipeline over the directories that contain
> a sidecar — no CLI, so nothing was written under the archive (the EXP-0011 pattern).
> **Privacy:** aggregates only. No real directory or file names appear here — repo rule 5.
>
> **Why this document exists:** `AGENT_GUIDE.md` checklist step 9 — the task rests on an external
> truth (what a `.thm`/`.xmp` file actually contains, and what the twin media file is missing). This
> is read from the live source, never from recall, and every later session codes by this document.

---

## 1. The corpus

The archive is unchanged since `researches/02`: **71 606 files** walked, exactly the surveyed count.

| Sidecar | Count | Share of archive |
|---|---:|---:|
| `.thm` | 34 | 0.047% |
| `.xmp` | 1 | 0.001% |

Small in count — but §4 shows they are the *only* date evidence for a class of video that KPOT
currently cannot date at all.

## 2. THM — what is actually inside

Every one of the 34 was opened and parsed. There is no variation to speak of:

| Property | Observed |
|---|---|
| Container | JPEG (magic `FFD8`) — **so KPOT's content-based identification calls a THM a `photo`** |
| Dimensions | **160×120 on 34/34** — a camera's video thumbnail, never a photograph |
| Size | 3.4–11.6 KB |
| EXIF block | full — **44 tags** on every file |
| `DateTimeOriginal` | **34/34 present and parseable** |
| `Make` / `Model` | present on 34/34 |

Cameras that wrote them (three devices, all consumer compacts of the era):

| Model | Files | Twin |
|---|---:|---|
| SONY DSC-S3000 | 21 | `.avi` |
| Canon PowerShot A430 | 4 | `.avi` |
| Canon PowerShot A580 | 9 | **none — orphans** |

## 3. How a sidecar is paired with its twin — two conventions, both observed

| Rule | Shape | Observed |
|---|---|---:|
| **A — stem match** | `X.THM` ↔ `X.AVI` (same stem, different extension) | 25 |
| **B — full-name suffix** | `X.jpg.xmp` ↔ `X.jpg` (the whole filename plus `.xmp`) | 1 |

Both must be supported; neither can be assumed. Matching is **case-insensitive** — the archive is on
Windows and the extensions arrive in mixed case.

**9 THMs have no twin at all** (all Canon A580, 2010): the videos they described are gone. Three of
those nine are byte-identical to each other (same size, same `DateTimeOriginal`) — KPOT's dedupe
groups them today as if they were duplicate photographs.

## 4. The finding that justifies the feature

`src/meta/mp4.mjs` walks ISO-BMFF (`ftyp`/`moov`/`mvhd`). **AVI is RIFF, not ISO-BMFF** — so for
every one of the 25 twinned videos KPOT extracts *no container date whatsoever*. Their filenames are
camera serials (`PREFIX+digits`), which carry no date either.

Measured by running the real pipeline (`annotateAssets`) over the 6 directories that hold a sidecar —
246 assets, 0 errors:

| | Today | With sidecar evidence |
|---|---|---|
| The 25 twinned videos | **all `partial`** — winner `dirname` (19) or `dir-cohort` (6): a year, no season, no time | **`dated`** to the second, from the twin's `DateTimeOriginal` |
| Where they land | `<год>/прочее` | `<год>/<сезон>/видео/` |
| The 34 THM files | `dated` by their own `exif-original`, sorted into the library **as photographs** | (see §6 — an open question, not decided here) |

The years the sidecars assert (April 2012 ×19, December 2012 ×2, October 2013 ×4) **agree with the
directory years KPOT already reads** — so this is pure refinement: it adds the season and the
timestamp, and creates no new conflicts. Nothing the owner sees today gets contradicted; 25 videos
simply stop sitting in the year's «прочее» drawer.

## 5. XMP — the honest result

There is exactly **one** `.xmp` in 71 606 files, and it does not carry a date.

| Property | Observed |
|---|---|
| Naming | full-name convention (`<name>.jpg.xmp`), twin present |
| Size | 22 KB |
| Toolkit | `XMP Core 5.5.0` |
| Namespaces | `x`, `rdf`, **`acdsee`** — and nothing else |
| Date properties | **none.** No `xmp:CreateDate`, no `exif:DateTimeOriginal`, no `photoshop:DateCreated`; zero date attributes and zero date elements |

It is an **ACDSee catalog sidecar** — ratings, categories, keywords — not a date carrier.

**Consequence, recorded rather than glossed over:** an XMP date reader fires on **0 of 1** real files
here. It is still worth implementing, because it is the same pairing mechanism with a different
parse, and Lightroom/darktable sidecars (the standard date-bearing kind) are ordinary in the wider
world this open-source tool ships into. But its guard is a **fixture**, never real data — no
`[TESTED]` marker on the XMP path may claim otherwise.

## 6. The question this research raises but does NOT answer

A THM is a JPEG, so KPOT identifies it as a `photo` and sorts all 34 into the chronological
library — 160×120 thumbnails filed among the owner's photographs. That is almost certainly not what
the owner wants, but *where* they should go instead (follow their video · quarantine as camera
litter · stay put) decides the placement of 34 of his files and is his call, not the tool's —
internal-map invariant 10. Surfaced to the owner; not decided in this document.

## 7. What the implementation must therefore do

1. Pair by **both** rules of §3, case-insensitively; a stem that matches more than one media file is
   an ambiguity — do not guess (invariant 3).
2. Read a `.thm` as the JPEG it is: reuse `exifExtract`, re-badge the resulting capture claim as
   `sidecar` evidence on the **twin**, keeping the provenance (which file the date came from).
3. Read a `.xmp` as text, taking only the standard date properties, and yield nothing when none are
   present — which is the real-world common case (§5).
4. A sidecar's date **never overrides** a media file's own capture date: `sidecar` already ranks
   below `exif-original`/`filename-timestamp`/`container-created` in `EVIDENCE_PRECEDENCE`, which
   §4 confirms is the right place — it fills a gap rather than competing.
5. An **orphan** sidecar donates its date to nobody; it must not invent a twin.

## Links

- `researches/02_real_archive_survey.md` §File types — the original count (`.thm` 34, `.xmp` 1) and
  the predicted evidence tier `… → dirname → sidecar → mtime`, confirmed here.
- `researches/03_first_real_run.md` — the sample deliberately included THM sidecars with their twins.
- `src/meta/evidence.mjs` — the `sidecar` kind and its rank existed from Phase 2; only the collector
  was deferred.
