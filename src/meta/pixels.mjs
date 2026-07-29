// src/meta/pixels.mjs — finding a photo's ACTUAL original by its pixels (plans/02 §Шаг 2).
// [TESTED: 2026-07-28 · tests/meta_pixels.test.mjs (15 specs) + the phase-2/phase-3 acceptance
// specs; every guard verified by breaking the code first (margin rule → 1 red, rival extension → 1
// red, same-day rivals → 2 red, nomination filters → 1 red, --no-pixels → 1 red, decode failure → 1
// red). Measured on the owner's real archive, read-only: 160 controlled trials — 62/80 accepted with
// the right day when the original is present, 2/80 fabricated when it is absent (researches/06 §5);
// full pipeline over the real broken class — 1 of 95 dated, and the 94 refusals verified as correct
// rather than shy (§6a)]
//
// The problem: an editor export has no capture date of its own. Step 1 already refuses to date it
// by the editor's save date, so 193 of the owner's real files sit in `ПРОЧЕЕ` knowing only a
// "taken no later than" ceiling. Their originals are almost certainly still in the archive —
// cropped, re-compressed and renamed, which is exactly what sha256 dedupe cannot see.
//
// The design here is NOT the one plans/02 §Шаг 2 originally described. That design (dHash over the
// whole archive) was refuted by measurement before a line was written — researches/05 §5: on 40 of
// the owner's own photos a mere 10% crop already scores 19 of 64 bits, which is also the MINIMUM
// distance between two completely unrelated photos. What this module implements is §7 of that
// document, plus one stage that our own measurement (researches/06) proved necessary:
//
//   1. **Candidates first, pixels second.** We never search the archive. Step 1 (`family.mjs`)
//      already knows the camera, the sensor geometry and the ceiling date, which collapses the
//      search from ~61 689 photos to the same-camera neighbours of one directory.
//   2. **Coarse ranking** — a 16×16 block-mean hash (Yang/Gu/Niu, the algorithm behind
//      blockhash.io) over a 128-px preview, searched across crop windows. Cheap, and good enough
//      to put the true original in the top few. It is NOT good enough to decide: measured on the
//      owner's archive, a LOOK-ALIKE (the same scene photographed on another day) can beat the
//      whole field at this resolution.
//   3. **Fine verification of the finalists** — the same comparison at 32×32 over a 256-px preview,
//      refined around the window the coarse stage found. This is the stage that separates "the same
//      photograph, cropped" from "the same scene, photographed twice": a true pair is the SAME
//      PIXELS and stays close as resolution grows, while a look-alike falls apart (measured: true
//      pairs ≤ 89 bits of 1024, look-alikes typically ≥ 212 — researches/06).
//   4. **Rank, never threshold.** The question is not "is this the original?" but "which candidate
//      is it, and is it decisively ahead of the runner-up?" A date is inherited only on a decisive
//      margin; otherwise the file stays honestly undated (internal map invariant 3). A global
//      threshold would invent wrong capture dates, and that is the one thing this product may not
//      do — a false positive here is a fabricated date on the owner's photograph.
//
// Honest limits, recorded rather than glossed (they are the shape of the next bug, if there is one):
//   · **Two photographs that are visually identical cannot be told apart by pixels.** If the true
//     original is absent AND a near-identical twin from another day is present, the twin's date is
//     inherited. Measured once in 20 negative trials (researches/06 §5). The evidence names the file
//     it came from, so the owner can see and contradict it — which is the only honest mitigation.
//   · **Rotation is not handled.** A candidate whose EXIF orientation differs from the export's
//     baked-in rotation will not match. researches/05 §5 names rotation as a documented failure mode
//     of every global hash; handling it would double the search and is not needed for the observed
//     class (Photoshop exports keep the frame upright).
//   · **JPEG only** — `jpeg-js` is the one decoder we allow ourselves (BSD-3-Clause, zero deps, no
//     native build). HEIC/PNG/RAW candidates are simply not nominated.
//   · Only same-directory candidates are nominated. The real broken class sits in the same folder as
//     its originals (researches/03); a tree-wide search would import the corpus-scale cost §7 exists
//     to avoid.
//
// Determinism (AGENT_GUIDE §canonical order): every step here is pure arithmetic over bytes —
// no clock, no randomness, candidates sorted by path, ties broken by path. The same archive always
// yields the same match and the same margin.

