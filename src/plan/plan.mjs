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

import { samePath, normalizeForCompare, INBOX_DIR } from '../core/paths.mjs';
import { groupDuplicates } from '../dedupe/dedupe.mjs';
import { planBucket, isTechnicalDir, stripReviewPrefix, REVIEW_DIR, EVIDENCE_IN_WORDS } from './bucket.mjs';
import { findSuspiciousDirs, heldBy } from './suspicious.mjs';

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
 * Evidence kinds whose date belongs to ANOTHER file — the original photograph this one was made
 * from (plans/02 §1.2 by the editor's identity chain, §Шаг 2 by comparing pixels). The value is how
 * the original was found, said in the owner's words: he asked for plain language without jargon
 * (2026-07-28), and «pixel-original» is jargon.
 */
const INHERITED_FROM_ORIGINAL = {
  'derived-original': 'по метке редактора',
  'pixel-original': 'по самому изображению',
};

/**
 * The owner-facing family line for an editor export with no capture date (plans/02 §1.3), built
 * from whatever signs exist: «семейство GT-I9100 (по геометрии кадра), соседи той же камеры:
 * 2011–2013, снято не позже 2014-02». Deterministic — pure string assembly.
 */
function familyPhrase(family) {
  const parts = [];
  if (family.model) {
    const how = family.matchedBy === 'geometry' ? ' (по геометрии кадра)' : '';
    parts.push(`семейство ${family.model}${how}`);
    if (family.years) {
      const [min, max] = family.years;
      parts.push(`соседи той же камеры: ${min === max ? min : `${min}–${max}`}`);
    }
  } else {
    parts.push('камера-источник не определена');
  }
  if (family.noLaterThan) parts.push(`снято не позже ${family.noLaterThan}`);
  return parts.join(', ');
}

/**
 * Build the SortPlan for an annotated scan result.
 *
 * @param {{root: string, assets: object[], errors?: object[]}} scan  scan + annotate output
 * @param {{now?: Date}} [opts]  injectable clock — the ONLY nondeterminism, kept inside `meta`
 * @returns {object} the SortPlan artifact
 */
export function buildPlan(scan, { now = new Date(), decisions = new Map() } = {}) {
  const { groups, copyPaths } = groupDuplicates(scan.assets);

  // Folders whose NAME does not say whether they are the owner's or a program's (2026-07-26).
  // Suspicion is judged on the ORIGINAL path — the one the file had before any quarantining — so
  // that a folder already sitting in `НА_РАЗБОР/` is still recognized as the same folder, keeps the
  // same key in the decisions file, and a second run is a no-op rather than a re-quarantining.
  const originalOf = new Map(scan.assets.map((a) => [a.path, stripReviewPrefix(a.path)]));
  const candidates = findSuspiciousDirs(
    scan.assets.map((a) => ({ ...a, path: originalOf.get(a.path) })), isTechnicalDir,
  );

  // Would sorting actually BREAK each candidate folder up? Owner's rule, 2026-07-26: ask only when
  // it would. Custom folders are preserved as nesting, so a folder whose files all land in one
  // <год>/<сезон> arrives intact — its name and grouping survive, and there is nothing to decide.
  // Measured on the owner's real archive when this rule was added: 15 of 25 flagged folders would
  // have arrived intact, i.e. 15 questions that protected nothing.
  const bucketsOf = new Map();     // candidate dir → set of <год>/<сезон> its files would land in
  for (const asset of scan.assets) {
    const orig = originalOf.get(asset.path);
    const dir = candidates.find((c) => orig.startsWith(`${c.dir}/`))?.dir;
    if (!dir) continue;
    const d = planBucket({ ...asset, path: orig }, { isDuplicateCopy: copyPaths.has(asset.path) });
    const bucket = d.action === 'stay' ? 'stay' : d.segments.slice(0, 2).join('/');
    if (!bucketsOf.has(dir)) bucketsOf.set(dir, new Set());
    bucketsOf.get(dir).add(bucket);
  }

  const suspicious = candidates
    .filter((c) => (bucketsOf.get(c.dir)?.size ?? 0) > 1)
    .map((s) => ({ ...s, decision: decisions.get(s.dir) ?? null }));
  const held = new Map(suspicious.filter((s) => s.decision !== 'sort').map((s) => [s.dir, s.decision]));

  const operations = [];
  const stay = [];
  const disputed = [];
  const inherited = [];

  for (const asset of scan.assets) {
    const origPath = originalOf.get(asset.path);

    // Undecided, and "как есть", both resolve to the same place: the quarantine, holding the
    // folder's original parent structure (owner, 2026-07-26). One destination for both answers is
    // what makes the flow idempotent — a folder already there plans a move onto itself, which the
    // `from !== to` filter below drops.
    const holder = heldBy(origPath, held);
    if (holder) {
      const target = `${REVIEW_DIR}/${origPath}`;
      operations.push({
        op: 'move',
        from: asset.path,
        to: target,
        kind: asset.kind,
        reason: held.get(holder) === 'as-is'
          ? `папка «${holder}» оставлена как есть по вашему решению — лежит в ${REVIEW_DIR}/`
          : `папка «${holder}» ждёт вашего решения — отложена в ${REVIEW_DIR}/ как есть`,
        review: holder,
      });
      continue;
    }

    const isDuplicateCopy = copyPaths.has(asset.path);
    // An approved folder is sorted as if it had never been quarantined: the ORIGINAL path decides
    // its custom-dir nesting, so `НА_РАЗБОР` never appears inside the library.
    const decision = planBucket({ ...asset, path: origPath }, { isDuplicateCopy });

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
        // The issue label already says the date was refused, so the detail only has to name
        // WHICH date. The evidence's own `detail` is an internal tag ('DateTimeOriginal', 'mvhd',
        // 'epoch-stem') and is deliberately NOT printed — it belongs to the machine artifact.
        detail: d.kind === 'editor-save' && d.detail
          ? `программа: ${d.detail}`
          : (EVIDENCE_IN_WORDS[d.kind] ?? d.kind),
      });
    }
    // plans/02 §1.3 — an editor export left without a capture date carries its FAMILY SIGNS into
    // the owner's report: which camera family, what year fork the neighbours give, and the save
    // date as a ceiling. The acceptance criterion demands a line per such file, in the owner's
    // language — this is that line.
    if (asset.verdict?.family) {
      disputed.push({
        path: asset.path,
        issue: 'editor-export-no-capture-date',
        detail: familyPhrase(asset.verdict.family),
      });
    }
    // plans/02 §1.2 and §Шаг 2 — a date this file does not own: it was inherited from the ORIGINAL
    // photograph, found either by the editor's own identity chain or by comparing pixels. That is a
    // claim the owner must be able to check with his own eyes, so it gets its own report section
    // naming the source file — not a line of evidence jargon inside a move.
    if (asset.verdict?.winner in INHERITED_FROM_ORIGINAL) {
      const ev = (asset.evidence ?? []).find((e) => e.kind === asset.verdict.winner);
      inherited.push({
        path: asset.path,
        date: asset.verdict.date,
        how: INHERITED_FROM_ORIGINAL[asset.verdict.winner],
        detail: ev?.detail ?? '',
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
  //
  // Compared with `samePath`, NOT `!==` (bug 03, found by the dry run on the owner's real archive).
  // His season folders are capitalised — `2025/Зима Конец Года/` — where KPOT's canonical name is
  // `Зима конец года`. On Windows those are the SAME directory, so the file is already home; string
  // inequality saw a move, and `apply` then refused it with "target already exists" — 15 times.
  // AGENT_GUIDE §Code style mandates exactly this helper for exactly this reason.
  //
  // Consequence, deliberate: the owner's own capitalisation stays (invariant 6, "the user's names
  // survive"). KPOT does not rename his folder to match its own spelling.
  // Kept, not merely counted (bug 05): a file that is ALREADY home is invisible to both populations
  // `emptiedDirs` reasons about — it is not an actionable move and it is not in `stay` — so without
  // this list its folder is reported as one that will be left empty. On a first sort the population
  // is empty and the defect cannot appear; from the second run onward it is most of the library.
  const actionable = [];
  const inPlace = [];
  for (const o of operations) (samePath(o.from, o.to) ? inPlace : actionable).push(o);
  const alreadyInPlace = inPlace.length;

  // Canonical order: by destination, then by source. The owner reads the plan grouped by where
  // things land; `apply` gets a stable, reproducible sequence.
  actionable.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

  const collisions = resolveCollisions(actionable);

  stay.sort((a, b) => (a.path < b.path ? -1 : 1));
  disputed.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.issue < b.issue ? -1 : 1));

  // Folders the sort would leave empty. Recorded here so the owner sees the deletions in advance —
  // the condition attached to the owner's permission to delete them at all.
  const emptied = emptiedDirs(scan.dirs ?? [], actionable, stay, inPlace);

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
      emptiedDirs: emptied.length,
      suspiciousDirs: suspicious.length,
      awaitingDecision: suspicious.filter((s) => s.decision === null).length,
    },
    operations: actionable,
    stay,
    duplicates: groups,
    disputed,
    inherited,
    collisions,
    emptied,
    suspicious,
    errors: scan.errors ?? [],
  };
}

