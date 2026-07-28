# Research 06 — Calibrating the pixel search for a photo's original, on the owner's real archive

> **Type:** recon / calibration (`AGENT_GUIDE.md` checklist step 9b) — the local measurement that
> `researches/05` §7 explicitly handed off ("what remains unknown and must be measured locally").
> **Status:** ✅ done 2026-07-28. **Feeds:** `plans/02_lost_photo_family.md` §Шаг 2 and
> `src/meta/pixels.mjs` — every constant in that module is a number from this document.
> **Privacy:** every measurement below ran READ-ONLY over the owner's real archive, through the
> library (not the CLI, which would have written a scan cache into his tree). Aggregates only; the
> two file names quoted in §5 are camera serials, not personal content.

---

## 1. The question

`researches/05` recommended a design without being able to test it: *candidates first, block-mean
hashing, decide by the margin between the best and the second-best candidate.* Three things had to
be measured on real photographs before that design could be trusted with the owner's dates:

1. **Does the margin actually separate** "this is the original" from "this is merely the closest of
   what happens to be lying around"?
2. **What happens when the original is NOT in the archive at all?** That is the dangerous case: the
   search must return nothing rather than the best available stranger.
3. **Where does the broken class actually live**, and does it have candidates near it?

## 2. Method

The archive contains no ground truth — nobody recorded which export came from which photograph. So
the ground truth was manufactured from the owner's own photographs, in the shape the real export has:

- take a real photo, **crop it** the way `researches/05` measured the real Photoshop export to be
  cropped (full sensor height, 70% of the width, off-centre), and **re-encode** it at quality 85 —
  which is what an editor export is;
- feed that crop to the search as a query, against the folder's photographs as candidates;
- **pool A**: the true original is among the candidates → the right answer exists;
- **pool B**: the true original *and every photo from its day* are removed → **no right answer
  exists**, and any acceptance is a fabricated date.

A second, harder crop geometry (55% of the width, offset 40%) was included so the numbers are not
tuned to one shape. Directories used: four real folders of the owner's PC dump (150 / 86 / 79 / 81
dated JPEGs, 8 / 5 / 16 / 29 distinct capture days) — deliberately different in how repetitive the
photography is.

## 3. What the coarse stage alone can and cannot do

First measurement, 16×16 block-mean hash (256 bits) over a 128-px preview, crop windows swept:

| | A: best distance | A: margin | B: best distance | B: margin |
|---|---|---|---|---|
| folder «Домашние» | median 26 | median 18 | median 42 (min **8**) | median 4, **max 10** |
| folder «Природа» | median 26 | median 22 | median 58 (min **2**) | median 8, **max 44** |

Two conclusions, and they are the whole design:

1. **The absolute distance decides nothing.** In pool B — where there IS no original — the best
   candidate scored **2–8 bits** in the best cases: better than the median true pair. Any global
   threshold would therefore have invented dates. This is exactly what `researches/05` §5 predicted
   from the literature, now confirmed on the owner's own files.
2. **The margin is a real discriminator**, but not a sufficient one at this resolution: in «Природа»
   a wrong candidate once led the field by 44 bits.

## 4. The finding that made the feature safe: resolution separates a crop from a look-alike

The failure in §3.2 has a name: a **look-alike** — the same scene photographed twice, on different
days. A coarse hash sees two identical images.

But a true crop/original pair is *the same pixels*, while a look-alike differs in every detail. So
the distance between a true pair should stay low as the comparison gets finer, and a look-alike's
should grow. Measured, refining the top candidate at 32×32 (1024 bits) over a 256-px preview:

| | true original (A) | best stranger (B) |
|---|---|---|
| «Природа», 10 trials | 4 · 9 · 22 · 36 · 38 · 40 · 56 · 70 · 73 · 89 | **20** · 212 · 264 · 268 · 296 · 316 · 332 · 334 · 379 · 412 |
| «Домашние», 10 trials | 6 · 7 · 9 · 22 · 36 · 38 · 40 · 56 · 73 · 174 | 52 · 61 · 164 · 220 · 228 · 270 · 276 · 298 · 340 · 417 |