import jpegJs from 'jpeg-js';
import { makeEvidence } from './evidence.mjs';
import { counted } from '../core/words.mjs';

// --- Tunables (all named, all measured — see researches/06) ---------------------------------------

/** Longest side of the COARSE preview: the ranking stage runs on this. */
export const PREVIEW_MAX_SIDE = 128;

/** Longest side of the FINE preview: the verification stage runs on this. */
export const FINE_MAX_SIDE = 256;

/** Coarse hash grid: 16×16 block means = 256 bits (the size researches/05 measured). */
export const HASH_GRID = 16;

/** Fine hash grid: 32×32 = 1024 bits. Resolution is what separates a crop from a look-alike. */
export const FINE_GRID = 32;

/** Total bits a fine distance is measured in — the unit of both thresholds below. */
export const FINE_BITS = FINE_GRID * FINE_GRID;

/** How many of the coarse ranking's leaders are verified finely. Measured: the true original is in
 *  the coarse top-5 whenever it is found at all, and 5 fine verifications cost milliseconds. */
export const TOP_K = 5;

/** Positions per axis in the fine refinement, swept around the coarse winner's window. */
export const FINE_STEPS = 5;

/** How far the fine refinement looks around the coarse window, as a fraction of the preview side.
 *  The coarse sweep can only place the crop to within half a coarse step; this covers that error. */
export const FINE_SPAN = 0.08;

/** Window scales tried in the coarse stage, as a fraction of the aspect-fitted box (1.0 = the crop
 *  implied by the aspect ratios alone; the smaller one covers a crop that lost BOTH dimensions). */
export const WINDOW_SCALES = Object.freeze([1.0, 0.8]);

/** Offset positions swept along the cut axis at scale 1.0 (a full-height crop can sit anywhere). */
export const OFFSET_STEPS = 5;

/** Offsets per axis for the smaller scales (a 3×3 grid over the frame). */
export const OFFSET_STEPS_2D = 3;

/** How many candidates a decision needs before a margin means anything. Same bar as
 *  FAMILY_MIN_NEIGHBORS: fewer than this is not a comparison, it is a coincidence. */
export const PIXEL_MIN_CANDIDATES = 3;

/** How far OUTWARD the search may walk when the file's own folder holds too few candidates: its
 *  parent, then its grandparent, and no further. Measured need, not a guess — researches/06 §6:
 *  166 of the owner's 201 broken-class files sit in a folder with no dated photograph in it. */
export const PIXEL_ANCESTOR_LEVELS = 2;

/** Sanity ceiling on the winning FINE distance. Not the decision rule — the margin is; this only
 *  refuses a "best of a uniformly bad lot". Measured: true pairs reach 89, look-alikes start at 212. */
export const PIXEL_MAX_DISTANCE = 128;

/** How far ahead of the runner-up the winner must be, in fine bits, to be called decisive. */
export const PIXEL_MIN_MARGIN = 96;

/** Candidates per query, hard cap. Never silently applied: when it bites, the count that was
 *  actually compared is reported in the evidence detail (HANDOFF §8 — no silent caps). */
export const PIXEL_MAX_CANDIDATES = 500;

// --- Decoding ---------------------------------------------------------------------------------------

/** Rec.601 luma — the same weighting every perceptual hash in the literature reduces colour by. */
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Decode a JPEG to RGBA. Failure is silence, never an exception: a real archive contains truncated,
 * exotic and simply broken JPEGs, and one of them must not abort a scan (AGENT_GUIDE §code style).
 * The fixture's metadata-only JPEGs land here too — they carry no scan data, so they decode to
 * nothing and nominate nothing.
 * @returns {{data: Uint8Array, width: number, height: number}|null}
 */
export function decodeRgba(buffer) {
  try {
    const img = jpegJs.decode(buffer, { useTArray: true, tolerantDecoding: true, formatAsRGBA: true });
    if (!img?.width || !img?.height || !img.data || img.data.length < img.width * img.height * 4) return null;
    return img;
  } catch {
    return null;
  }
}