/**
 * Which of the tree's directories will be left empty by these moves?
 * [TESTED: 2026-07-29 · tests/empty_dirs.test.mjs — bug 05: a sorted library yields an EMPTY list,
 * and a top-up names only the folders the top-up itself drained; both break-verified]
 *
 * The owner allowed KPOT to delete them (2026-07-26) on one condition — that they are recorded so a
 * rollback can put them back. This function is the "shown to you first" half of that: the list goes
 * into the plan, so the owner reads exactly which folders would disappear BEFORE anything runs.
 *
 * Bottom-up, because emptiness is recursive: `копии/` only disappears if `копии/старое/` does too.
 * A directory that RECEIVES a file is never empty, which is what keeps a folder that is both a
 * source and a target (the owner's own `2013/`) safely off the list.
 *
 * THREE populations keep a directory alive, and missing any one of them turns this list into a
 * threat to delete folders that are full (bug 05):
 *   · a file that stays where it is (non-media);
 *   · a file that MOVES INTO the directory;
 *   · a file that is ALREADY in it and needs no operation at all — the population that does not
 *     exist on a first sort and is most of the library on every run after it.
 *
 * Membership is decided with the normalized comparison key, never raw string equality: the owner
 * capitalises his own season folders (`Зима Конец Года`), and on Windows that is the SAME directory
 * KPOT spells `Зима конец года`. Comparing the two as strings is exactly bug 03, one level up —
 * a survivor recorded under one spelling would not match the folder listed under the other.
 *
 * HONEST LIMIT, stated rather than implied: that last part is defence in depth and **no spec
 * currently falsifies it**. Every case it would catch is already covered by another survivor entry
 * (a file already home is kept under its ON-DISK spelling, and a folder receiving a file is re-read
 * by `apply` before removal anyway), so reverting to `===` leaves the suite green. It is here
 * because `AGENT_GUIDE` §Code style mandates the helper for exactly this comparison, not because a
 * guard proved it necessary — and a guard that has never gone red proves nothing (EXP-0008).
 *
 * @param {string[]} dirs         every directory in the tree, relative, '/'-separated
 * @param {object[]} operations   the actionable moves
 * @param {object[]} stay         files that are not moving at all
 * @param {object[]} inPlace      moves dropped as no-ops: the file is already at its destination
 * @returns {string[]} deepest-first — the order they must be removed in
 */
