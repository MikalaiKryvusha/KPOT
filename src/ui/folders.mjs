// src/ui/folders.mjs — letting a person CHOOSE a folder without typing a path (6.2b, plans/06).
// [NOT-TESTED]
//
// Why this exists at all. A browser page cannot open a folder dialog that yields a real filesystem
// path — the web platform forbids it on purpose, and no amount of cleverness gets around it. The
// alternative is asking the person to type `D:\Фото\с телефона` by hand, which is precisely the
// opposite of the «ЗАЩИТА ОТ ДУРАКА» the owner made a hard requirement. So the server lists folders
// and the page lets the person click through them, the way an installer does.
//
// What it will NOT do, deliberately:
//   · it never lists FILES — only folders, and only their names. The interface has no business
//     showing the owner's photographs to anything, and «no thumbnails» was his own decision;
//   · it never follows a request into a place the caller did not ask about: one directory per call,
//     no recursion, no globbing;
//   · it reads. It cannot create, rename or delete anything — RULE 1 is not bent for convenience.
//
// The token and the Host whitelist in server.mjs are what keep this from being a filesystem browser
// for anything else on the machine; this module is only ever reached after both have passed.

import { readdir, stat } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';

/**
 * The list of drives to start from on Windows, so the first screen is not an empty text box.
 * Probed rather than assumed: a letter that does not answer `stat` is simply not offered.
 */
async function drives() {
  const found = [];
  for (let c = 'A'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const root = `${String.fromCharCode(c)}:\\`;
    try {
      await stat(root);
      found.push({ name: root, path: root });
    } catch { /* no such drive — do not offer it */ }
  }
  return found;
}

/**
 * List the folders inside `path`, or the starting points when `path` is empty.
 *
 * @param {string|null} path
 * @returns {Promise<{path: string|null, parent: string|null, entries: Array<{name, path}>,
 *                    unreadable: boolean}>}
 */
export async function listFolders(path) {
  if (!path) {
    // The starting screen: drives on Windows, the filesystem root elsewhere.
    const entries = process.platform === 'win32' ? await drives() : [{ name: '/', path: '/' }];
    return { path: null, parent: null, entries, unreadable: false };
  }

  const here = resolve(path);
  const up = dirname(here);
  // At a drive root `dirname` returns the same path; that is how we know there is no "up" left.
  const parent = up === here ? null : up;

  let names;
  try {
    names = await readdir(here, { withFileTypes: true });
  } catch {
    // A folder Windows will not open (permissions, a disconnected drive) is reported as unreadable
    // rather than as an error page: the person needs to go back, not to see a stack trace.
    return { path: here, parent, entries: [], unreadable: true };
  }

  const entries = names
    .filter((e) => e.isDirectory())
    // Hidden and system folders are noise for the person choosing a photo folder, and `.kpot-runs`
    // is our own bookkeeping — showing it would invite someone to sort it.
    .filter((e) => !e.name.startsWith('.') && !e.name.startsWith('$'))
    .map((e) => ({ name: e.name, path: join(here, e.name) }))
    // Canonical order (AGENT_GUIDE §Code style): the same folder always lists the same way, and
    // `localeCompare` puts Cyrillic names where a Russian speaker expects them.
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return { path: here, parent, entries, unreadable: false };
}

/** Is this path a folder that exists? The question the wizard asks before offering «Дальше». */
export async function isUsableFolder(path) {
  if (!path) return false;
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** The drive/root a path belongs to — used by the page for a readable breadcrumb. */
export const rootOf = (path) => parse(resolve(path)).root;