A true pair lands **an order of magnitude closer**. That is why `src/meta/pixels.mjs` is two-stage:
a cheap 16×16 ranking to pick finalists, then a 32×32 verification of those finalists. The coarse
stage alone is not allowed to decide anything.

## 5. The end-to-end numbers of the shipped algorithm

Measured by calling the shipped `searchOriginal` itself (not a copy of it), 4 folders × 10 photos ×
2 crop geometries = **80 trials per pool**:

| | result |
|---|---|
| **A — the original is present** | accepted **62 / 80** (78%) |
| …and of those acceptances, the **right day** | **62 / 62 — no wrong date, ever** |
| **B — the original is absent** | **2 / 80** fabricated (2.5%) |

The 18 refusals in pool A are the price of the margin rule, and they are the *safe* failure: the file
simply stays where it is today — in `ПРОЧЕЕ` with its «снято не позже» ceiling.

**Both fabrications are the same pair of photographs.** `S8306413.JPG` (2011-11-04) and
`S8306731.JPG` (2012-05-01): the same scene, the same camera (Digimax S830), six months apart,
differing by 18–24 bits of 1024 — closer than many true pairs. When the true original was deleted
from the pool, its twin won decisively. **No pixel method can separate those two**, and this is
recorded as a permanent limit of the feature, not a bug to be fixed later. Note what happens when the
original is NOT deleted: the twin becomes the runner-up, the margin collapses, and the search
correctly refuses to decide — so the failure needs the original to be genuinely lost.

**Why not use colour to separate them.** Two photographs of one scene six months apart differ in
light, so a chroma comparison would probably split that pair. It was rejected on purpose: the query
is *an edited export*, and colour correction is the most common edit there is. A chroma gate would
look excellent against synthetic crops and then reject the real, colour-graded exports the whole
feature exists for. Luma block means compared against their own median are exposure-invariant by
construction; colour is not.

**A bug this calibration found in our own code.** The first end-to-end run fabricated a third date
(`fine=61`, margin reported as infinite). Cause: all five finalists happened to share one capture
day, so there was no different-day runner-up at all — and "no rival" was being read as "an infinite
margin". The fix reaches further down the ranking for a candidate from another day whenever the
finalists are unanimous; with it, that folder's false accepts went 1 → 0. Guarded by a spec that was
itself verified by breaking the code (`tests/meta_pixels.test.mjs`).

## 6. Where the broken class actually lives — and why the search had to look outward

A metadata-only census of the two PC-dump trees (reading the first 128 KB of each JPEG, no decoding):

| | files |
|---|---:|
| broken class — an editor's save date, no capture date | **201** (independently reproducing the 201 of `plans/02` step 1) |
| …of them in a folder that holds **≥ 3 dated photographs** | **31** |
| …of them in ONE folder holding **no dated photograph at all** («фоты на альб») | **166** |

`researches/05` §7 assumed the original sits in the same folder, generalising from the owner's own
example. **On his actual archive that assumption would have discarded 85% of the opportunity.** So
nomination walks outward: the file's own folder first, then its parent, then its grandparent
(`PIXEL_ANCESTOR_LEVELS = 2`), stopping at the first level that offers enough candidates. One level
up from the 166 files sits a subtree with ~80 dated photographs of the same camera family.

## 6a. What it actually recovers on the owner's real files — the honest number

The controlled trials of §5 answer "does the mechanism work". They do not answer "how much does it
help HIM", and those turn out to be very different questions. Full pipeline, read-only, over the
subtree that holds almost the whole broken class (763 files, 3 GB):

| | |
|---|---:|
| broken-class files in that subtree | **95** |
| dated by the pixel search | **1** |
| still undated | 94 |