function emptiedDirs(dirs, operations, stay, inPlace = []) {
  const survivors = new Set();   // comparison keys of directories that still hold something
  const keep = (relPath) => {
    const parts = relPath.split('/');
    for (let i = parts.length - 1; i >= 1; i--) {
      survivors.add(normalizeForCompare(parts.slice(0, i).join('/')));
    }
  };
  for (const s of stay) keep(s.path);          // a file that stays keeps its folder alive
  for (const op of operations) keep(op.to);    // a destination folder is occupied by definition
  // Its ORIGINAL path, not its target: `from` is how the folder is actually spelled on disk, and
  // that is what the directory listing being filtered below contains.
  for (const op of inPlace) keep(op.from);     // already home — nothing is leaving this folder

  // Anything not kept alive is emptied. Deepest first, so a child is removed before its parent.
  return dirs
    .filter((d) => !survivors.has(normalizeForCompare(d)))
    // …except the INBOX itself. Emptying it is what SUCCESS looks like, not what makes it disposable
    // (phase 6.4, and measured before the rule existed: the plan listed «НОВОЕ» among the folders to
    // delete, so the owner's mailbox would have vanished after the very first top-up and he would
    // have had to know to recreate it by hand). Its own subfolders are ordinary emptied folders and
    // are removed exactly as before — the owner's decision of 2026-07-28 asked for precisely that:
    // «разобранные папки инбокса удалять — если они пусты и разобраны».
    .filter((d) => !samePath(d, INBOX_DIR))
    .sort((a, b) => b.split('/').length - a.split('/').length || (a < b ? 1 : -1));
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
/**
 * A disputed case's machine key → what it MEANS, in plain Russian. [NOT-TESTED]
 *
 * The keys stay exactly as they are in the artifact — tests and the coming web interface branch on
 * them, and a machine key is the right thing for a machine. This map exists because the owner reads
 * the RENDERED report, and until 2026-07-29 the section literally headed «требуют вашего взгляда»
 * addressed him in code (`implausible-year: evidence «exif-original» … was rejected`). His
 * requirement of 2026-07-28 was categorical: no jargon, no slang.
 */
const ISSUE_IN_WORDS = Object.freeze({
  'implausible-year': 'год выглядит невозможным — скорее всего, в камере сбились часы',
  'reset-camera-clock': 'часы камеры были сброшены, дата ненастоящая',
  'editor-save-date': 'это дата обработки в редакторе, а не дата съёмки',
  'conflicts-with-winner': 'разные источники называют разные даты',
  'assumed-year': 'год не записан нигде — он выведен по соседям',
  'ambiguous-season': 'по названию папки нельзя понять, какая это пора года',
  'timezone-boundary': 'дата у самой границы двух пор года, а часовой пояс неизвестен',
  'editor-export-no-capture-date': 'обработанный снимок без даты съёмки — вот что о нём известно',
});

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
  L.push(`Опустевших папок:  ${c.emptiedDirs ?? 0}  (будут удалены, откат воссоздаст)`);
  if (c.awaitingDecision > 0) L.push(`Ждут вашего решения: ${c.awaitingDecision} папок — см. ниже`);
  L.push('');
  L.push('ЭТО ТОЛЬКО ПЛАН. Ни один файл ещё не тронут.');
  L.push('');

  // The approval list goes FIRST after the summary: it is the only section that asks the owner to
  // do something, and a request buried under a hundred lines of moves is a request nobody answers.
  const waiting = (plan.suspicious ?? []).filter((s) => s.decision === null);
  if (waiting.length > 0) {
    L.push('⚠ ПАПКИ, ПО КОТОРЫМ НУЖНО ВАШЕ РЕШЕНИЕ');
    L.push('-'.repeat(60));
    L.push('  У этих папок непонятные названия — неясно, ваши они или их создала программа.');
    L.push(`  Они НЕ РАЗБИРАЮТСЯ, а целиком откладываются в ${REVIEW_DIR}/ — как есть, со своей`);
    L.push('  исходной структурой папок. Ничего внутри них не переименовано и не рассортировано.');
    L.push('');
    for (const s of waiting) {
      L.push(`  ${s.dir}/   — ${s.reason}`);
      L.push(`      медиафайлов внутри: ${s.files}   →   ${REVIEW_DIR}/${s.dir}/`);
    }
    L.push('');
    L.push('  Откройте файл решений, впишите «сортировать» или «как есть», и запустите KPOT снова:');
    L.push(`      ${plan.meta.decisionsPath ?? '<корень>/.kpot-runs/папки-на-согласование.txt'}`);
    L.push('');
  }

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

  if (plan.inherited?.length > 0) {
    L.push('ДАТЫ, ВЗЯТЫЕ У ИСХОДНОГО СНИМКА');
    L.push('-'.repeat(60));
    L.push('  У этих файлов своей даты съёмки нет: её стёр фоторедактор, когда файл сохраняли.');
    L.push('  KPOT нашёл среди ваших же фотографий тот самый исходный снимок и взял дату у него.');
    L.push('  Ниже указано, какой это файл — чтобы вы могли проверить своими глазами.');
    L.push('');
    for (const i of plan.inherited) {
      L.push(`  ${i.path}`);
      L.push(`    дата ${i.date}, найдено ${i.how}`);
      if (i.detail) L.push(`    ${i.detail}`);
    }
    L.push('');
  }

  if (plan.disputed.length > 0) {
    L.push('СПОРНЫЕ СЛУЧАИ (требуют вашего взгляда)');
    L.push('-'.repeat(60));
    for (const d of plan.disputed) {
      L.push(`  ${d.path}`);
      L.push(`    ${ISSUE_IN_WORDS[d.issue] ?? d.issue}: ${d.detail}`);
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

  if (plan.emptied?.length > 0) {
    L.push('ПАПКИ, КОТОРЫЕ ОПУСТЕЮТ И БУДУТ УДАЛЕНЫ');
    L.push('-'.repeat(60));
    L.push('  Все файлы из них переедут, пустые папки убираются. Их пути записаны в бэкап —');
    L.push('  откат воссоздаст каждую папку.');
    L.push('');
    for (const d of [...plan.emptied].sort()) L.push(`  ${d}/`);
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
