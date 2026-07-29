// src/ui/reveal.mjs — showing a folder in the file manager, safely (phase 6.3, researches/08).
// [NOT-TESTED]
//
// The owner cut thumbnails out of the interface and put links in their place: «если нужно отправить
// человека на просмотр - ссылки на папки» (interview #003 Q5). Pressing such a link makes the local
// server LAUNCH AN EXTERNAL PROGRAM with a path that arrived over HTTP, so this module is small and
// paranoid on purpose.
//
// Every rule below was MEASURED, not assumed — `researches/08_open_folder_and_path_safety.md`:
//
//   · `explorer.exe` returns exit code 1 EVEN WHEN IT SUCCEEDS (3 of 3 tries on a folder that
//     opened). Its exit code carries no information, so the path is validated BEFORE the launch and
//     the result is ignored afterwards. Checking "did it work?" would report failure every time;
//   · a JUNCTION created inside the library — `mklink /J`, no admin rights needed — points anywhere
//     on the machine, and the textual `isInside` in `src/core/paths.mjs` says «inside». That helper
//     is right for what it was built for (deciding where a file belongs, over paths from our own
//     walk) and INSUFFICIENT here, where the path comes from outside;
//   · 8.3 short names (`D51E~1`) break the same check in the opposite direction — a legitimate path
//     rejected.
//
// One rule fixes all three: **resolve the real path first, then check containment, then launch.**

import { realpath } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { isInside, samePath } from '../app/phases.mjs';

/** Why a request to show a folder was refused. The face turns these into a sentence. */
export const REVEAL_REFUSED = {
  /** The path does not exist, or cannot be resolved at all. */
  NOT_FOUND: 'not-found',
  /** It resolves to somewhere outside the library — a junction, a symlink, or simply another place. */
  OUTSIDE: 'outside-library',
};

/**
 * Decide whether `target` may be shown, resolving both sides to their real locations first.
 *
 * Exported separately from the launching so the decision can be tested without opening windows on
 * whoever runs the suite — and so the rule is readable on its own.
 *
 * @param {string} target the folder the request asks for
 * @param {string} libraryRoot the archive root this server is working with
 * @returns {Promise<{ok: true, path: string} | {ok: false, reason: string}>}
 */
export async function checkRevealable(target, libraryRoot) {
  let real, realRoot;
  try {
    // The ROOT is resolved too. Comparing a resolved child against an unresolved root re-introduces
    // exactly the short-name mismatch researches/08 §2.3 measured.
    realRoot = await realpath(libraryRoot);
  } catch {
    return { ok: false, reason: REVEAL_REFUSED.NOT_FOUND };
  }
  try {
    real = await realpath(target);
  } catch {
    // `realpath` throws ENOENT for a path that is not there, and a path we cannot resolve is exactly
    // a path we should refuse — the failure mode and the security rule happen to agree.
    return { ok: false, reason: REVEAL_REFUSED.NOT_FOUND };
  }
  // Equality counts as inside: "open the library itself" is a request the panel legitimately makes,
  // and `isInside` is strict by design.
  if (!samePath(real, realRoot) && !isInside(real, realRoot)) {
    return { ok: false, reason: REVEAL_REFUSED.OUTSIDE };
  }
  return { ok: true, path: real };
}

/**
 * Show a folder in the system file manager, if it is allowed.
 *
 * @param {string} target
 * @param {string} libraryRoot
 * @param {{spawnImpl?: Function}} [deps] injectable so specs can prove WHAT would be launched
 *        without actually opening windows.
 * @returns {Promise<{ok: true, path: string} | {ok: false, reason: string}>}
 */
export async function revealFolder(target, libraryRoot, { spawnImpl = spawn } = {}) {
  const decision = await checkRevealable(target, libraryRoot);
  if (!decision.ok) return decision;

  const [cmd, args] = process.platform === 'win32'
    ? ['explorer.exe', [decision.path]]
    : process.platform === 'darwin' ? ['open', [decision.path]] : ['xdg-open', [decision.path]];
  try {
    // An argument ARRAY, never a command string: a path is data, and this project is full of
    // Cyrillic names, spaces and long-path prefixes. Detached, because the window outlives us — and
    // the exit code is deliberately not awaited, because on Windows it is always 1 (researches/08).
    const child = spawnImpl(cmd, args, { detached: true, stdio: 'ignore' });
    child.unref?.();
  } catch {
    // Even a spawn failure is not worth failing the request over: the person can still find the
    // folder themselves, and the path is the useful part of the answer.
    return { ok: true, path: decision.path, launched: false };
  }
  return { ok: true, path: decision.path, launched: true };
}
