// src/plan/plan.mjs — the SortPlan: the pre-sort master plan the owner reads BEFORE anything moves.
// [TESTED: 2026-07-26 · tests/plan_phase3.test.mjs — Phase 3 acceptance on the fixture ground truth,
// determinism, collisions, read-only proof; guards verified by breaking the code first]
//
// GOAL.md §«Перед тем как инструмент выполнит реальную сортировку… а) подробную карту с пояснениями,
// что куда будет перемещено». This module builds that map as an ARTIFACT, not as a printout: an
// ordered, serializable list of operations plus the disputed cases and the collisions. Phase 4/5
// (dry run, apply, rollback) consume this exact object, so the dry run and the real run execute the
// same plan through the same code path — the equivalence GOAL.md §в) demands.
//
// STRICTLY READ-ONLY (AGENT_GUIDE RULE 1): planning touches no user file. RULE 2 holds too — this
// module imports from dedupe/, meta/ and core/ but never from apply/.
//
// DETERMINISM (AGENT_GUIDE → canonical order): `operations`, `duplicates`, `disputed`, `collisions`
// and `stay` are all fully sorted, and nothing in them is derived from a clock or the filesystem's
// enumeration order. Two plans of the same tree are byte-identical apart from `meta.plannedAt`,
// which is deliberately isolated in `meta` so Phase 4 can compare the actionable parts directly.

import { groupDuplicates } from '../dedupe/dedupe.mjs';
import { planBucket } from './bucket.mjs';

export const PLAN_VERSION = 1;

/** Join target segments + name into the '/'-separated relative target path. */
const targetPath = (segments, name) => [...segments, name].join('/');

/**
 * Add a numeric suffix before the extension: `DSC02000.JPG` → `DSC02000 (2).JPG`.
 * Collisions must never destroy a name the owner chose (GOAL.md), so we extend rather than replace.
 */
function suffixed(name, n) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

/**
 * Build the SortPlan for an annotated scan result.
 *
 * @param {{root: string, assets: object[], errors?: object[]}} scan  scan + annotate output
 * @param {{now?: Date}} [opts]  injectable clock — the ONLY nondeterminism, kept inside `meta`
 * @returns {object} the SortPlan artifact
 */
export function buildPlan(scan, { now = new Date() } = {}) {
  const { groups, copyPaths } = groupDuplicates(scan.assets);

  const operations = [];
  const stay = [];
  const disputed = [];

  for (const asset of scan.assets) {
    const isDuplicateCopy = copyPaths.has(asset.path);
    const decision = planBucket(asset, { isDuplicateCopy });

    for (const d of decision.disputed) {
      disputed.push({ path: asset.path, issue: d.issue, detail: d.detail });
    }
    // Conflicts the RESOLVER already found (a broken camera clock, two sources naming different
    // years) are disputed cases too — GOAL.md §«Спорные моменты нужно документировать при анализе и
    // показывать в пред-сортировочном мастер-плане». Without this they would live only inside the
    // scan JSON, and the owner reads the plan.
    for (const d of asset.verdict?.disputed ?? []) {
      disputed.push({
        path: asset.path,
        issue: d.reason,
        detail: `evidence «${d.kind}»${d.detail ? ` (${d.detail})` : ''} was rejected`,
      });
    }

    if (decision.action === 'stay') {
      stay.push({ path: asset.path, kind: asset.kind, reason: decision.reason });
      continue;
    }
    operations.push({
      op: 'move',
      from: asset.path,
      to: targetPath(decision.segments, decision.name),
      kind: asset.kind,
      reason: decision.reason,
      ...(isDuplicateCopy ? { duplicateOf: dupKeeperOf(groups, asset.path) } : {}),
    });
  }

  // A file already sitting exactly where the plan wants it is not an operation — it is a no-op that
  // would otherwise make a re-run look like work and, worse, make `apply` rename a file onto itself.
  const actionable = operations.filter((o) => o.from !== o.to);
  const alreadyInPlace = operations.length - actionable.length;

  // Canonical order: by destination, then by source. The owner reads the plan grouped by where
  // things land; `apply` gets a stable, reproducible sequence.
  actionable.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

  const collisions = resolveCollisions(actionable);

  stay.sort((a, b) => (a.path < b.path ? -1 : 1));
  disputed.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.issue < b.issue ? -1 : 1));

  return {
    planVersion: PLAN_VERSION,
    meta: { root: scan.root, plannedAt: now.toISOString(), scannedAt: scan.scannedAt ?? null },
    counts: {
      files: scan.assets.length,
      moves: actionable.length,
      alreadyInPlace,
      stay: stay.length,
      duplicateGroups: groups.length,
      duplicateCopies: copyPaths.size,
      disputed: disputed.length,
      collisions: collisions.length,
    },
    operations: actionable,
    stay,
    duplicates: groups,
    disputed,
    collisions,
    errors: scan.errors ?? [],
  };
}

/** Which keeper does this copy belong to? (small N per group — a linear scan is honest here) */
function dupKeeperOf(groups, path) {
  for (const g of groups) if (g.copies.includes(path)) return g.keeper;
  return null;
}

