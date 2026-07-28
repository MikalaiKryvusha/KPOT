# Research 05 — Prior art: finding a photo's original by its pixels

> **Type:** prior-art review (`AGENT_GUIDE.md` checklist step 9a) — the first artifact required before
> designing an epic feature, established as canon by the owner on 2026-07-28: «почти на всё в
> индустрии есть золотые стандарты и научные работы».
> **Status:** ✅ done 2026-07-28. **Feeds:** `plans/02_lost_photo_family.md` §Шаг 2 — the design there
> is to be rewritten BY this document.
> **Privacy:** the measurements below ran read-only over the owner's real archive; aggregates only.
>
> **Sourcing rule of this artifact:** every factual claim carries a link **opened in this session**,
> or is explicitly marked as abstract-level / unverified. Sources I could NOT open are listed in §8
> rather than quoted from memory — an invented citation is worse than a missing one.

---

## 1. The question, and the constraints it must be answered against

**Question.** An edited export has no capture date of its own. Its original — the real photograph,
with a real `DateTimeOriginal` — is probably still somewhere in the archive, but cropped,
re-compressed and renamed. **Can we find that original from the pixels, reliably enough to inherit
its date?**

This is the last lever in `plans/02`: step 1 (metadata only) already rescued 199 of 201 such files
from false years, but 193 of them landed in `ПРОЧЕЕ` knowing only a "taken no later than" ceiling.

**Our constraints — every option below is judged against these, not in the abstract:**

| Constraint | Source |
|---|---|
| Near-zero dependencies; **no native build** | `AGENT_GUIDE.md` code style; a native dep needs an `/interview` |
| Pure Node ESM, no build step, Node ≥ 20 | `MASTER_PLAN.md` decision log, 2026-07-24 |
| Windows-first, Cyrillic/long paths | `researches/02` |
| **A date is never invented** — an unconvincing match must yield *nothing*, not a plausible year | internal map invariant 3 |
| Must scale to 71 606 files / 551 GB without hours of CPU | `researches/02` |
| KPOT already knows the camera, the sensor geometry and the ceiling date of the broken class | `plans/02` step 1, shipped |

## 2. What the field settled — the established approaches

