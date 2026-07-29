// src/core/inbox.mjs — the `НОВОЕ` folder as something the interface can look at and offer to create.
// [TESTED: 2026-07-29 · tests/inbox.test.mjs — counting, the missing folder, the refusal to invent a
// root, and idempotent creation; the root guard verified by breaking it first]
//
// Phase 6.4 (plans/08), from idea 01 as the owner answered it on 2026-07-28: the inbox lives INSIDE
// the library root and is called `НОВОЕ`. Everything about SORTING it is already built — the folder
// is part of the tree a normal run walks, and the sort is idempotent — so this module deliberately
// does none of that. It answers two much smaller questions the control panel needs:
//
//   · how much is waiting in there right now (so the person is told, not left to guess);
//   · and, when the folder does not exist yet, it can be made — one empty directory, nothing else.
//
// Why it lives in `src/core/` rather than in the interface: `src/ui/` may not reach below
// `src/app/` (RULE 2, and a spec enforces it), and the concept belongs next to `INBOX_DIR` in
// `paths.mjs` rather than inside a face. `src/app/phases.mjs` re-exports both functions, exactly as
// it re-exports `listRuns` and the path helpers.
//
// RULE 1 is intact. `createInbox` makes ONE empty directory of KPOT's own — the same class of
// bookkeeping as `.kpot-runs/`, which `src/core/` already creates. It never touches, moves or
// deletes a file of the owner's; only `src/apply/` does that.

import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { INBOX_DIR } from './paths.mjs';

/**
 * How much is waiting in the inbox?
 *
 * Counts FILES, at any depth — the owner drops whole folders off a phone, and «3 файла» when there
 * are forty inside two subfolders would be a number that misleads rather than informs. Directories
 * themselves are not counted: nobody thinks of a folder as a thing waiting to be sorted.
 *
 * A missing inbox is not an error and not an empty one: `exists: false` is a genuinely different
 * state, and the panel says something different about it (an offer to create it, rather than «0»).
 *
 * @param {string} root the library root
 * @returns {Promise<{name: string, path: string, exists: boolean, files: number}>}
 */
export async function inboxState(root) {
  const path = join(root, INBOX_DIR);
  const absent = { name: INBOX_DIR, path, exists: false, files: 0 };
  try {
    if (!(await stat(path)).isDirectory()) return absent;   // a FILE named НОВОЕ is not an inbox
  } catch {
    return absent;
  }
  return { name: INBOX_DIR, path, exists: true, files: await countFiles(path) };
}

/**
 * Files at any depth under `dir`. Depth-first and unbounded on purpose: an inbox is a transit
 * folder holding what arrived since the last tidy-up, not an archive — if it ever grows to the size
 * where this matters, the honest answer is that the person needs to press the sort button, which is
 * exactly what the panel is about to tell them.
 *
 * A directory that cannot be read contributes 0 rather than throwing: a count is a courtesy, and
 * refusing to draw the whole panel because one subfolder is locked would be a poor trade.
 */
async function countFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let count = 0;
  for (const e of entries) {
    if (e.isDirectory()) count += await countFiles(join(dir, e.name));
    else if (e.isFile()) count += 1;
  }
  return count;
}

/**
 * Create the inbox inside an EXISTING library root.
 *
 * The root is checked first, and that check is the whole reason this is not a one-line `mkdir`:
 * `{ recursive: true }` silently creates missing PARENTS, so a mistyped or stale root would leave a
 * stray `D:\Фото-архивв\НОВОЕ\` on the owner's disk instead of failing. That is not a hypothetical —
 * phase 6.0 measured exactly this happening through `.kpot-runs/` and moved the guard down into the
 * engine for exactly this reason. `recursive` is then kept for the opposite property: creating an
 * inbox that already exists is a no-op, not an error, so a double click is harmless.
 *
 * @param {string} root the library root, which must already exist
 * @returns {Promise<{name: string, path: string, exists: boolean, files: number}>} the new state
 */
export async function createInbox(root) {
  let s;
  try {
    s = await stat(root);
  } catch {
    throw new Error(`directory does not exist: ${root}`);
  }
  if (!s.isDirectory()) throw new Error(`not a directory: ${root}`);

  await mkdir(join(root, INBOX_DIR), { recursive: true });
  return inboxState(root);
}
