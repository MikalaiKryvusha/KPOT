// src/plan/suspicious.mjs — directories KPOT will not sort until the owner has decided.
// [NOT-TESTED]
//
// Owner's instruction, 2026-07-26: «нужно подозрительные папки помечать, и выносить в инструменте
// на согласование владельца — сортировать их, или вносить в том виде, в каком они есть.»
//
// The CRITERION is the owner's too, chosen from four offered: **an unclear NAME** — a directory
// whose name is neither plainly technical (a device or app created it) nor plainly meaningful (the
// owner named it). The wider criteria (folders spanning several years, folders of mostly-undatable
// files, every human-named folder) were rejected: on an archive with ~60 top-level directories they
// would turn the approval list into noise, and noise is how an approval step becomes a rubber stamp.
//
// The same choice settles an open question — the Russian names of device/app folders (`скриншоты`,
// `камера`). They are neither silently dropped as technical nor silently preserved as the owner's:
// they land on the owner's table, which is where a question about someone else's photos belongs.
//
// DEFAULT IS "DO NOT TOUCH". Until a folder is decided, its files stay exactly where they are. An
// approval step that proceeds without the answer is not an approval (PHILOSOPHY §three doors: a gap
// is never filled by invention).
//
// Determinism: pure functions over a name — no clock, no filesystem (AGENT_GUIDE §canonical order).

/**
 * Generic placeholder names: they name no content, so they say nothing about what is inside.
 * Sorting such a folder is probably right — but "probably" is exactly what must be asked about.
 */
// Kept deliberately NARROW. The owner rejected the broad criteria because an approval list full of
// noise stops being read, so a name earns a place here only if it says nothing whatsoever about what
// is inside. «копии» and «старое» are NOT here: they are weak, but they do tell you something, and a
// false positive costs the owner a decision they should never have been asked to make.
const PLACEHOLDER_NAMES = new Set([
  'разное', 'разности', 'всякое', 'мусор', 'хлам', 'ерунда',
  'новая папка', 'папка', 'без названия', 'без имени', 'безымянная',
  'new folder', 'new folder (2)', 'untitled', 'unnamed', 'folder', 'misc', 'other', 'stuff',
  'temp', 'tmp', 'разобрать', 'разобрать потом', 'todo',
]);

/**
 * Localized names of device/app folders. Their English forms are already dropped as technical
 * (`bucket.mjs` → TECHNICAL_DIR_NAMES); these are the same folders on a Russian phone or Windows,
 * and whether they count as technical is a policy question the owner now answers per archive.
 */
const LOCALIZED_DEVICE_NAMES = new Set([
  'скриншоты', 'снимки экрана', 'снимок экрана', 'камера', 'фотокамера', 'загрузки', 'закачки',
  'изображения', 'картинки', 'рисунки', 'мои рисунки', 'мои изображения', 'мои документы',
  'видеозаписи', 'ролики', 'звукозаписи', 'записи', 'полученные', 'отправленные', 'входящие',
]);

/** A name made only of digits and punctuation — `123`, `#1`, `__`, `2 (2)`. Says nothing. */
const NO_LETTERS_RE = /^[^\p{L}]+$/u;

/** Hash- or id-looking names: long runs of hex, or base64-ish blobs with no word in them. */
const HASHY_RE = /^[0-9a-f]{8,}$/i;
const IDLIKE_RE = /^[A-Za-z0-9_-]{16,}$/;

/**
 * Is this directory name unclear — neither plainly technical nor plainly the owner's own word?
 *
 * @param {string} segment  a single path segment
 * @returns {{suspicious: boolean, reason: string|null}}
 */
export function inspectDirName(segment) {
  const s = (segment ?? '').trim();
  const lower = s.toLowerCase();

  if (PLACEHOLDER_NAMES.has(lower)) {
    return { suspicious: true, reason: 'имя-заглушка: по нему нельзя понять, что внутри' };
  }
  if (LOCALIZED_DEVICE_NAMES.has(lower)) {
    return { suspicious: true, reason: 'похоже на системную папку телефона или Windows, но по-русски' };
  }
  if (NO_LETTERS_RE.test(s)) {
    return { suspicious: true, reason: 'в имени нет ни одной буквы — оно ничего не говорит о содержимом' };
  }
  if (HASHY_RE.test(s) || IDLIKE_RE.test(s)) {
    return { suspicious: true, reason: 'имя выглядит как технический идентификатор, а не как название' };
  }
  return { suspicious: false, reason: null };
}

/**
 * Which directories of a tree need the owner's decision?
 *
 * Only directories that actually hold media are listed: an approval list should contain decisions
 * the owner has to make, not every folder that happens to have an odd name. A suspicious directory
 * nested inside another suspicious one is reported once, at the OUTERMOST level — deciding the
 * parent decides the children, and asking twice about the same pile is the noise the owner rejected.
 *
 * @param {object[]} assets  scan assets (path, kind, …)
 * @param {(seg: string) => boolean} isTechnical  the technical-dir test from bucket.mjs (injected to
 *        respect RULE 2 — this module must not reach sideways into its sibling's internals)
 * @returns {Array<{dir: string, reason: string, files: number}>} sorted by path
 */
export function findSuspiciousDirs(assets, isTechnical) {
  const counts = new Map();   // suspicious dir → number of media files under it
  const reasons = new Map();

  for (const asset of assets) {
    if (asset.kind === 'other') continue;              // non-media never moves anyway
    const segments = asset.path.split('/').slice(0, -1);
    // Outermost suspicious ancestor wins; technical ancestors are skipped, not judged.
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (isTechnical(seg)) continue;
      const verdict = inspectDirName(seg);
      if (!verdict.suspicious) continue;
      const dir = segments.slice(0, i + 1).join('/');
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
      reasons.set(dir, verdict.reason);
      break;
    }
  }

  return [...counts.entries()]
    .map(([dir, files]) => ({ dir, reason: reasons.get(dir), files }))
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
}

/**
 * Is this file inside a directory that is still awaiting a decision?
 * @param {string} relPath
 * @param {Map<string, string>} pending  suspicious dir → its decision ('' when undecided)
 * @returns {string|null} the undecided directory, or null
 */
export function heldBy(relPath, pending) {
  const segments = relPath.split('/').slice(0, -1);
  for (let i = 0; i < segments.length; i++) {
    const dir = segments.slice(0, i + 1).join('/');
    if (pending.has(dir)) return dir;
  }
  return null;
}