/**
 * Reduce a decoded RGBA image to a small grayscale preview by BOX AVERAGING — not nearest-neighbour
 * sampling, which researches/05 §5 flags as what made its own dHash probe pessimistic.
 * @returns {{data: Uint8Array, width: number, height: number, srcWidth: number, srcHeight: number}}
 */
export function downsampleGray({ data, width: sw, height: sh }, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.floor((y * sh) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / h));
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor((x * sw) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / w));
      let sum = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        let i = (sy * sw + x0) * 4;
        for (let sx = x0; sx < x1; sx += 1, i += 4) {
          sum += luma(data[i], data[i + 1], data[i + 2]);
          n += 1;
        }
      }
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return { data: out, width: w, height: h, srcWidth: sw, srcHeight: sh };
}

/** One decode, both previews — the decode is the expensive part (≈0.5 s for an 8 MP photo). */
export function imagePreviews(buffer) {
  const rgba = decodeRgba(buffer);
  if (!rgba) return null;
  return {
    coarse: downsampleGray(rgba, PREVIEW_MAX_SIDE),
    fine: downsampleGray(rgba, FINE_MAX_SIDE),
  };
}

/** Convenience for probes and specs: decode straight to one preview. */
export function grayPreview(buffer, { maxSide = PREVIEW_MAX_SIDE } = {}) {
  const rgba = decodeRgba(buffer);
  return rgba ? downsampleGray(rgba, maxSide) : null;
}

// --- Block-mean hashing -----------------------------------------------------------------------------

/**
 * The summed-area table of a preview, built once and cached ON the preview object.
 *
 * This is what makes ranking affordable rather than merely correct: a window's block mean becomes
 * four lookups instead of "add up every pixel in the block", and the ranking stage computes 14
 * windows × 256 blocks for each of up to 500 candidates. Measured on the owner's archive, the
 * pixel-free version of this loop was the run's bottleneck, not the JPEG decoding.
 *
 * Uint32 is exact here: the values summed are bytes, and even a 256×256 preview tops out at
 * ~16.7 million — well inside the type. So this is an optimisation with no numerical cost.
 */
export function ensureIntegral(preview) {
  if (preview.sum) return preview.sum;
  const { data, width: w, height: h } = preview;
  const S = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += data[y * w + x];
      S[(y + 1) * (w + 1) + (x + 1)] = S[y * (w + 1) + (x + 1)] + row;
    }
  }
  preview.sum = S;
  return S;
}

/**
 * The block-mean hash of a rectangular WINDOW of a preview: the window is divided into grid×grid
 * blocks, each block's mean luma is compared against the median of all block means, and the bits
 * are that comparison. Comparing against the median (rather than a fixed level) is what makes the
 * hash survive exposure and re-compression changes — it encodes the image's SHAPE, not its levels.
 *
 * @param {{data: Uint8Array, width: number, height: number}} preview
 * @param {{x?: number, y?: number, w?: number, h?: number}} [rect]  defaults to the whole preview
 * @param {number} [grid]
 * @returns {Uint8Array}  grid*grid bits, one per byte (comparison cost is irrelevant at this size)
 */
export function windowHash(preview, rect = {}, grid = HASH_GRID) {
  const { x = 0, y = 0, w = preview.width, h = preview.height } = rect;
  const S = ensureIntegral(preview);
  const stride = preview.width + 1;
  const means = new Float64Array(grid * grid);
  for (let by = 0; by < grid; by += 1) {
    const y0 = y + Math.floor((by * h) / grid);
    const y1 = Math.min(preview.height, Math.max(y0 + 1, y + Math.floor(((by + 1) * h) / grid)));
    for (let bx = 0; bx < grid; bx += 1) {
      const x0 = x + Math.floor((bx * w) / grid);
      const x1 = Math.min(preview.width, Math.max(x0 + 1, x + Math.floor(((bx + 1) * w) / grid)));
      const area = (x1 - x0) * (y1 - y0);
      means[by * grid + bx] = area > 0
        ? (S[y1 * stride + x1] - S[y0 * stride + x1] - S[y1 * stride + x0] + S[y0 * stride + x0]) / area
        : 0;
    }
  }
  const sorted = Float64Array.from(means).sort();
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const bits = new Uint8Array(means.length);
  for (let i = 0; i < means.length; i += 1) bits[i] = means[i] > median ? 1 : 0;
  return bits;
}