Perceptual hashing is a mature, named family. The canonical open-source reference implementation is
**pHash** ([phash.org](https://www.phash.org/docs/), found via search — see §8), and the most-used
practical library is Johannes Buchner's Python **`imagehash`**, whose README I opened: it implements
**average hash (aHash)**, **perceptual hash (pHash, DCT-based)**, **difference hash (dHash)**,
**wavelet hash (wHash)**, **colorhash**, and — separately — **`crop_resistant_hash`**
([github.com/JohannesBuchner/imagehash](https://github.com/JohannesBuchner/imagehash), opened
2026-07-28). Notably its README makes **no claim about which is most robust**, and points at blog
posts for distance interpretation rather than embedding guidance — i.e. the "which one" question is
not settled by the popular library, it is settled by the task.

The four luminance hashes share one shape: **reduce the image to a tiny grid, quantise, emit ~64
bits, compare by Hamming distance.** They differ only in what they quantise (mean level, DCT
coefficients, neighbour differences, wavelet coefficients). That shared shape is exactly why they all
share one weakness (§5).

**`crop_resistant_hash` is architecturally different**, and this is the important find: per the
`imagehash` docs and multiple search results, it **segments the image and hashes each segment
separately**, so a single image yields *many* hashes and matching means "enough segments agree". It
is credited to **Steinebach, Liu & Yannikos, "Efficient Cropping-Resistant Robust Image Hashing",
ARES 2014** ([doi.org/10.1109/ARES.2014.85](https://doi.org/10.1109/ARES.2014.85) — abstract-level,
see §8), whose stated method is "combining image segmentation and efficient block mean image hashing".

## 3. The academic basis

- **Block mean value hashing** — Yang, Gu & Niu — is the algorithm behind `blockhash`
  ([blockhash.io](http://blockhash.io), via the npm package description, verified locally 2026-07-28).
  This matters practically: it is the one algorithm in this family with a **zero-dependency pure-JS
  implementation** (§4).
- **Zauner, "Implementation and Benchmarking of Perceptual Image Hash Functions", MSc thesis, Upper
  Austria UAS Hagenberg, 2010** — the standard benchmark reference, which built the *Rihamark*
  framework and compared DCT-based, Marr–Hildreth, radial-variance and block-mean hashes
  ([archived copy](https://archive.org/details/thesis_zauner_Implementation_and_benchmarking_of_perceptual_image_hash_functions);
  PDF at phash.org/docs/pubs/thesis_zauner.pdf). *Abstract/metadata level only — see §8.*
- **Steinebach et al., "Image Hashing Robust Against Cropping and Rotation", J. Cyber Security and
  Mobility** ([abstract opened](https://journals.riverpublishers.com/index.php/JCSANDM/article/view/19049),
  2026-07-28). Its abstract states the problem in one line: existing robust-hashing and
  feature-extraction methods "are either only partially robust to changes such as rotation and
  pruning, or they require a large amount of data and computation" — and the authors' answer is the
  hybrid **block hashing + segmentation + rotation normalisation**, chosen precisely to avoid the
  resource cost of ML approaches.
- **"Hamming Distributions of Popular Perceptual Hashing Techniques"**, DFRWS EU 2023
  ([arxiv.org/abs/2212.08035](https://arxiv.org/abs/2212.08035), abstract opened 2026-07-28) — a
  million-image-scale study of PDQ, NeuralHash and pHash focused on **the distribution of Hamming
  distances between unrelated images versus image variants**. The framing is the lesson we must
  copy: *a distance is meaningless without knowing what unrelated images score.* §6 below applies
  exactly that method to our own data.

## 4. The candidate implementations, judged against §1

Facts below are from the npm registry, read locally on 2026-07-28 (`npm view`), not from memory:

| Package | Version · date | Licence | Dependencies | Verdict against our constraints |
|---|---|---|---|---|
| **`jpeg-js`** | 0.4.4 · 2022-06-07 | **BSD-3-Clause** | **none** | ✅ the decoder. Pure JS, zero deps |
| **`blockhash-core`** | 0.1.0 · 2019-12-07 | MIT | **none** | ✅ block-mean hash, pure JS, zero deps. Stale but tiny and algorithmically frozen |
| `imghash` | 1.1.4 · 2026-04-25 | MIT | `@canvas/image`, blockhash-core, image-type, jpeg-js | ❌ pulls a canvas implementation |
| `image-hash` | 7.0.1 · 2025-11-13 | MIT | `@cwasm/webp`, file-type, jpeg-js, pngjs | ❌ more surface than we need |
| `sharp-phash` | 2.2.0 · 2024-10-31 | MIT | (needs **sharp**) | ❌ native build — an architecture fork, `/interview` territory |

> ⚠️ **Correction to `plans/02`, which this review exists to catch:** the plan states the dependency
> would be "`jpeg-js`, MIT". It is **BSD-3-Clause**. Still permissive and compatible with our MIT
> licence, but the plan asserted a licence it had not checked. Also worth recording: jpeg-js's decoder
> derives from **jpgjs (Apache-2.0)** and its encoder from as3corelib (Adobe BSD-style), per its
> README ([opened 2026-07-28](https://github.com/eugeneware/jpeg-js)).

**Consequence:** the minimum viable dependency count is **one** (`jpeg-js`), because the hash itself
is ~20 lines — the same call this project already made for the MP4 box parser. `blockhash-core` is a
second optional zero-dep package if we prefer a reference implementation over our own.

## 5. The failure modes other people documented — and then we measured

**Documented by others:**
- **Cropping and rotation break the global hashes.** This is the whole premise of the Steinebach
  line of work (§3): standard perceptual hashes "fail robustness tests under geometric
  transformations like cropping and rotation".
- **Robustness ≠ security.** The adversarial literature reports that an L2 perturbation of ~0.10 per
  pixel defeats 95% of images for dHash and 100% for continuous pHash (via the USENIX/arXiv results
  surfaced in search — abstract level, §8). Irrelevant to us (nobody is attacking a family archive)
  but it explains why thresholds published for moderation systems do not transfer.
- **Speed/robustness trade-off** is explicit across the comparative literature; pHash is more
  sensitive to content change, dHash more robust to scaling and compression.
- **Threshold choice is the real problem, not the algorithm** — the DFRWS study's entire framing.

**Measured by us, on the owner's own photographs (2026-07-28, read-only, 40 photos spread across the
archive, 64-bit hashes, centre crop keeping full height — the same shape the real Photoshop export
has).** The question: *does a global hash still recognise a cropped photo as itself?*

| | dHash median | blockhash median |
|---|---:|---:|
| **Unrelated photos (this is chance)** | **32** (p25 = 29, min = 19) | **32** (p25 = 28, min = 10) |
| Same photo, 90% of width kept | 19 | **6** |
| Same photo, 80% of width kept | 23 | **10** |
| Same photo, **70% kept — the real case** | **28** | **16** |
| Same photo, 50% of width kept | 29 | 20 |

**Read that table carefully, because it decides the design:**

1. **dHash is unusable here.** A merely 10%-cropped copy of the same photo already scores 19 — which
   is also the *minimum* distance observed between two completely unrelated photos. At the real crop
   ratio (2280/3264 = 70% of width kept) dHash sits at 28 against a chance median of 32. There is no
   threshold that separates "the same photo, cropped" from "a different photo".
2. **blockhash degrades far more gracefully** — 16 versus a chance median of 32 at the real crop
   ratio. Real separation exists.
3. **But the distributions still overlap**: the worst crop at 70% scored 26, while the closest pair of
   *unrelated* photos scored 10. **So a single global threshold over the whole archive would produce
   both false positives and false negatives** — and a false positive here means inventing a wrong
   capture date for the owner's photograph, which invariant 3 forbids outright.

**Honest limits of our own measurement** (stated because this document's job is to be trusted):
40 photos, one crop geometry, 64-bit hashes, centre crop only — no rotation, no re-compression on top
of the crop. And our probe's dHash used **nearest-neighbour sampling** rather than proper
area-averaged downscaling, which makes the dHash column somewhat pessimistic; the qualitative
conclusion for dHash is nevertheless the one the literature independently reports.

## 6. Two feasibility facts we no longer have to guess

Also measured 2026-07-28, read-only over the archive:

- **`jpeg-js` decodes the owner's progressive JPEGs.** This was the single risk that could have
  killed the whole approach: the broken class *is* editor exports, and `researches/03` observed them
  saved as **progressive (`SOF2`)**, which jpeg-js's README does not mention supporting. Measured:
  **25/25 progressive files decoded, 0 failures**, alongside 25/25 baseline. The unknown is closed.
- **Cost:** median ≈ **76 ms per megapixel** for progressive, ≈ **49 ms/MP** for baseline
  (single-threaded, this machine). An 8 MP photo ≈ 0.4–0.6 s. That is far too slow to run over
  everything — and §7 explains why we never need to.
  *(Census caveat: a first pass classified only 16 429 of 61 689 JPEGs because it scanned just the
  first 4 KB and large EXIF blocks push the SOF marker past it. Its "670 progressive" is a floor, not
  a total — recorded so nobody later quotes it as a census.)*

## 7. Recommendation

**Do not build "perceptual hashing over the archive". Build a targeted verifier over a tiny candidate
set — and let the pixels rank, never decide alone.**

The literature's crop problem is real and our own numbers confirm it. But the standard framing —
*search a whole corpus for a near-duplicate* — is not our problem. **KPOT already knows far more than
a generic search engine does**, because `plans/02` step 1 shipped: for a broken-class file it knows
the camera family, the sensor geometry, the folder's census and the "taken no later than" ceiling.
That collapses the candidate set from ~61 689 JPEGs to the order of **~100–200 same-camera photos
in the same folder, before the ceiling**.

That changes everything about the design:

1. **Candidates first, pixels second.** Only decode the handful of candidates step 1 already
   nominates. At ~0.5 s per decode, 200 candidates ≈ 100 s for one broken file — acceptable, cached,
   and it never touches the other 61 000 files.
2. **Use block-mean hashing, not dHash** — measured 16 vs 28 at the real crop ratio. Either
   `blockhash-core` (MIT, zero deps) or our own implementation of the same published algorithm.
3. **Rank, do not threshold.** We are not answering "is this the original?" but "**which candidate is
   most likely, and is it convincingly ahead of the runner-up?**" So the output is the best match
   *plus its margin over the second best*. A date is inherited only when the margin is decisive;
   otherwise the file stays in `ПРОЧЕЕ` with its ceiling, exactly as today. This is invariant 3
   expressed as a comparison rather than a threshold, and it is what makes a global-threshold false
   positive structurally impossible.
4. **Search over crop offsets, not just the whole frame.** Since the crop keeps full height and cuts
   width, comparing the export against *windows* of the candidate at several offsets and widths costs
   a few extra hash computations per pair and directly attacks the failure mode §5 measured. This is
   the cheap, bounded cousin of Steinebach's segmentation.
5. **Report the evidence like everything else here** — a new evidence kind (`pixel-original`) ranked
   with `derived-original`, whose detail names the file the date came from and the margin it won by,
   so the owner sees *why*.

**What we are deliberately NOT doing, and why:**
- **Not** a corpus-wide near-duplicate index — the cost is hours of CPU for a problem we can solve
  with a hundred comparisons, and it would import exactly the threshold problem §5 warns about.
- **Not** pHash/DCT or wavelet hashes — more code, and the crop weakness is shared by all global
  hashes anyway; block-mean measured best of the ones we can run with zero native dependencies.
- **Not** keypoint methods (SIFT/ORB) or ML embeddings — they are the genuinely crop-robust answer,
  and they are also a native/heavy dependency and an architecture fork. If ranking-with-margin proves
  insufficient in practice, *that* is the moment to bring the question to the owner, not before.
- **Not** PRNU (`plans/02` step 3) — unchanged: it answers "which camera", not "which shot".

## 8. Sources I could NOT open — listed, not quoted

Recorded so that nothing in this document rests on recollection dressed as a citation:

- `hackerfactor.com` "Looks Like It" (the origin of the aHash/pHash popularisation) — **HTTP 403**.
  Its algorithms are described here only as they appear in sources I did open.
- `dl.acm.org` full text of "Towards Image Hashing Robust Against Cropping and Rotation" — **403**.
  Used at abstract level via the River Publishers journal page, which did open.
- The Zauner thesis PDF and the arXiv 2212.08035 PDF — **abstract/metadata level only** (the arXiv
  PDF extraction returned unusable binary). No numeric result from either is quoted above.
- `npmjs.com` package pages — **403**; all package facts in §4 come from the registry via `npm view`,
  which is a stronger source anyway.
- USENIX/MDPI comparative papers — **search-result summaries only**, which is why the single figure
  taken from them (§5, adversarial perturbation) is attributed as such and load-bears nothing.

## Links

- `plans/02_lost_photo_family.md` — the plan this feeds; its §Шаг 2 design is superseded by §7 here.
- `researches/01_prior_art.md` — deferred perceptual hashing in 2026-07-24 on cost/benefit grounds:
  "real value, bad cost/benefit *for the MVP*". This document is that deferral being revisited on the
  owner's word, and it confirms the original instinct while finding a cheaper route.
- `researches/03_first_real_run.md` — where the broken class and its progressive-JPEG signature were
  first observed.
- `PROJECT_ARCHITECTURE_INTERNAL_MAP.md` — invariant 3 (a date is never invented), which §7.3 exists
  to satisfy.
