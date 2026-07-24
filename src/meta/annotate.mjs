// src/meta/annotate.mjs — runs the whole evidence pipeline over a scan result: for every MEDIA
// asset, collect all date evidence and resolve it into a DateVerdict.
// [TESTED: 2026-07-24 · acceptance spec + real CLI smoke (15 dated · 1 partial · 2 unknown = ground
// truth exactly); 55/55]
//
// This is the composition point of src/meta/: scan produces bare Assets (identity + kind + hash),
// annotate attaches the "when" — evidence list + verdict — in place. Read-only over user files
// (RULE 1): it opens files to READ metadata segments, writes nothing. bin/kpot.mjs calls
// scanTree → annotateAssets to build the full scan map (RULE 2: bin composes siblings; scan and
// meta never import each other).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mapLimit } from '../core/pool.mjs';
import { exifEvidence } from './exif.mjs';
import { mp4Evidence } from './mp4.mjs';
import { allNameEvidence } from './filename_date.mjs';
import { dirnameEvidence } from './dirname_date.mjs';
import { detectMtimeSpikeDays, mtimeEvidence, resolveDate } from './resolve.mjs';

/** Kinds that get evidence + a verdict; junk/other are not dated (they are not sorted by date). */
const MEDIA_KINDS = new Set(['photo', 'video', 'audio']);

/** Default bounded concurrency for metadata reads. */
export const DEFAULT_CONCURRENCY = 8;

/** Collect every date-evidence claim for one asset. */
async function collectEvidence(root, asset) {
  const abs = join(root, ...asset.path.split('/'));
  const basename = asset.path.split('/').at(-1);
  const out = [];
  // container/metadata evidence first — photos carry EXIF, videos carry mvhd
  if (asset.kind === 'photo') out.push(...exifEvidence(await readFile(abs)));
  if (asset.kind === 'video') out.push(...(await mp4Evidence(abs)));
  out.push(...allNameEvidence(basename));
  out.push(...dirnameEvidence(asset.path));
  return out; // fs-mtime is appended by the caller, which knows the corpus-level spike days
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

  const results = await mapLimit(media, concurrency, async (asset) => {
    const evidence = await collectEvidence(root, asset);
    evidence.push(...mtimeEvidence(asset.mtimeMs, spikeDays));
    const { evidence: ranked, ...verdict } = resolveDate(evidence, { now });
    asset.evidence = ranked;  // rank-sorted by the resolver
    asset.verdict = verdict;  // evidence not duplicated inside the verdict
    return verdict.status;
  });

  const counts = { dated: 0, partial: 0, unknown: 0, errors: [] };
  for (const [i, r] of results.entries()) {
    if (r.ok) counts[r.value] += 1;
    else counts.errors.push({ path: media[i].path, error: r.error?.message ?? String(r.error) });
  }
  return counts;
}
