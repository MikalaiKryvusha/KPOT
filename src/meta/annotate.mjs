// src/meta/annotate.mjs — runs the whole evidence pipeline over a scan result: for every MEDIA
// asset, collect all date evidence and resolve it into a DateVerdict.
// [TESTED: 2026-07-24 · acceptance spec + real CLI smoke (15 dated · 1 partial · 2 unknown = ground
// truth exactly); 55/55 · 2026-07-27 · plans/02 passes covered by tests/meta_plan02.test.mjs]
//
// This is the composition point of src/meta/: scan produces bare Assets (identity + kind + hash),
// annotate attaches the "when" — evidence list + verdict — in place. Read-only over user files
// (RULE 1): it opens files to READ metadata segments, writes nothing. bin/kpot.mjs calls
// scanTree → annotateAssets to build the full scan map (RULE 2: bin composes siblings; scan and
// meta never import each other).
//
// Pass order matters and is deliberate (plans/02 step 1):
//   1. per-file evidence (EXIF/XMP + container + names) — also collects FACTS (camera, geometry,
//      XMP identity) for photos;
//   2. derived-original — an export whose XMP DerivedFrom names another file's DocumentID inherits
//      that ORIGINAL's real DateTimeOriginal (an exact match, not a guess);
//   3. corpus inference for what is still undated — dir-cohort (neighbors' year consensus) and
//      family (same-camera neighbors + geometry + the editor-save ceiling), both flagged ASSUMED.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mapLimit } from '../core/pool.mjs';
import { wallInWords } from '../core/words.mjs';
import { exifExtract } from './exif.mjs';
import { mp4Evidence } from './mp4.mjs';
import { allNameEvidence } from './filename_date.mjs';
import { dirnameEvidence } from './dirname_date.mjs';
import { detectMtimeSpikeDays, mtimeEvidence, resolveDate } from './resolve.mjs';
import { cohortYearByDir, cohortEvidence } from './cohort.mjs';
import { familyFacts, familyEvidence } from './family.mjs';
import { pairSidecars, sidecarEvidence } from './sidecar.mjs';
import {
  imagePreviews, nominateCandidates, pixelEvidence, searchOriginal,
  PIXEL_ANCESTOR_LEVELS, PIXEL_MIN_CANDIDATES,
} from './pixels.mjs';
import { formatWall, isPlausibleYear, isResetClockShape, makeEvidence } from './evidence.mjs';

/** Kinds that get evidence + a verdict; junk/other are not dated (they are not sorted by date). */
const MEDIA_KINDS = new Set(['photo', 'video', 'audio']);

/** Default bounded concurrency for metadata reads. */
export const DEFAULT_CONCURRENCY = 8;

/** Collect every date-evidence claim for one asset; photos also gain `asset.facts`. */
async function collectEvidence(root, asset, sidecars = []) {
  const abs = join(root, ...asset.path.split('/'));
  const basename = asset.path.split('/').at(-1);
  const out = [];
  // container/metadata evidence first — photos carry EXIF/XMP, videos carry mvhd
  if (asset.kind === 'photo') {
    const { evidence, facts } = exifExtract(await readFile(abs));
    out.push(...evidence);
    if (Object.keys(facts).length > 0) asset.facts = facts;
  }
  if (asset.kind === 'video') out.push(...(await mp4Evidence(abs)));
  out.push(...allNameEvidence(basename));
  out.push(...dirnameEvidence(asset.path));
  // A THM/XMP twin's date (researches/04). It ranks below every real capture source, so it only
  // ever fills a gap — which for the archive's 25 AVI files is the difference between a bare year
  // and an exact timestamp, because AVI carries no container date at all.
  for (const sc of sidecars) {
    out.push(...(await sidecarEvidence(join(root, ...sc.split('/')), sc)));
  }
  return out; // fs-mtime is appended by the caller, which knows the corpus-level spike days
}

/** Resolve (or re-resolve) one asset's verdict in place, keeping evidence rank-sorted. */
function applyVerdict(asset, evidence, now, resetFloorYear = null) {
  const { evidence: ranked, ...verdict } = resolveDate(evidence, { now, resetFloorYear });
  asset.evidence = ranked;
  asset.verdict = verdict;
}

/**
 * Evidence kinds that report an actual capture moment recorded at the time — the only claims strong
 * enough to say when this collection's photography BEGAN. Inferred years (dirname, cohort, family)
 * are excluded on purpose: they are guesses, and a guess must not be allowed to discredit a date.
 */
