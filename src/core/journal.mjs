// src/core/journal.mjs — the run journal: an append-only JSONL record of everything a run intends
// to do and did. [TESTED: 2026-07-24 · tests/core_journal.test.mjs — 5 specs incl. crash-torn tail; suite 40/40 green]
//
// Why it exists (GOAL.md safety contract → AGENT_GUIDE.md RULE 1): before `src/apply/` may touch a
// user's file, the intended operation must be recorded here; after the run, the journal is what
// `rollback <run-id>` replays in reverse and what the post-sort report is rendered from. A journal
// that lies or loses records breaks the product's core guarantee, so the format is deliberately
// primitive: one JSON object per line, appended with a durable write per record, no in-memory
// buffering to lose on a crash.
//
// File layout: `<runsDir>/<runId>.jsonl`
//   line 1     — the header record  { kind: 'header', runId, startedAt, ... }
//   lines 2..n — appended records   { kind: <caller's>, seq: 1.., ts, ...payload }
//
// Real runs write to `.kpot-runs/` which is gitignored — a journal of a real run must never reach
// the public repo (repo rule 5). Tests write to OS temp dirs only.

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

/** Journal format version — bump on any breaking change to the record shapes. */
export const JOURNAL_VERSION = 1;

/**
 * Generate a run id: sortable timestamp + random suffix, filesystem-safe on every platform.
 * e.g. `run-20260724-153012-a1b2c3`
 * @param {Date} [now]  injectable for deterministic tests
 * @returns {string}
 */
export function newRunId(now = new Date()) {
  const t = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // YYYYMMDD-HHMMSS
  return `run-${t}-${randomBytes(3).toString('hex')}`;
}

/**
 * Create a new journal file (fails if one already exists for this runId — a journal is never
 * silently overwritten) and return the appender.
 *
 * @param {string} runsDir  directory for journals (created if missing)
 * @param {{runId?: string, meta?: object, now?: Date}} [opts]
 *        `meta` is embedded in the header (tool version, argv, target dir, …)
 * @returns {Promise<{runId: string, path: string, append: (kind: string, payload?: object) => Promise<object>}>}
 */
export async function createRunJournal(runsDir, { runId = newRunId(), meta = {}, now = new Date() } = {}) {
  await mkdir(runsDir, { recursive: true });
  const path = join(runsDir, `${runId}.jsonl`);
  const header = { kind: 'header', journalVersion: JOURNAL_VERSION, runId, startedAt: now.toISOString(), meta };
  // 'wx' = exclusive create — colliding with an existing journal must be an error, not an overwrite
  await writeFile(path, JSON.stringify(header) + '\n', { encoding: 'utf8', flag: 'wx' });

  let seq = 0; // monotone per-journal sequence, so partial replays and gaps are detectable
  return {
    runId,
    path,
    /**
     * Append one record. Durable per call (`appendFile`), returns the record as written.
     * @param {string} kind  record type, e.g. 'planned-move', 'moved', 'error', 'done'
     * @param {object} [payload]
     */
    async append(kind, payload = {}) {
      if (typeof kind !== 'string' || kind === '' || kind === 'header') {
        throw new TypeError(`journal record kind must be a non-empty string (not 'header'), got: ${kind}`);
      }
      const record = { kind, seq: ++seq, ts: new Date().toISOString(), ...payload };
      await appendFile(path, JSON.stringify(record) + '\n', 'utf8');
      return record;
    },
  };
}

/**
 * Re-open an EXISTING journal to append to it — the mechanism behind resuming an interrupted run.
 *
 * Why a run must continue its own journal rather than start a new one: the journal and the Backup
 * are a pair. The backup describes the tree as it was BEFORE the first write, so a single journal
 * spanning the whole run is what lets `rollback <run-id>` return the owner to the true original in
 * one command. Starting a second run instead would snapshot the half-sorted tree as if it were the
 * original, and undoing the whole thing would take two rollbacks in the right order.
 *
 * Sequence numbering continues from the highest `seq` already present, so records stay ordered and
 * gaps remain detectable. A torn final line from the crash is left exactly as it is — rewriting
 * history to tidy it up would destroy the evidence that the run was interrupted.
 *
 * @param {string} runsDir  directory holding `<runId>.jsonl`
 * @param {string} runId
 * @returns {Promise<{runId: string, path: string, header: object, resumedFrom: number,
 *                    append: (kind: string, payload?: object) => Promise<object>}>}
 * @throws if the journal does not exist or is not readable as one
 */
export async function openRunJournal(runsDir, runId) {
  const path = join(runsDir, `${runId}.jsonl`);
  const { header, records } = await readRunJournal(path);
  let seq = records.reduce((max, r) => (typeof r.seq === 'number' && r.seq > max ? r.seq : max), 0);
  return {
    runId: header.runId,
    path,
    header,
    resumedFrom: seq,
    async append(kind, payload = {}) {
      if (typeof kind !== 'string' || kind === '' || kind === 'header') {
        throw new TypeError(`journal record kind must be a non-empty string (not 'header'), got: ${kind}`);
      }
      const record = { kind, seq: ++seq, ts: new Date().toISOString(), ...payload };
      await appendFile(path, JSON.stringify(record) + '\n', 'utf8');
      return record;
    },
  };
}

/**
 * Read a journal back. Tolerates a torn final line (crash mid-append): the damage is reported in
 * `truncated`, never thrown — rollback must work from a journal of a crashed run.
 *
 * @param {string} path  full path to the `.jsonl` file
 * @returns {Promise<{header: object, records: object[], truncated: boolean}>}
 * @throws  if the file is unreadable or its first line is not a valid header
 */
export async function readRunJournal(path) {
  const raw = await readFile(path, 'utf8');
  const lines = raw.split('\n').filter(l => l !== '');
  let truncated = false;
  const parsed = [];
  for (const [i, line] of lines.entries()) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      if (i === lines.length - 1) { truncated = true; break; } // torn tail — expected crash artifact
      throw new Error(`corrupt journal record at line ${i + 1} of ${path}`);
    }
  }
  const header = parsed[0];
  if (!header || header.kind !== 'header' || !header.runId) {
    throw new Error(`not a run journal (missing header): ${path}`);
  }
  return { header, records: parsed.slice(1), truncated };
}