/**
 * Two DIFFERENT files planned onto one target path would silently destroy one of them. Rename the
 * later ones deterministically (source-path order) and record every rename, so the plan shows the
 * owner exactly which names had to change and why.
 *
 * Mutates `operations` in place (they are this function's own freshly-built objects).
 * @returns {Array<{target: string, resolved: Array<{from: string, to: string}>}>}
 */
function resolveCollisions(operations) {
  const taken = new Map();      // target path → the operation that claimed it
  const collisions = new Map(); // original target → [{from, to}]

  for (const op of operations) {
    if (!taken.has(op.to)) { taken.set(op.to, op); continue; }
    const original = op.to;
    const dir = original.slice(0, original.lastIndexOf('/') + 1);
    const name = original.slice(original.lastIndexOf('/') + 1);
    let n = 2, candidate;
    do { candidate = dir + suffixed(name, n); n += 1; } while (taken.has(candidate));
    op.to = candidate;
    op.collisionRenamed = true;
    taken.set(candidate, op);
    if (!collisions.has(original)) {
      collisions.set(original, [{ from: taken.get(original).from, to: original }]);
    }
    collisions.get(original).push({ from: op.from, to: candidate });
  }

  return [...collisions.entries()]
    .map(([target, resolved]) => ({ target, resolved }))
    .sort((a, b) => (a.target < b.target ? -1 : 1));
}

/**
 * Render the SortPlan as the human-readable pre-sort master plan (Russian — the owner's language,
 * AGENT_GUIDE §Languages). The machine-readable artifact stays the source of truth; this is the
 * face of it that GOAL.md asks for: «подробная карта с пояснениями, что куда будет перемещено».
 *
 * @param {object} plan  from buildPlan
 * @returns {string}
 */
export function renderPlan(plan) {
  const L = [];
  const c = plan.counts;
  L.push('ПРЕД-СОРТИРОВОЧНЫЙ МАСТЕР-ПЛАН');
  L.push('='.repeat(60));
  L.push(`Корень:            ${plan.meta.root}`);
  L.push(`Файлов найдено:    ${c.files}`);
  L.push(`Будет перемещено:  ${c.moves}`);
  L.push(`Уже на месте:      ${c.alreadyInPlace}`);
  L.push(`Остаётся на месте: ${c.stay}  (не медиа — не трогаем)`);
  L.push(`Дубликаты:         ${c.duplicateGroups} групп, ${c.duplicateCopies} копий в сторону`);
  L.push(`Спорных случаев:   ${c.disputed}`);
  L.push(`Конфликтов имён:   ${c.collisions}`);
  L.push('');
  L.push('ЭТО ТОЛЬКО ПЛАН. Ни один файл ещё не тронут.');
  L.push('');

  // Moves, grouped by destination directory — the owner reads the future library, not a flat list.
  L.push('ЧТО КУДА ПЕРЕЕДЕТ');
  L.push('-'.repeat(60));
  let currentDir = null;
  for (const op of plan.operations) {
    const dir = op.to.slice(0, op.to.lastIndexOf('/')) || '.';
    if (dir !== currentDir) { L.push(`\n  ${dir}/`); currentDir = dir; }
    L.push(`    ${op.to.slice(op.to.lastIndexOf('/') + 1)}`);
    L.push(`        ← ${op.from}`);
    L.push(`        ${op.reason}`);
  }
  if (plan.operations.length === 0) L.push('  (нечего перемещать)');
  L.push('');

  if (plan.duplicates.length > 0) {
    L.push('ДУБЛИКАТЫ (побайтово идентичные копии — ничего не удалено)');
    L.push('-'.repeat(60));
    for (const g of plan.duplicates) {
      L.push(`  ${g.count} копии, ${g.size} байт, sha256 ${g.sha256.slice(0, 12)}…`);
      L.push(`    хранитель: ${g.keeper}`);
      L.push(`               (выбран: ${g.keeperReason})`);
      for (const copy of g.copies) L.push(`    копия:     ${copy}  → ПРОЧЕЕ/_дубликаты/`);
    }
    L.push('');
  }

  if (plan.disputed.length > 0) {
    L.push('СПОРНЫЕ СЛУЧАИ (требуют вашего взгляда)');
    L.push('-'.repeat(60));
    for (const d of plan.disputed) {
      L.push(`  ${d.path}`);
      L.push(`    ${d.issue}: ${d.detail}`);
    }
    L.push('');
  }

  if (plan.collisions.length > 0) {
    L.push('КОНФЛИКТЫ ИМЁН (разные файлы претендовали на одно имя — переименованы, не потеряны)');
    L.push('-'.repeat(60));
    for (const col of plan.collisions) {
      L.push(`  ${col.target}`);
      for (const r of col.resolved) L.push(`    ${r.from}  →  ${r.to}`);
    }
    L.push('');
  }

  if (plan.stay.length > 0) {
    L.push('ОСТАЁТСЯ НА МЕСТЕ (не медиафайлы)');
    L.push('-'.repeat(60));
    for (const s of plan.stay) L.push(`  ${s.path}`);
    L.push('');
  }

  if (plan.errors.length > 0) {
    L.push('НЕ УДАЛОСЬ ПРОЧИТАТЬ');
    L.push('-'.repeat(60));
    for (const e of plan.errors) L.push(`  ${e.path}: ${e.error}`);
    L.push('');
  }

  return L.join('\n');
}