const CAPTURE_KINDS = new Set([
  'exif-original', 'derived-original', 'pixel-original',
  'filename-timestamp', 'sidecar',
]);

/** A year counts as part of the collection's era once it holds this share of all capture claims… */
export const FLOOR_MIN_SHARE = 0.001; // 0.1%
/** …but never fewer than this many files, so a small tree still has a usable floor. */
export const FLOOR_MIN_COUNT = 3;

/**
 * The earliest year this archive can honestly claim to contain photographs from — the corpus-level
 * fact that turns "1 January just after midnight" from a suspicion into a finding (owner's decision,
 * 2026-07-28; see `resolve.mjs` rule 5).
 *
 * It is the earliest **populated** year, not the earliest claim, and that distinction is not
 * theoretical: measured over the owner's whole archive (61 723 images, 47 247 with a capture date),
 * the earliest claim is 2000 — held by exactly four files, two of which are the very broken-clock
 * file this rule exists to catch. A floor built from the minimum would therefore have been set BY
 * the defect and would have cleared it. Counting population instead gives 2005 (1 526 photographs),
 * and the false 2000 date is refused while every real New Year photograph in the archive (2014-01-01
 * 00:01, 2015-01-01 00:21 — 13 of them) is untouched.
 *
 * Two exclusions on top: claims that themselves have the reset shape never count (one broken camera
 * must not license another), and implausible years are ignored (a 1979 EXIF is a defect, not the
 * start of a collection).
 *
 * @param {object[][]} evidenceLists  every media file's evidence
 * @param {Date} now
 * @returns {number|null}  null when no year is populated enough to prove anything — and then the
 *                         rule never fires, which is the honest answer for a tiny tree
 */
export function corpusFloorYear(evidenceLists, now = new Date()) {
  const perYear = new Map();
  let total = 0;
  for (const list of evidenceLists) {
    for (const ev of list) {
      if (!CAPTURE_KINDS.has(ev.kind) || !ev.wall) continue;
      if (isResetClockShape(ev.wall)) continue;
      if (!isPlausibleYear(ev.wall.year, now)) continue;
      perYear.set(ev.wall.year, (perYear.get(ev.wall.year) ?? 0) + 1);
      total += 1;
    }
  }
  if (total === 0) return null;
  const needed = Math.max(FLOOR_MIN_COUNT, Math.ceil(total * FLOOR_MIN_SHARE));
  const populated = [...perYear.entries()].filter(([, n]) => n >= needed).map(([y]) => y);
  return populated.length > 0 ? Math.min(...populated) : null;
}

/** '/'-separated parent directory of a relative asset path. */
const dirOf = (relPath) => relPath.split('/').slice(0, -1).join('/');

/**
 * Pass 2 (plans/02 §1.2): exact original lookup by the XMP identity chain. Deterministic: when
 * several files share a DocumentID (copies), the lexicographically first path with a real capture
 * date is the reference — path order, never enumeration order (AGENT_GUIDE §canonical order).
 */
function inheritFromOriginals(annotated, now, resetFloorYear) {
  const byDocId = new Map(); // DocumentID → the asset to inherit from
  for (const a of [...annotated].sort((x, y) => (x.path < y.path ? -1 : 1))) {
    const id = a.facts?.documentId;
    if (!id || byDocId.has(id)) continue;
    if (a.evidence.some((e) => e.kind === 'exif-original')) byDocId.set(id, a);
  }
  for (const asset of annotated) {
    const ref = asset.facts?.derivedFrom ? byDocId.get(asset.facts.derivedFrom) : undefined;
    if (!ref || ref === asset) continue;
    const orig = ref.evidence.find((e) => e.kind === 'exif-original');
    if (!orig) continue;
    const inherited = makeEvidence('derived-original', {
      wall: orig.wall,
      dateOnly: orig.dateOnly,
      // Owner-facing text: this detail is printed in the plan's «даты, взятые у исходного снимка»
      // section, and the owner asked for plain language without jargon (2026-07-28). «XMP
      // DocumentID» was still in it until phase 6.6 — the name of a metadata field, in Latin, in
      // the middle of a Russian sentence explaining where his photograph's date came from. What
      // matters to him is that the editor itself left the link, so nobody had to guess.
      detail: `исходный снимок: ${ref.path}\n    снят ${wallInWords(orig.wall)}; `
        + 'фоторедактор сам записал, из какого файла сделан этот — гадать не пришлось',
    });
    applyVerdict(asset, [...asset.evidence, inherited], now, resetFloorYear);
  }
}

