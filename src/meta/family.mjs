// src/meta/family.mjs — camera-family signs for a photo with no capture date (plans/02 §1.3).
// [TESTED: 2026-07-27 · tests/meta_plan02.test.mjs (7 specs: narrowing, fork, ceiling, ambiguous
// geometry, weak neighbors) + fixture acceptance; guard verified by breaking it — familyEvidence
// forced to null → 2 specs red]
//
// The owner's own case (plans/02): an editor export lost its EXIF, but its geometry gives it away —
// 2280×2448 among 438 Samsung GT-I9100 shots of 3264×2448, and 2448 is the sensor's native side.
// This module gathers exactly the signs the plan's table lists, from what the directory already
// knows:
//
//   · the folder's camera census (Make/Model of dated neighbors)  → which family shot here at all
//   · geometry (one side = a native sensor side of that family)   → the likely source camera
//   · the date range of that camera's neighbors                   → a year fork
//   · the editor's save date                                      → an upper bound: taken no later
//
// Honesty contract, same as dir-cohort's and stricter (plans/02: family "никогда не датирует в
// одиночку — только сужает и объясняет"):
//   · family FACTS are narration — they always reach the owner, they never move a file by themselves;
//   · family EVIDENCE (an actual year claim) exists only when the same-camera neighbors' years
//     narrow to EXACTLY ONE year that does not contradict the save-date ceiling — and even then it
//     is a flagged low-confidence ASSUMPTION yielding a partial verdict (`<год>/прочее`, always
//     surfaced), one notch above the blind dir-cohort because it is camera-filtered.
//
// Determinism: pure functions over already-collected assets — no clock, no filesystem.

import { makeEvidence } from './evidence.mjs';
import { isConfidentVerdict } from './cohort.mjs';

/** Minimum confidently-dated same-camera neighbors before a family says anything (same bar as
 * COHORT_MIN_NEIGHBORS — one camera's shots are a cohort, only sharper). */
export const FAMILY_MIN_NEIGHBORS = 3;

/** The year (and month) an asset's editor-save evidence puts as a ceiling on the capture date. */
export function saveCeiling(asset) {
  const ev = (asset.evidence ?? []).find((e) => e.kind === 'editor-save');
  if (!ev?.wall) return null;
  return { year: ev.wall.year, month: ev.wall.month };
}

/**
 * The family signs for ONE undated asset, read from its directory neighbors.
 *
 * @param {object} asset       the asset needing signs (has .facts, .evidence, .verdict)
 * @param {object[]} dirAssets all media assets of the SAME directory (asset itself may be included)
 * @returns {{model: string|null, matchedBy: 'exif'|'geometry'|null,
 *            years: [number, number]|null, neighbors: number,
 *            noLaterThan: string|null} | null}
 *          null when there are no signs at all worth telling the owner
 */
export function familyFacts(asset, dirAssets) {
  const ceiling = saveCeiling(asset);

  // Census: per camera model — the confidently-dated neighbors, their years and their pixel sides.
  const census = new Map(); // model → {years: Set<number>, sides: Set<number>, count: number}
  for (const n of dirAssets ?? []) {
    if (n === asset) continue;
    const model = n.facts?.model;
    if (!model || !isConfidentVerdict(n.verdict)) continue;
    if (!census.has(model)) census.set(model, { years: new Set(), sides: new Set(), count: 0 });
    const c = census.get(model);
    c.years.add(n.verdict.year);
    if (n.facts.width) c.sides.add(n.facts.width);
    if (n.facts.height) c.sides.add(n.facts.height);
    c.count += 1;
  }

  // Which family does this file belong to? Its own Make/Model if the editor kept it; otherwise
  // geometry — an export/crop keeps at least one native sensor side (plans/02 §criminalistics).
  // An ambiguous geometry (two families share the side) names NO model: a guess between cameras
  // would be exactly the invented precision this plan exists to remove.
  let model = null;
  let matchedBy = null;
  if (asset.facts?.model && census.has(asset.facts.model)) {
    model = asset.facts.model;
    matchedBy = 'exif';
  } else if (asset.facts?.width || asset.facts?.height) {
    const matches = [...census.entries()].filter(([, c]) =>
      c.count >= FAMILY_MIN_NEIGHBORS
      && (c.sides.has(asset.facts.width) || c.sides.has(asset.facts.height)));
    if (matches.length === 1) {
      model = matches[0][0];
      matchedBy = 'geometry';
    }
  }

  const fam = census.get(model);
  const years = fam ? [Math.min(...fam.years), Math.max(...fam.years)] : null;
  const noLaterThan = ceiling
    ? `${String(ceiling.year).padStart(4, '0')}-${String(ceiling.month).padStart(2, '0')}`
    : null;

  if (!model && !noLaterThan) return null; // nothing to tell — no row invented
  return { model, matchedBy, years, neighbors: fam?.count ?? 0, noLaterThan };
}

/**
 * The family Evidence — ONLY when the fork closed to one year that the ceiling does not contradict.
 * @param {ReturnType<typeof familyFacts>} fam
 * @param {string} dir  provenance for the owner-facing report
 * @returns {object|null}
 */
export function familyEvidence(fam, dir) {
  if (!fam?.model || !fam.years) return null;
  const [min, max] = fam.years;
  if (min !== max) return null;                                    // a fork is not a year
  if (fam.noLaterThan && min > Number(fam.noLaterThan.slice(0, 4))) return null; // after the ceiling
  return makeEvidence('family', {
    wall: { year: min, month: 1, day: 1 },
    dateOnly: true,
    detail: `${fam.neighbors} ${fam.model} neighbors in '${dir}' all dated ${min}`
      + (fam.noLaterThan ? `; edited no later than ${fam.noLaterThan}` : ''),
  });
}
