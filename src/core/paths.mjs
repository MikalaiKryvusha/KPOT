// src/core/paths.mjs — Windows-aware path normalization and comparison.
// [TESTED: 2026-07-24 · tests/core_paths.test.mjs — 5 specs; suite 40/40 green]
//
// The owner's archive lives on Windows (drive letters, UNC shares, `\\?\` long paths, a
// case-insensitive-but-case-preserving filesystem). Comparing paths with `===` is therefore a bug
// factory — AGENT_GUIDE.md code style mandates a normalizing helper instead. This module IS that
// helper. It deliberately uses `node:path`'s **win32 semantics everywhere** (`path.win32`), because
// the problems it solves — drive-letter case, UNC prefixes, 260-char limits — are Windows problems;
// win32 semantics also accept `/`-separated input, so fixture paths written with `/` compare fine.
//
// Layering (RULE 2): this is the bottom layer — imports nothing above `node:`.

import { win32 } from 'node:path';

/** The extended-length ("long path") prefix that lifts the 260-char MAX_PATH limit on Windows. */
export const LONG_PATH_PREFIX = '\\\\?\\';

/** Extended-length form of a UNC path: `\\?\UNC\server\share\…`. */
export const LONG_UNC_PREFIX = '\\\\?\\UNC\\';

/** Windows MAX_PATH; absolute paths at or past this need the extended-length prefix. */
export const MAX_PATH = 260;

/**
 * The directory where KPOT keeps its own run data (journals, backup manifests, hardlink snapshots),
 * created inside the scanned root. [TESTED: 2026-07-26 · tests/apply_phase4.test.mjs — a scan of a
 * tree containing it returns no asset from inside it]
 *
 * It lives HERE, in the bottom layer, rather than next to the code that creates it (`src/apply/`),
 * because `src/scan/` must skip it and RULE 2 forbids scan from importing apply. Two modules need
 * one fact → the fact moves down (AGENT_GUIDE §RULE 2).
 *
 * Why inside the root at all: a hardlink cannot cross a volume, so the backup snapshot must sit on
 * the same volume as the archive. Placing the run dir in the tree it backs up guarantees that with
 * zero configuration — and the backup travels with the drive.
 */
export const RUNS_DIR_NAME = '.kpot-runs';

/**
 * Strip an extended-length prefix, restoring the plain form:
 * `\\?\C:\x` → `C:\x` and `\\?\UNC\server\share\x` → `\\server\share\x`.
 * Paths without the prefix pass through unchanged.
 * @param {string} p
 * @returns {string}
 */
export function stripLongPrefix(p) {
  if (p.startsWith(LONG_UNC_PREFIX)) return '\\\\' + p.slice(LONG_UNC_PREFIX.length);
  if (p.startsWith(LONG_PATH_PREFIX)) return p.slice(LONG_PATH_PREFIX.length);
  return p;
}

/**
 * Add the extended-length prefix to an **absolute, already-normalized** path when it needs one
 * (at/over MAX_PATH). Already-prefixed and relative paths pass through unchanged — the `\\?\` form
 * disables Win32 normalization, so prefixing a relative or un-normalized path would be wrong.
 * @param {string} abs  absolute path
 * @param {number} [limit]  override for tests (default MAX_PATH)
 * @returns {string}
 */
export function toExtendedLengthIfNeeded(abs, limit = MAX_PATH) {
  if (abs.startsWith(LONG_PATH_PREFIX)) return abs;   // already extended (incl. UNC form)
  if (abs.length < limit) return abs;
  const norm = win32.normalize(abs);
  if (norm.startsWith('\\\\')) return LONG_UNC_PREFIX + norm.slice(2); // UNC → \\?\UNC\…
  if (win32.isAbsolute(norm)) return LONG_PATH_PREFIX + norm;
  return abs; // relative paths cannot take the prefix — caller must resolve first
}

/**
 * Normalize a path to its canonical comparison form: extended-length prefix stripped,
 * separators/`.`/`..` collapsed by win32 rules, trailing separator dropped (except a bare root),
 * and — by default, matching the Windows target — case-folded.
 *
 * NOTE on case: Windows filesystems are case-insensitive-but-case-preserving, so folding is the
 * correct *comparison* default here. This is a comparison key, never a display string — the user's
 * original casing must always be preserved elsewhere (GOAL.md name-preservation requirement).
 * Callers dealing with a case-sensitive volume pass `{ caseInsensitive: false }`.
 *
 * @param {string} p
 * @param {{caseInsensitive?: boolean}} [opts]
 * @returns {string}
 */
export function normalizeForCompare(p, { caseInsensitive = true } = {}) {
  let n = win32.normalize(stripLongPrefix(p));
  // drop a trailing separator, but keep roots like `C:\` and `\\server\share` intact
  if (n.length > 1 && (n.endsWith('\\') || n.endsWith('/'))) {
    const woSep = n.slice(0, -1);
    if (!/^[A-Za-z]:$/.test(woSep)) n = woSep;
  }
  return caseInsensitive ? n.toLowerCase() : n;
}

/**
 * Are two paths the same file location? (Textual comparison after normalization — does NOT hit the
 * filesystem, so it cannot see through symlinks/junctions; that is deliberate for a planning tool.)
 * @param {string} a
 * @param {string} b
 * @param {{caseInsensitive?: boolean}} [opts]
 * @returns {boolean}
 */
export function samePath(a, b, opts) {
  return normalizeForCompare(a, opts) === normalizeForCompare(b, opts);
}

/**
 * Is `child` located inside `parent` (strictly — a path is not inside itself)?
 * Same textual/normalized semantics as `samePath`.
 * @returns {boolean}
 */
export function isInside(child, parent, opts) {
  const c = normalizeForCompare(child, opts);
  const p = normalizeForCompare(parent, opts);
  if (c === p) return false;
  const withSep = p.endsWith('\\') ? p : p + '\\';
  return c.startsWith(withSep);
}
