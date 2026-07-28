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
import { exifExtract } from './exif.mjs';
import { mp4Evidence } from './mp4.mjs';
import { allNameEvidence } from './filename_date.mjs';
import { dirnameEvidence } from './dirname_date.mjs';
import { detectMtimeSpikeDays, mtimeEvidence, resolveDate } from './resolve.mjs';
import { cohortYearByDir, cohortEvidence } from './cohort.mjs';
import { familyFacts, familyEvidence } from './family.mjs';
import { pairSidecars, sidecarEvidence } from './sidecar.mjs';
import { formatWall, makeEvidence } from './evidence.mjs';

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
function applyVerdict(asset, evidence, now) {
  const { evidence: ranked, ...verdict } = resolveDate(evidence, { now });
  asset.evidence = ranked;
  asset.verdict = verdict;
}

/** '/'-separated parent directory of a relative asset path. */
const dirOf = (relPath) => relPath.split('/').slice(0, -1).join('/');

/**
 * Pass 2 (plans/02 §1.2): exact original lookup by the XMP identity chain. Deterministic: when
 * several files share a DocumentID (copies), the lexicographically first path with a real capture
 * date is the reference — path order, never enumeration order (AGENT_GUIDE §canonical order).
 */
function inheritFromOriginals(annotated, now) {
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
      detail: `original: '${ref.path}' (${formatWall(orig.wall)}, XMP DocumentID match)`,
    });
    applyVerdict(asset, [...asset.evidence, inherited], now);
  }
}

/**
 * Annotate media assets IN PLACE with `evidence` and `verdict`; returns verdict counts for
 * reporting. Per-file metadata failures land in `errors`, never abort the run.
 *
 * @param {string} root  the scanned tree's root (asset paths are relative to it)
 * @param {object[]} assets  from scanTree
 * @param {{now?: Date, concurrency?: number}} [opts]
 * @returns {Promise<{dated: number, partial: number, unknown: number,
 *                    errors: Array<{path: string, error: string}>}>}
 */
export async function annotateAssets(root, assets, { now = new Date(), concurrency = DEFAULT_CONCURRENCY } = {}) {
  const media = assets.filter(a => MEDIA_KINDS.has(a.kind));
  // Copy-spike detection is corpus-level: one pass over all media mtimes before any per-file work.
  const spikeDays = detectMtimeSpikeDays(media.map(a => a.mtimeMs));
  // Sidecar pairing needs the WHOLE asset list, not just media: an .xmp is a non-media file
  // (`other`) and would be invisible to a media-only pass.
  const sidecarsByMedia = pairSidecars(assets);

  const results = await mapLimit(media, concurrency, async (asset) => {
    const evidence = await collectEvidence(root, asset, sidecarsByMedia.get(asset.path));
    evidence.push(...mtimeEvidence(asset.mtimeMs, spikeDays));
    applyVerdict(asset, evidence, now);
  });

  const annotated = media.filter(a => a.verdict);

  // Pass 2 — the exact original by XMP DocumentID ↔ DerivedFrom (plans/02 §1.2).
  inheritFromOriginals(annotated, now);

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
    if (extra.length > 0) applyVerdict(asset, [...asset.evidence, ...extra], now);
    if (fam) asset.verdict.family = fam;
  }

  const counts = { dated: 0, partial: 0, unknown: 0, errors: [] };
  for (const [i, r] of results.entries()) {
    if (r.ok) counts[media[i].verdict.status] += 1;
    else counts.errors.push({ path: media[i].path, error: r.error?.message ?? String(r.error) });
  }
  return counts;
}