/** Hamming distance between two equal-length bit arrays. */
export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) d += 1;
  return d;
}

/**
 * The windows of a candidate worth comparing against a query of a given aspect ratio.
 *
 * The insight that makes this cheap: a crop CHANGES THE ASPECT RATIO, and the change says which
 * window shape to look for. The owner's real case keeps the full sensor height and cuts the width
 * (2280×2448 out of 3264×2448), so the aspect-fitted box at scale 1.0 IS that crop — all that is
 * left to find is where along the width it sat. The smaller scale covers a crop that lost both
 * dimensions; scale 1.0 over the whole frame covers "not cropped at all, just re-encoded".
 *
 * @param {{width: number, height: number}} preview  the CANDIDATE's preview
 * @param {number} queryAspect  query width / height, from its real pixel dimensions
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 */
export function cropWindows(preview, queryAspect) {
  const { width: cw, height: ch } = preview;
  const candAspect = cw / ch;
  const windows = [];
  const push = (x, y, w, h) => {
    if (w >= 8 && h >= 8 && x >= 0 && y >= 0 && x + w <= cw + 0.5 && y + h <= ch + 0.5) {
      windows.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    }
  };

  for (const scale of WINDOW_SCALES) {
    let boxW; let boxH;
    if (queryAspect <= candAspect) { boxH = ch * scale; boxW = boxH * queryAspect; } // width was cut
    else { boxW = cw * scale; boxH = boxW / queryAspect; }                           // height was cut
    const freeX = cw - boxW;
    const freeY = ch - boxH;
    // At scale 1.0 exactly one axis has slack — sweep it finely. Smaller scales have slack on both.
    const stepsX = freeX < 1 ? 1 : (scale === 1 ? OFFSET_STEPS : OFFSET_STEPS_2D);
    const stepsY = freeY < 1 ? 1 : (scale === 1 ? OFFSET_STEPS : OFFSET_STEPS_2D);
    for (let iy = 0; iy < stepsY; iy += 1) {
      for (let ix = 0; ix < stepsX; ix += 1) {
        push(stepsX === 1 ? 0 : (freeX * ix) / (stepsX - 1),
             stepsY === 1 ? 0 : (freeY * iy) / (stepsY - 1), boxW, boxH);
      }
    }
  }
  // De-duplicate identical rectangles (a square query against a square candidate collapses them).
  const seen = new Set();
  return windows.filter((r) => {
    const key = `${r.x},${r.y},${r.w},${r.h}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Coarse stage: the best window of one candidate, and WHERE it sat — the fine stage refines there.
 * @returns {{distance: number, rect: object|null}}
 */
export function coarseScore(queryHash, queryAspect, coarsePreview) {
  let best = { distance: queryHash.length, rect: null };
  for (const rect of cropWindows(coarsePreview, queryAspect)) {
    const distance = hamming(queryHash, windowHash(coarsePreview, rect));
    if (distance < best.distance) best = { distance, rect };
  }
  return best;
}

/**
 * Fine stage: the same comparison at FINE_GRID over the FINE preview, swept around the coarse
 * window. This is the stage that tells a crop from a look-alike (researches/06 §4).
 * @returns {number} the best fine distance, of FINE_BITS
 */
export function fineScore(queryFineHash, coarsePreview, coarseRect, finePreview) {
  if (!coarseRect) return FINE_BITS;
  const k = finePreview.width / coarsePreview.width; // coarse → fine coordinates
  const w = coarseRect.w * k;
  const h = coarseRect.h * k;
  const spanX = finePreview.width * FINE_SPAN;
  const spanY = finePreview.height * FINE_SPAN;
  let best = FINE_BITS;
  for (let iy = 0; iy < FINE_STEPS; iy += 1) {
    for (let ix = 0; ix < FINE_STEPS; ix += 1) {
      const x = coarseRect.x * k + spanX * ((ix / (FINE_STEPS - 1)) * 2 - 1);
      const y = coarseRect.y * k + spanY * ((iy / (FINE_STEPS - 1)) * 2 - 1);
      if (x < 0 || y < 0 || x + w > finePreview.width + 0.5 || y + h > finePreview.height + 0.5) continue;
      const d = hamming(queryFineHash, windowHash(finePreview,
        { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, FINE_GRID));
      if (d < best) best = d;
    }
  }
  return best;
}

// --- The decision ------------------------------------------------------------------------------------

/** The capture DAY a candidate claims ('YYYY-MM-DD'), used to tell real rivals from the same shoot. */
const dayOf = (date) => (typeof date === 'string' ? date.slice(0, 10) : '');

/**
 * Rank the finalists and decide whether the winner is decisive.
 *
 * The runner-up is deliberately the best candidate from a DIFFERENT DAY. Two copies of the same
 * photograph — or two frames of one burst — score almost identically, and treating them as rivals
 * would refuse every archive that contains a duplicate, which is most of them. Since both yield the
 * same date, they cannot make the answer wrong; only a candidate that would give a DIFFERENT answer
 * is a real rival.
 *
 * @param {Array<{path: string, distance: number, date: string}>} scored  FINE distances
 * @param {number} [compared]  how many candidates were ranked at the coarse stage
 * @returns {{best: object|null, runnerUp: object|null, margin: number, decisive: boolean,
 *            compared: number}}
 */
export function decideByMargin(scored, compared = scored.length) {
  if (scored.length === 0) return { best: null, runnerUp: null, margin: 0, decisive: false, compared };
  // Sort by distance, then by path — a tie must not depend on enumeration order.
  const ranked = [...scored].sort((a, b) => a.distance - b.distance || (a.path < b.path ? -1 : 1));
  const best = ranked[0];
  const runnerUp = ranked.find((c) => dayOf(c.date) !== dayOf(best.date)) ?? null;
  const margin = runnerUp ? runnerUp.distance - best.distance : Infinity;
  const decisive = compared >= PIXEL_MIN_CANDIDATES
    && best.distance <= PIXEL_MAX_DISTANCE
    && margin >= PIXEL_MIN_MARGIN;
  return { best, runnerUp, margin, decisive, compared };
}

/**
 * The whole search for ONE query over already-decoded candidate previews. Pure: no I/O, no clock.
 *
 * @param {{previews: {coarse: object, fine: object}}} query
 * @param {Array<{path: string, date: string, previews: {coarse: object, fine: object}}>} candidates
 * @returns {ReturnType<typeof decideByMargin>}
 */
export function searchOriginal(query, candidates) {
  const { coarse: qCoarse, fine: qFine } = query.previews;
  const queryHash = windowHash(qCoarse);
  const queryFineHash = windowHash(qFine, {}, FINE_GRID);
  const queryAspect = qCoarse.srcWidth / qCoarse.srcHeight;

  const ranked = candidates
    .map((c) => ({ c, ...coarseScore(queryHash, queryAspect, c.previews.coarse) }))
    .sort((a, b) => a.distance - b.distance || (a.c.path < b.c.path ? -1 : 1));

  const verify = (s) => ({
    path: s.c.path,
    date: s.c.date,
    asset: s.c.asset,
    coarse: s.distance,
    distance: fineScore(queryFineHash, s.c.previews.coarse, s.rect, s.c.previews.fine),
  });

  let finalists = ranked.slice(0, TOP_K).map(verify);
  let decision = decideByMargin(finalists, candidates.length);

  // The margin needs something to lose against. If every finalist happens to claim the SAME DAY the
  // runner-up is empty and ANY match looks decisive — which is exactly how a wrong original was
  // accepted at fine=61 during calibration (researches/06 §5). So when that happens, reach further
  // down the coarse ranking for the best candidate from a different day and verify it too.
  if (decision.best && decision.runnerUp === null) {
    const winnerDay = dayOf(decision.best.date);
    const rival = ranked.find((s) => dayOf(s.c.date) !== winnerDay
      && !finalists.some((f) => f.path === s.c.path));
    if (rival) {
      finalists = [...finalists, verify(rival)];
      decision = decideByMargin(finalists, candidates.length);
    }
  }
  return decision;
}

// --- Candidate nomination -----------------------------------------------------------------------------

/** The one evidence kind whose date is a REAL shutter moment read from the file itself. */
const capturedBy = (asset) => (asset.evidence ?? []).find((e) => e.kind === 'exif-original');

/**
 * Which same-directory photos could be this export's original.
 *
 * Everything here is a fact step 1 already established — the point of §7 is that we never search:
 *   · a real capture date of its own (`exif-original`), because a date is only ever inherited from
 *     a genuine shutter moment; inheriting an assumption would launder a guess into a fact;
 *   · the camera family, when `family.mjs` named one (by EXIF or by sensor geometry);
 *   · not later than the editor's save-date ceiling — a photograph cannot be the original of an
 *     export that already existed;
 *   · decodable by us: JPEG.
 *
 * @param {object} query      the undated editor export
 * @param {object[]} dirAssets  every media asset of the same directory
 * @param {{model?: string|null, noLaterThan?: string|null}} [family]  from familyFacts()
 * @returns {{candidates: object[], available: number}}  `available` is the count BEFORE the cap
 */
export function nominateCandidates(query, dirAssets, family = {}) {
  const ceiling = family?.noLaterThan ?? null; // 'YYYY-MM'
  const all = (dirAssets ?? []).filter((a) => {
    if (a === query || a.kind !== 'photo' || a.format !== 'jpeg') return false;
    if (!capturedBy(a) || a.verdict?.status !== 'dated') return false;
    if (family?.model && a.facts?.model && a.facts.model !== family.model) return false;
    if (ceiling && a.verdict.date && a.verdict.date.slice(0, 7) > ceiling) return false; // 'YYYY-MM'
    return true;
  });
  all.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { candidates: all.slice(0, PIXEL_MAX_CANDIDATES), available: all.length };
}

/**
 * The `pixel-original` Evidence for a decisive match: the ORIGINAL's real capture date, carried by
 * a claim that names the file it came from AND the margin it won by — so the owner reads not just
 * "2013-07-20" but why we believe it.
 *
 * @param {{best: object, margin: number, compared: number}} decision  from searchOriginal
 * @param {object} originalAsset  the winning candidate's asset
 * @param {{available?: number}} [opts]
 * @returns {object|null}
 */
export function pixelEvidence(decision, originalAsset, { available = 0 } = {}) {
  const capture = capturedBy(originalAsset);
  if (!capture) return null;
  // Owner-facing text (he asked for plain language, 2026-07-28): «no rival» is not a margin, it is
  // the case where every candidate is from the SAME DAY — so whichever won, the date is the same.
  // Phase 6.6. This line used to read «различие 26 из 1024, отрыв от следующего 360, сравнивалось
  // снимков: 4» — every number true, and nothing a person can do with any of them. What he needs is
  // WHICH file it is (so he can look at it with his own eyes) and HOW SURE we are, said in words.
  // The numbers are not lost: they stay in the machine artifact, where a number belongs.
  // Two states, not three: this evidence only exists when the decision was ACCEPTED, and acceptance
  // already required a decisive margin (PIXEL_MIN_MARGIN). Inventing a second threshold to grade
  // confidence further would put a number on the page that nothing measured — worse than none.
  const sureness = Number.isFinite(decision.margin)
    ? 'совпадение уверенное — остальные снимки рядом похожи заметно меньше'
    : 'все похожие снимки сделаны в один день, так что дата от выбора не зависит';
  const looked = counted(decision.compared, 'снимок', 'снимка', 'снимков');
  return makeEvidence('pixel-original', {
    wall: capture.wall,
    dateOnly: capture.dateOnly,
    detail: `исходный снимок: ${originalAsset.path}\n    ${sureness}; `
      + `рядом посмотрели ${looked}`,
  });
}