/**
 * Pass 4 (plans/02 §Шаг 2): the original found BY ITS PIXELS, when no identifier led to it.
 *
 * This is the only place in KPOT that decodes an image, and it is deliberately the LAST resort: it
 * runs solely for editor exports that steps 1–3 could not date, and it compares them only against
 * the same-directory candidates `family.mjs` already nominated. Design and the measurements behind
 * every constant: researches/05 §7 and researches/06.
 *
 * Decoding is grouped BY DIRECTORY on purpose: a folder's candidates are decoded once, reused by
 * every query in that folder, and dropped before the next one — the previews of a 400-photo folder
 * are megabytes, and holding a whole archive's worth would not fit.
 *
 * @returns {Promise<number>} how many files got a date this way
 */
async function inheritFromPixels(root, annotated, byDir, now, { progress = null, resetFloorYear = null } = {}) {
  const isBrokenClass = (a) => a.kind === 'photo' && a.format === 'jpeg'
    && a.verdict.status !== 'dated'
    && a.evidence.some((e) => e.kind === 'editor-save');

  const dirs = new Map(); // dir → queries, in path order (determinism)
  for (const a of [...annotated].sort((x, y) => (x.path < y.path ? -1 : 1))) {
    if (!isBrokenClass(a)) continue;
    const dir = dirOf(a.path);
    if (!dirs.has(dir)) dirs.set(dir, []);
    dirs.get(dir).push(a);
  }
  if (dirs.size === 0) return 0;

  // Where to look for the original: its OWN folder first, then outward through the ancestors, one
  // level at a time, stopping at the first level that offers enough candidates.
  //
  // Measured on the owner's archive (researches/06 §6) — this is not a generalisation: 201 files are
  // in the broken class, and 166 of them sit in ONE folder that holds no dated photo at all («фоты
  // на альб» — pictures collected for an album). Searching strictly inside the folder, as
  // researches/05 §7 assumed from the owner's own example, could have helped 31 of 201. One level up
  // the same subtree holds ~80 dated photographs of the same family.
  const poolFor = (query) => {
    let dir = dirOf(query.path);
    for (let level = 0; level <= PIXEL_ANCESTOR_LEVELS; level += 1) {
      const pool = level === 0
        ? (byDir.get(dir) ?? [])
        : annotated.filter((a) => (dir === '' ? true : a.path.startsWith(`${dir}/`)));
      const nominated = nominateCandidates(query, pool, query.verdict.family);
      if (nominated.candidates.length >= PIXEL_MIN_CANDIDATES) return nominated;
      if (dir === '') break;
      dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    }
    return { candidates: [], available: 0 };
  };

  // Nominate first, decode second: a query whose neighbourhood holds too few candidates costs nothing.
  const jobs = [];
  let decodes = 0;
  for (const [, queries] of dirs) {
    const nominated = queries
      .map((query) => ({ query, ...poolFor(query) }))
      .filter((j) => j.candidates.length >= PIXEL_MIN_CANDIDATES);
    if (nominated.length === 0) continue;
    const files = new Set();
    for (const j of nominated) { files.add(j.query); for (const c of j.candidates) files.add(c); }
    decodes += files.size;
    jobs.push({ nominated, files: [...files] });
  }
  if (jobs.length === 0) return 0;

  progress?.start('Ищу оригиналы по пикселям', decodes);
  let found = 0;
  for (const job of jobs) {
    const previews = new Map();
    for (const asset of job.files) {
      try {
        previews.set(asset.path, imagePreviews(await readFile(join(root, ...asset.path.split('/')))));
      } catch {
        previews.set(asset.path, null); // unreadable is not fatal — this file simply cannot compete
      }
      progress?.tick();
    }
    for (const { query, candidates, available } of job.nominated) {
      const qp = previews.get(query.path);
      if (!qp) continue; // the export itself did not decode (truncated, or metadata-only)
      const pool = candidates
        .map((asset) => ({ path: asset.path, date: asset.verdict.date, asset, previews: previews.get(asset.path) }))
        .filter((c) => c.previews);
      if (pool.length < PIXEL_MIN_CANDIDATES) continue;
      const decision = searchOriginal({ previews: qp }, pool);
      if (!decision.decisive) continue; // no decisive margin → the file stays honestly undated
      const evidence = pixelEvidence(decision, decision.best.asset, { available });
      if (!evidence) continue;
      applyVerdict(query, [...query.evidence, evidence], now, resetFloorYear);
      found += 1;
    }
  }
  progress?.done(null);
  return found;
}

