// src/ui/jobs.mjs — how the interface runs a phase (6.2a, plans/06).
// [NOT-TESTED]
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

import { scanArchive, planArchive, applyArchive } from '../app/phases.mjs';

/** The states a job passes through. `failed` is a RESULT, not a crash — the server keeps serving. */
export const JOB_STATE = {
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
};

/** The three things a person can start from the interface. `rollback` belongs to the panel (6.3). */
export const JOB_KIND = {
  SCAN: 'scan',     // «разведка» — look at the folder, decide nothing
  PLAN: 'plan',     // «план» — what would move where
  APPLY: 'apply',   // «сортировка» — the only one that moves anything
};

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
     * @param {{confirmed?: boolean, dryRun?: boolean, startedAtMs?: number}} [opts]
     *        `confirmed` is REQUIRED for a real sort — see below.
     * @returns {{ok: true, job: object} | {ok: false, reason: string, message: string}}
     */
    start(kind, root, { confirmed = false, dryRun = false, startedAtMs = 0 } = {}) {
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
      if (kind === JOB_KIND.APPLY && !dryRun && !confirmed) {
        return { ok: false, reason: 'needs-confirmation',
          message: 'Сортировка начнётся только после вашего подтверждения.' };
      }

      const job = {
        id: `job-${++seq}`, kind, root, state: JOB_STATE.RUNNING,
        startedAt: startedAtMs, finishedAt: null, error: null, result: null,
      };
      current = job;
      onEvent('job-started', snapshot(job));

      // Deliberately NOT awaited: the caller is an HTTP handler that must answer immediately, and
      // the run has to outlive both that response and the browser tab that asked for it.
      runPhase(kind, root, { dryRun, progress: progressFor() })
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
function runPhase(kind, root, { dryRun, progress }) {
  if (kind === JOB_KIND.SCAN) return scanArchive(root, { progress });
  if (kind === JOB_KIND.PLAN) return planArchive(root, { progress });
  return applyArchive(root, { dryRun, progress });
}
