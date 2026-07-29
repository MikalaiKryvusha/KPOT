// src/dedupe/dedupe.mjs — exact-duplicate grouping and keeper selection.
// [TESTED: 2026-07-26 · tests/plan_phase3.test.mjs — copy-name conventions, keeper totality across
// every permutation, fixture dup group (3 copies → 1 keeper); suite 73/73]
//
// GOAL.md: «Могут быть дубликаты одних и тех же идентичных кадров но под разными названиями в разных
// директориях» — the tool must find them. Identity is CONTENT, never name: the scan phase already
// streamed a SHA-256 per file, so grouping is exact and cheap. Perceptual (near-duplicate) matching
// is deliberately out of scope (researches/01 — deferred).
//
// One member of each group becomes the KEEPER (it moves into the year/season library); the rest are
// copies, set aside per the owner's decision of 2026-07-26 (`ПРОЧЕЕ/_дубликаты/` with provenance).
// KPOT deletes nothing, ever — a duplicate is relocated, never destroyed.
//
// Keeper selection is a TOTAL ORDER (AGENT_GUIDE → canonical order): the same scan must always
// choose the same keeper, on any machine, in any filesystem-enumeration order. Every criterion is
// explainable in one phrase, because the plan has to tell the owner WHY this copy was the one kept.

/** Verdict strength, lower = better keeper. A copy that knows its own date beats one that doesn't. */
const STATUS_RANK = { dated: 0, partial: 1, unknown: 2 };

/**
 * Name markers that betray a file as somebody's copy — Windows/Explorer, macOS and Russian
 * conventions all appear in the real archive (researches/02: `лучшая фотка (копия).jpg`,
 * `"+"-twins`). Matched against the basename WITHOUT its extension.
 */
const COPY_MARKER_RE = /(\(\s*копия\s*\d*\s*\)|-\s*копия(\s*\(\d+\))?$|\(\s*copy\s*\d*\s*\)|-\s*copy(\s*\(\d+\))?$|\(\d+\)$|\s+копия$|\s+copy$)/i;

/** Basename of a '/'-separated relative path. */
const basename = (p) => p.split('/').at(-1);

/** Basename without its final extension (so `foo (2).jpg` tests as `foo (2)`). */
function stem(path) {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Does this path's name look like a copy of something else? */
export function looksLikeACopy(path) {
  return COPY_MARKER_RE.test(stem(path).trim());
}

/** Depth = number of directory segments above the file (root-level file = 0). */
const depth = (p) => p.split('/').length - 1;

/**
 * The ordered keeper criteria. Each returns a comparable number (lower wins) and carries the
 * phrase the plan prints when THIS criterion is the one that decided the group.
 */
const CRITERIA = [
  { reason: 'у него самая надёжная дата', score: (a) => STATUS_RANK[a.verdict?.status] ?? STATUS_RANK.unknown },
  { reason: 'его дата установлена, а не предположена', score: (a) => (a.verdict?.assumed ? 1 : 0) },
  { reason: 'его имя не помечено как копия', score: (a) => (looksLikeACopy(a.path) ? 1 : 0) },
  { reason: 'он лежит ближе всех к верху дерева папок', score: (a) => depth(a.path) },
  { reason: 'первый по порядку пути — всё остальное у них одинаково', score: null }, // final total tie-break
];

/**
 * Choose the keeper of one duplicate group and explain the choice.
 * @param {object[]} members  assets sharing one sha256 (≥2)
 * @returns {{keeper: object, reason: string}}
 */
export function chooseKeeper(members) {
  // Path order first: it makes every later comparison a stable refinement and IS the final tie-break.
  const ranked = [...members].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  let pool = ranked;
  let reason = CRITERIA.at(-1).reason;

  const decisive = [];
  for (const criterion of CRITERIA) {
    if (!criterion.score || pool.length === 1) break;
    const best = Math.min(...pool.map(criterion.score));
    const narrowed = pool.filter((a) => criterion.score(a) === best);
    // A criterion that separates the field is the one worth telling the owner about.
    if (narrowed.length < pool.length) decisive.push(criterion.reason);
    pool = narrowed;
  }
  // Honesty: if criteria left a tie, path order is what ACTUALLY picked the keeper — say so
  // instead of crediting the last criterion that merely narrowed the field.
  if (pool.length > 1) decisive.push(CRITERIA.at(-1).reason);
  reason = decisive.length > 0 ? decisive.join('; далее — ') : CRITERIA.at(-1).reason;
  return { keeper: pool[0], reason };
}

/**
 * Group assets by content hash into duplicate groups.
 *
 * Only MEDIA assets are grouped: junk is quarantined wholesale and `other` files stay where they
 * are (interview #001 Q4/Q5), so duplicate resolution among them would plan moves the owner never
 * asked for.
 *
 * @param {object[]} assets  annotated assets from scan + annotate
 * @returns {{groups: Array<{sha256: string, size: number, count: number, keeper: string,
 *            keeperReason: string, copies: string[]}>, copyPaths: Set<string>}}
 *          groups sorted by keeper path; `copyPaths` is the fast lookup the plan phase needs.
 */
export function groupDuplicates(assets) {
  const MEDIA = new Set(['photo', 'video', 'audio']);
  const byHash = new Map();
  for (const a of assets) {
    if (!MEDIA.has(a.kind)) continue;
    if (!a.sha256) continue; // unhashable file — the scan already recorded the error
    if (!byHash.has(a.sha256)) byHash.set(a.sha256, []);
    byHash.get(a.sha256).push(a);
  }

  const groups = [];
  const copyPaths = new Set();
  for (const [sha256, members] of byHash) {
    if (members.length < 2) continue;
    const { keeper, reason } = chooseKeeper(members);
    const copies = members
      .filter((a) => a.path !== keeper.path)
      .map((a) => a.path)
      .sort();
    for (const p of copies) copyPaths.add(p);
    groups.push({ sha256, size: keeper.size, count: members.length, keeper: keeper.path, keeperReason: reason, copies });
  }
  groups.sort((a, b) => (a.keeper < b.keeper ? -1 : a.keeper > b.keeper ? 1 : 0));
  return { groups, copyPaths };
}