/**
 * Annotate media assets IN PLACE with `evidence` and `verdict`; returns verdict counts for
 * reporting. Per-file metadata failures land in `errors`, never abort the run.
 *
 * @param {string} root  the scanned tree's root (asset paths are relative to it)
 * @param {object[]} assets  from scanTree
 * @param {{now?: Date, concurrency?: number, pixels?: boolean, progress?: object}} [opts]
 *        `pixels: false` skips the pixel search entirely (the CLI's `--no-pixels`).
 * @returns {Promise<{dated: number, partial: number, unknown: number,
 *                    errors: Array<{path: string, error: string}>}>}
 */
export async function annotateAssets(root, assets, {
  now = new Date(), concurrency = DEFAULT_CONCURRENCY, pixels = true, progress = null,
} = {}) {
  const media = assets.filter(a => MEDIA_KINDS.has(a.kind));
  // Copy-spike detection is corpus-level: one pass over all media mtimes before any per-file work.
  const spikeDays = detectMtimeSpikeDays(media.map(a => a.mtimeMs));
  // Sidecar pairing needs the WHOLE asset list, not just media: an .xmp is a non-media file
  // (`other`) and would be invisible to a media-only pass.
  const sidecarsByMedia = pairSidecars(assets);

  // Pass 1 is split in two on purpose: every file's evidence is COLLECTED first, because one of the
  // resolver's rules is corpus-level. Deciding whether a "1 January 00:25" claim is a reset camera
  // clock needs to know when this collection's photography actually began, and that is not knowable
  // from the file being resolved (owner's decision 2026-07-28; `resolve.mjs` rule 5).
  const results = await mapLimit(media, concurrency, async (asset) => {
    const evidence = await collectEvidence(root, asset, sidecarsByMedia.get(asset.path));
    evidence.push(...mtimeEvidence(asset.mtimeMs, spikeDays));
    return evidence;
  });
  const resetFloorYear = corpusFloorYear(results.filter(r => r.ok).map(r => r.value), now);
  for (const [i, asset] of media.entries()) {
    if (results[i].ok) applyVerdict(asset, results[i].value, now, resetFloorYear);
  }

  const annotated = media.filter(a => a.verdict);

  // Pass 2 — the exact original by XMP DocumentID ↔ DerivedFrom (plans/02 §1.2).
  inheritFromOriginals(annotated, now, resetFloorYear);

  // Pass 3 — corpus inference for what is still undated: dir-cohort year consensus
  // (owner-approved 2026-07-24) and camera-family signs (plans/02 §1.3). The resolver's precedence
  // picks between them when both fire; family FACTS are attached as narration either way, so the
  // owner's report can say what is known even when no year could honestly be claimed.
  const cohorts = cohortYearByDir(annotated);
  const byDir = new Map();
  for (const a of annotated) {
    const dir = dirOf(a.path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(a);
  }
  for (const asset of annotated) {
    const dir = dirOf(asset.path);
    const extra = [];
    let fam = null;
    if (asset.verdict.status === 'unknown') {
      const cohort = cohorts.get(dir);
      if (cohort) extra.push(cohortEvidence(cohort, dir));
    }
    // Family signs are collected for the broken class only (an editor export with no capture
    // date — the marker is its editor-save evidence) while it stays undated.
    if (asset.verdict.status !== 'dated' && asset.evidence.some((e) => e.kind === 'editor-save')) {
      fam = familyFacts(asset, byDir.get(dir));
      if (asset.verdict.status === 'unknown') {
        const fe = fam ? familyEvidence(fam, dir) : null;
        if (fe) extra.push(fe);
      }
    }
    if (extra.length > 0) applyVerdict(asset, [...asset.evidence, ...extra], now, resetFloorYear);
    if (fam) asset.verdict.family = fam;
  }

  // Pass 4 — the last resort: find the actual original BY ITS PIXELS among the candidates pass 3
  // already narrowed down (plans/02 §Шаг 2). Runs only for editor exports still without a date.
  if (pixels) await inheritFromPixels(root, annotated, byDir, now, { progress, resetFloorYear });

  const counts = { dated: 0, partial: 0, unknown: 0, errors: [] };
  for (const [i, r] of results.entries()) {
    if (r.ok) counts[media[i].verdict.status] += 1;
    else counts.errors.push({ path: media[i].path, error: r.error?.message ?? String(r.error) });
  }
  return counts;
}
