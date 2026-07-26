# Research 03 — the first run against real data (representative sample)

> **Status:** ✅ done 2026-07-26 · **Method:** owner-authorised copy of a stratified sample from the
> real archive, then `kpot plan` against it. **Privacy:** aggregates only. No real directory or file
> names from the owner's archive appear here; the sample lives OUTSIDE this repository
> (`D:\work\ai_sandbox\KPOT_SAMPLE`, a sibling of the repo, so git cannot reach it) and the archive
> path itself stays in agent memory — repo rule 5.

The owner authorised, in chat on 2026-07-26, making a representative copy of his real photo library
for testing. This is the Phase-5 acceptance work: the first time KPOT met real chaos.

---

## The sample

Not "the first N files" — a sample that missed a class of chaos would let KPOT look correct on it
and fail on the real thing. Selection is **stratified** over everything `researches/02` counted, and
deliberately drags in the cases that only exist in a real archive.

| | Archive | Sample |
|---|---:|---:|
| Files | 71 606 | **3 397** |
| Size | 551 GB | **13 GB** |
| Directories | 571 | **567** |
| Max depth | 6 | 7 |
| Top-level dirs | 59 | 58 |

Strata: every filename convention the survey catalogued (20 of them, incl. the single Windows-Phone
file); every rare extension in full (`.thm`, the Cyrillic `.без названия`, `.dng`, `.psd`, `.jp2`,
`.amr`, `.3ga`, `.mp3`, `.aac`, `.wmv`, `.gif`, `.webp`, `.mkv`, `.mod`, `.mts`); RAW and HEIC;
video inside a 1.5 GB budget plus a few large ones for realism; **duplicate groups** (both shapes:
same-name copies and renamed copies); **`+`-twins**; **THM sidecars together with their video
twins**; names with trailing dots/spaces; the deepest paths; the owner's own hand-sorted
`<year>/<season>` subtrees; device-dump dirs; and at least one file from nearly every directory.

**Copy integrity, verified rather than assumed:**
- mtime preserved on **3397/3397** — `copyFile` does not carry it, and file times are evidence here
  (the survey's bulk-copy spike is read from them), so a sample with fresh timestamps would have
  misrepresented the archive it stands for.
- sizes identical on 3397/3397; content confirmed by sha256 on 92 spread-out spot-checks.
- **the source archive is untouched: 0 files changed, 0 missing, of 71 606** — compared against an
  index taken before the copy. The grant is read-only and stayed read-only.

## What `kpot plan` did with it

16 seconds, 3397 files, 13 GB (cold cache).

| | |
|---|---:|
| Would move | 3 169 |
| Already in place | 162 |
| Stay (non-media) | 66 |
| Duplicate groups / copies set aside | 203 / 235 |
| Disputed cases | 588 |
| Name collisions | **0** |
| Folders emptied (would be deleted, rollback recreates) | 527 |
| Folders held for the owner's decision | 25 |

**How the dates were decided** — the evidence model's real-world distribution:

| Source | Files |
|---|---:|
| EXIF `DateTimeOriginal` | 847 |
| filename timestamp | 625 |
| held for the owner's decision | 480 |
| year known, season not | 280 |
| duplicate copy | 223 |
| video container (`mvhd`) | 212 |
| no date at all → global `ПРОЧЕЕ` | 159 |
| junk → quarantine | 117 |
| EXIF `ModifyDate` (fallback) | 97 |
| year+season from the owner's own directory name | 79 |
| filename epoch | 37 |
| assumed year from dated neighbours (flagged) | 13 |

**Disputed cases, by kind:** 308 implausible-year (broken camera clocks — exactly what the survey
predicted), 231 evidence conflicting with the winner, 28 ambiguous season (a bare «зима» dir), 13
assumed years, 8 timezone-boundary.

Coverage: **2007–2026 with a file in nearly every year**, which matches the owner's archive.

## What the run FOUND — the reason this exercise exists

1. **A real defect, caught immediately** (`bugs/02_DONE_epoch_false_positive.md`). A Samsung gallery
   *sequence number* has exactly the shape of a unix epoch and decoded convincingly to 2001-09-09,
   dragging a photo the owner keeps in his `2024/` folder into a year his archive has nothing in.
   1 of 37 epoch decodes — narrow, but the worst kind of wrong: confident, plausible, and it
   overrode the owner's own filing. Fixed by bounding filename-epoch decodes at **2008, the year the
   convention itself began**: a claim decoding to before Android existed contradicts itself. After
   the fix the file lands in `2024/Осень/` from its EXIF, and the `2001/` bucket is gone.
2. **An open question for the owner, not a defect:** one file carries EXIF `DateTimeOriginal` of
   `2000-01-01 00:25:13` — 1 January at ~00:00 is the classic reset-camera-clock default, and the
   archive otherwise starts in 2007. Whether to distrust such values is a policy decision about the
   owner's photos. Recorded in `STATUS.md`.
3. **A second defect, caught by the DRY RUN before anything moved**
   (`bugs/03_DONE_case_insensitive_noop.md`). The rehearsal reported 15 failures: the owner
   capitalises his season folders (`2025/Зима Конец Года/`), which on Windows is the same directory
   as KPOT's canonical `Зима конец года`, so files already home were planned to move onto
   themselves. `buildPlan` had compared paths with `!==` where `AGENT_GUIDE` mandates the
   `samePath` helper. 15 failed → 0. This is the dry run earning its place in the design.
4. **Nothing structural broke.** Zero name collisions across 3169 planned moves, zero read errors
   across 3397 files, no crash on Cyrillic extensions, trailing-dot names or depth-7 paths.

## The supervised sort itself (owner authorised it after reading the plan)

`kpot apply` on the sample: **7 seconds**, 3154 moves, 495 emptied folders removed, 0 failures.

**Nothing was lost, and that is measured rather than asserted:** the multiset of sha256 content
hashes over the whole tree is *identical* before and after — 3397 files / 12.11 GB either side, 0
hashes missing, 0 appearing from nowhere.

The backup: a manifest of 3397 files **and 593 directories**, plus 3397 hardlinks. Real disk cost of
the snapshot ≈ **nothing** — the volume's free space fell by 12.2 GB across the whole exercise,
which is the sample copy alone. Journal: 3154 `planned-move` + 3154 `moved` + 1112 `mkdir` + 495
`rmdir` + `done`.

A rollback **rehearsal** (`rollback --dry-run`) reports 3154 files restored and 495 folders
recreated, 0 failures — the undo is verified as ready without being spent.

Resulting shape: years 2007–2026, each with its seasons, `видео/` subdirs where videos exist, the
owner's own folder names preserved as nesting inside the seasons, `ПРОЧЕЕ/_дубликаты/` holding 223
copies, and `НА_РАЗБОР/` holding 480 files from 25 folders awaiting his decision. The 66 non-media
files stayed exactly where they were, as interview #001 decided.

## Why this sample is worth keeping

It is the harness's other half. Fixtures prove KPOT does what we *designed*; this proves it survives
what actually exists. It is deterministic to rebuild (selection is fully sorted, no randomness), it
lives outside the repository, and it must never be committed — it is the owner's real photographs.
