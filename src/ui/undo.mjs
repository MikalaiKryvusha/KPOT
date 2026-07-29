// src/ui/undo.mjs — deciding whether an undo asked for over HTTP may proceed (phase 6.3, plans/07).
// [TESTED: 2026-07-29 · tests/ui_undo.test.mjs — 10 specs. The three guards here were verified by
// breaking the code first: deleting the containment check turns 2 specs red, deleting the
// `undoable` check turns 1 red, and dropping ROLLBACK from the confirmation rule in jobs.mjs turns
// the "nothing moved" spec red — that last one because the tree really did move]
//
// This is the gate in front of the most destructive thing KPOT can do. The undo itself is old,
// tested and unchanged (`src/apply/rollback.mjs`); what is new — and what this module exists for —
// is that a RUN ID now arrives from outside the program.
//
// Everything below follows from that one sentence:
//
//   · a run id is a PATH SEGMENT. `.kpot-runs/<id>` with an id of `..\..\чужое` is a different
//     archive entirely, so the resolved directory is checked for containment before anything reads
//     it. Same rule and same reason as `src/ui/reveal.mjs`: resolve the real path FIRST, then check,
//     then act — `researches/08` measured a junction defeating the textual check;
//   · a row the panel could not honour must not be undoable through the door behind it. `listRuns`
//     already decides that honestly (`undoable` = a real run, finished, with its backup on disk), so
//     the server asks the same function the screen asked rather than re-deriving the answer;
//   · the confirmation is NOT here. It belongs to `src/ui/jobs.mjs`, next to the sort's, so that one
//     place decides whether work may start — see the note there.
//
// This module performs nothing. It answers a question; the job runner does the undoing.

import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { isInside, listRuns, RUNS_DIR_NAME } from '../app/phases.mjs';

/** Why an undo was refused. The face turns these into a sentence the person can act on. */
export const UNDO_REFUSED = {
  /** No such run in this archive — a mistyped or stale id, or a run directory that was deleted. */
  NOT_FOUND: 'not-found',
  /** The id resolves to somewhere outside this library. Not our run to undo. */
  OUTSIDE: 'outside-library',
  /** It exists, but it cannot be honoured: a rehearsal moved nothing, and a lost backup is lost. */
  NOT_UNDOABLE: 'not-undoable',
};

/**
 * May this run be undone, for this library?
 *
 * Exported apart from the doing so the rule can be tested without moving a single photograph — and
 * so it reads as one paragraph rather than as a branch inside a request handler.
 *
 * @param {string} runId the run id as the browser sent it
 * @param {string} libraryRoot the archive root this server is working with
 * @returns {Promise<{ok: true, runId: string, dir: string, run: object}
 *                 | {ok: false, reason: string}>}
 */
export async function checkUndoable(runId, libraryRoot) {
  // A run id is used to build a path, so anything that is not a plain non-empty string is refused
  // before it can become one.
  if (typeof runId !== 'string' || runId.trim() === '') {
    return { ok: false, reason: UNDO_REFUSED.NOT_FOUND };
  }
  if (typeof libraryRoot !== 'string' || libraryRoot.trim() === '') {
    return { ok: false, reason: UNDO_REFUSED.NOT_FOUND };
  }

  let realRoot, realDir;
  try {
    // The root is resolved too — comparing a resolved child against an unresolved root re-introduces
    // exactly the 8.3 short-name mismatch `researches/08` §2.3 measured.
    realRoot = await realpath(libraryRoot);
  } catch {
    return { ok: false, reason: UNDO_REFUSED.NOT_FOUND };
  }
  try {
    realDir = await realpath(join(realRoot, RUNS_DIR_NAME, runId));
  } catch {
    // `realpath` throws for a path that is not there — and a path we cannot resolve is exactly a
    // path we must refuse. The failure mode and the safety rule agree.
    return { ok: false, reason: UNDO_REFUSED.NOT_FOUND };
  }
  // Strictly INSIDE, never equal: the library root itself is not a run directory, and `..` climbing
  // back out lands here.
  if (!isInside(realDir, realRoot)) {
    return { ok: false, reason: UNDO_REFUSED.OUTSIDE };
  }

  // The same question the history row answered, asked of the same function. A row that says «вернуть
  // уже нельзя» and a door that accepts the request anyway would be two answers to one question.
  const run = (await listRuns(realRoot)).find((r) => r.runId === runId);
  if (!run) return { ok: false, reason: UNDO_REFUSED.NOT_FOUND };
  if (!run.undoable) return { ok: false, reason: UNDO_REFUSED.NOT_UNDOABLE };

  return { ok: true, runId, dir: realDir, run };
}