The one it found is unambiguous — `ПЕРЕДЕЛКИ/S8305319 +.jpg` ← `ПЕРЕДЕЛКИ/S8305319.jpg`, distance
**30 of 1024** with a **margin of 284**: the export and the original are literally the same serial
number, one with a `+`. That is the mechanism doing exactly what it was built for.

**Why the other 94 are not a threshold problem.** For a sample of them, the best candidate scored
**182–376 of 1024 with margins of 0–32** — where a true pair scores 4–89 and needs a margin of 96.
Nothing was close and refused; nothing was close at all. Reading the files says why: the 83 album
pictures are 1880×2816 frames named `IMG_1244`-style, while the surrounding archive is a Samsung
whose files are `S83xxxxx`. **Those originals were never in this collection** — which independently
matches `researches/03`'s observation that the XMP identity chain also found zero originals.

So the feature's honest value on this archive today is: **it finds the originals that are there, and
it says nothing about the ones that are not.** The refusals are correct, not conservative.

## 7. The constants, and what each one is

| Constant | Value | Where the number comes from |
|---|---:|---|
| `PREVIEW_MAX_SIDE` | 128 | coarse ranking; a 16×16 grid still averages ~64 source pixels per block |
| `FINE_MAX_SIDE` / `FINE_GRID` | 256 / 32 | §4 — the resolution at which a true pair and a look-alike separate |
| `TOP_K` | 5 | the true original was never outside the coarse top-5 in any accepted trial |
| `PIXEL_MIN_CANDIDATES` | 3 | the same bar as `FAMILY_MIN_NEIGHBORS`: fewer is not a comparison |
| `PIXEL_MAX_DISTANCE` | 128 / 1024 | a sanity ceiling only — §3 proves an absolute threshold cannot decide |
| `PIXEL_MIN_MARGIN` | 96 / 1024 | between pool B's p90 (75) and pool A's p25 (110) — measured, not chosen |
| `PIXEL_ANCESTOR_LEVELS` | 2 | §6 — the census, not a guess |
| `PIXEL_MAX_CANDIDATES` | 500 | cost bound; when it bites, the evidence line says how many were compared |

**Cost:** ≈ 0.5 s per 8-megapixel candidate, once per candidate per run (both previews come from one
decode, and a folder's candidates are decoded once and reused by every query in it). Nothing is
decoded for a file that already has a date, and `--no-pixels` turns the whole stage off.

## 8. Honest limits

- **Two photographs of one scene cannot be told apart** (§5). If the original is genuinely lost and a
  twin survives, the twin's date is inherited. The evidence line names the file it came from, so the
  owner can contradict it — that is the only real mitigation, and it is why the plan prints that line.
- **Rotation is not handled.** A candidate whose EXIF orientation differs from the export's baked-in
  rotation will not match (`researches/05` §5 lists rotation among the documented failure modes).
- **JPEG only.** `jpeg-js` is the decoder; HEIC/PNG/RAW candidates are not nominated.
- **The trials are synthetic crops of real photographs**, not the real exports — because the real
  exports have no ground truth to check against. They match the real geometry, the real
  re-compression and the real folder statistics, but they are not colour-graded the way a genuine
  edit is. What follows is that the acceptance rate on genuine exports may be lower than 78%; the
  fabrication rate should not be higher, since a colour edit makes a match *worse*, not better.
- **Four folders, 160 trials.** Enough to choose constants, not enough to quote a precision figure to
  two decimal places.

## Links

- `researches/05_perceptual_hashing.md` — the prior-art review this calibrates; §7 is the design.
- `plans/02_lost_photo_family.md` §Шаг 2 — the plan step.
- `src/meta/pixels.mjs` — the implementation; every constant above appears there by name.
- `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` — invariant 3 (a date is never invented), which the margin
  rule exists to satisfy.
