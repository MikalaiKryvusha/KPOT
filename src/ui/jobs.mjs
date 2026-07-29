// src/ui/jobs.mjs — how the interface runs a phase (6.2a, plans/06; the undo added 6.3, plans/07).
// [TESTED: 2026-07-29 · tests/ui_jobs.test.mjs (7 specs) + tests/ui_undo.test.mjs (the undo's
// confirmation, its refusal without a named run, and one-job-at-a-time), guards break-verified]
//
// A phase takes minutes on a real archive, and a browser cannot wait for it. So the interface does
// not "call a function and render the answer": it STARTS A JOB, watches it, and reads the result
// when it lands. This module is that job, and it is deliberately the smallest thing that can be:
// one job at a time, four states, no queue.
//
// The rule that makes it small is also the one that makes it safe: **exactly one job may run**. Two
// `apply` runs over the same tree at once is a race for the owner's photographs, and there is no
// sensible way to merge their journals afterwards. A second request is REFUSED with an explanation
// rather than queued — a queue would mean a sort could start later, when nobody is watching, which
// is precisely the surprise this product must never spring.
//
// RULE 1 is untouched: nothing here writes a user file. It calls `src/app/phases.mjs`, which calls
// `src/apply/`, which stays the single writer.

import { scanArchive, planArchive, applyArchive, rollbackArchive } from '../app/phases.mjs';

/** The states a job passes through. `failed` is a RESULT, not a crash — the server keeps serving. */
export const JOB_STATE = {
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
};

/** The four things a person can start from the interface. */
export const JOB_KIND = {
  SCAN: 'scan',           // «разведка» — look at the folder, decide nothing
  PLAN: 'plan',           // «план» — what would move where
  APPLY: 'apply',         // «сортировка» — moves files into the library
  ROLLBACK: 'rollback',   // «вернуть как было» — moves them all back (plans/07)
};

/** The kinds that MOVE a person's files, and may therefore never start unconfirmed. */
const MOVES_FILES = new Set([JOB_KIND.APPLY, JOB_KIND.ROLLBACK]);

/**
 * Create the job runner.
 *
 * @param {{onEvent?: (event: string, data: object) => void, progressFor?: () => object}} deps
 *        `onEvent` is how the browser hears about it (the server passes its SSE broadcaster);
 *        `progressFor` supplies a progress object per run. Both injectable so specs need no server.
 */
export function createJobRunner({ onEvent = () => {}, progressFor = () => null } = {}) {
  /** The single slot. `null` means nothing is running and a new job may start. */
  let current = null;
  /** The last finished job, kept so a browser that reconnects can still read the outcome. */
  let last = null;
  let seq = 0;

  const snapshot = (job) => job && ({
    id: job.id, kind: job.kind, root: job.root, state: job.state,
    // Which run an undo was for. A browser that reconnects mid-undo needs to know WHICH one it is
    // watching, and the finished event is how the panel learns to re-read its history.
    runId: job.runId ?? null,
    startedAt: job.startedAt, finishedAt: job.finishedAt ?? null,
    error: job.error ?? null, result: job.result ?? null,
  });

  return {
    /** What is happening right now, and what happened last — everything a face needs to render. */
    state() {
      return { current: snapshot(current), last: snapshot(last), busy: current !== null };
    },

    /**
     * Start a phase.
     *
     * @param {string} kind one of JOB_KIND
     * @param {string} root the archive directory
     * @param {{confirmed?: boolean, dryRun?: boolean, startedAtMs?: number, runId?: string}} [opts]
     *        `confirmed` is REQUIRED for a real sort and for an undo — see below.
     *        `runId` is REQUIRED for an undo: it names the run being reversed.
     * @returns {{ok: true, job: object} | {ok: false, reason: string, message: string}}
     */
    start(kind, root, { confirmed = false, dryRun = false, startedAtMs = 0, runId = null } = {}) {
      if (!Object.values(JOB_KIND).includes(kind)) {
        return { ok: false, reason: 'unknown-kind', message: 'неизвестное действие' };
      }
      if (current) {
        // Refused, not queued. A queued sort would start later, unattended — the one surprise this
        // product may never spring on the owner.
        return { ok: false, reason: 'busy',
          message: 'Сейчас уже идёт работа. Дождитесь её окончания или остановите её.' };
      }
      // The owner chose ONE deliberate confirmation with the numbers before the sort (interview
      // #003 Q4 = А). The server does not trust the page to have asked: without an explicit
      // confirmation the request is refused here, so a mis-wired button cannot move a single file.
      //
      // An undo obeys the SAME rule, in the same place, for a stronger reason: it is the most
      // destructive operation this product has, and it is now one HTTP request away (plans/07 §3.3).
      if (MOVES_FILES.has(kind) && !dryRun && !confirmed) {
        return { ok: false, reason: 'needs-confirmation',
          message: kind === JOB_KIND.ROLLBACK
            ? 'Возврат файлов начнётся только после вашего подтверждения.'
            : 'Сортировка начнётся только после вашего подтверждения.' };
      }
      // An undo without a run named is not an undo — «вернуть всё подряд» is deliberately not a
      // thing this product offers (plans/07 §5).
      if (kind === JOB_KIND.ROLLBACK && (typeof runId !== 'string' || runId === '')) {
        return { ok: false, reason: 'no-run',
          message: 'Не указано, какой именно прогон возвращать.' };
      }

      const job = {
        id: `job-${++seq}`, kind, root, runId, state: JOB_STATE.RUNNING,
        startedAt: startedAtMs, finishedAt: null, error: null, result: null,
      };
      current = job;
      onEvent('job-started', snapshot(job));

      // Deliberately NOT awaited: the caller is an HTTP handler that must answer immediately, and
      // the run has to outlive both that response and the browser tab that asked for it.
      runPhase(kind, root, { dryRun, runId, progress: progressFor() })
        .then((result) => {
          job.state = JOB_STATE.DONE;
          job.result = result;
        })
        .catch((e) => {
          // A failure is an outcome the person reads, not a stack trace and not a dead server.
          job.state = JOB_STATE.FAILED;
          job.error = e?.message ?? String(e);
        })
        .finally(() => {
          last = job;
          current = null;
          onEvent('job-finished', snapshot(job));
        });

      return { ok: true, job: snapshot(job) };
    },
  };
}

/** Dispatch to the app layer. The only place that knows which phase means which function. */
function runPhase(kind, root, { dryRun, runId, progress }) {
  if (kind === JOB_KIND.SCAN) return scanArchive(root, { progress });
  if (kind === JOB_KIND.PLAN) return planArchive(root, { progress });
  if (kind === JOB_KIND.ROLLBACK) return rollbackArchive(runId, root);
  return applyArchive(root, { dryRun, progress });
}
