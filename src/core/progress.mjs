// src/core/progress.mjs — telling the owner the tool is alive during a long run.
// [NOT-TESTED]
//
// WHY: `researches/02` §4 counts the real archive at 71 606 files / 551 GB, and hashing that is
// hours. Today every phase prints nothing until it finishes. For a non-technical owner watching a
// window that has said nothing for forty minutes, "working" and "hung" look identical — and the
// rational response to a hang is Ctrl-C, which is the one thing that must not happen in the middle
// of a sort. Progress output is therefore a SAFETY feature, not a courtesy.
//
// Two rules shape the design, both from AGENT_GUIDE §Code style:
//
//   1. **stderr only, never stdout.** stdout carries the machine-readable artifact — `kpot scan`
//      pipes JSON, `kpot plan --json` emits the SortPlan. A progress line on stdout would corrupt
//      every one of those pipes. This is not a preference; it is the reason `2>` exists.
//   2. **Never in compared output.** Counters and rates are non-deterministic by nature, so they
//      live nowhere near the artifacts that are diffed, cached or asserted on. Progress is emitted
//      and forgotten; nothing downstream can read it.
//
// It also stays silent when stderr is not a terminal (a log file, a pipe, the test runner), because
// a carriage-return progress bar in a log file is unreadable noise. That check is what makes this
// module safe to wire into every phase unconditionally.

/** How often a live run refreshes the line. Fast enough to look alive, slow enough not to flicker. */
const REFRESH_MS = 200;

/**
 * "Return to column 0 and erase the line." Built from char codes rather than written literally:
 * an ESC byte in a source file is invisible in every editor and survives transport unreliably —
 * the same trap that once made a `.mjs` file look binary to git (EXPERIENCE.md EXP-0009).
 */
const CLEAR_LINE = `\r${String.fromCharCode(27)}[2K`;

/** Format a byte count the way a person reads it. */
export function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '?';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Format a duration the way a person reads it. */
export function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '?';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин ${s % 60} с`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
}

/**
 * Create a progress reporter.
 *
 * The returned object is always safe to call: when progress is off (not a terminal, or explicitly
 * disabled) every method is a no-op, so callers never need an `if`. That is deliberate — an
 * optional feature guarded by conditions at fifty call sites is how call sites drift apart.
 *
 * @param {{stream?: NodeJS.WriteStream, enabled?: boolean, label?: string, now?: () => number}} [opts]
 *        `enabled` defaults to "stderr is a TTY". `now` is injectable so specs need no clock.
 * @returns {{start: Function, tick: Function, done: Function, enabled: boolean}}
 */
export function createProgress({
  stream = process.stderr,
  enabled = Boolean(stream?.isTTY),
  now = () => Date.now(),
} = {}) {
  if (!enabled) {
    const noop = () => {};
    return { start: noop, tick: noop, done: noop, enabled: false };
  }

  let label = '';
  let total = 0;
  let count = 0;
  let bytes = 0;
  let startedAt = 0;
  let lastPaint = 0;
  let painted = false;

  /** Erase the current line so the next write starts clean (no leftovers from a longer line). */
  const clear = () => { if (painted) { stream.write(CLEAR_LINE); painted = false; } };

  const paint = () => {
    const elapsed = now() - startedAt;
    const parts = [label];
    parts.push(total > 0 ? `${count}/${total}` : String(count));
    if (total > 0) parts.push(`${Math.floor((count / total) * 100)}%`);
    if (bytes > 0) parts.push(humanBytes(bytes));
    if (elapsed > 3000 && count > 0 && total > count) {
      // Remaining time from the rate actually observed so far — no model, no guess.
      parts.push(`осталось ~${humanDuration((elapsed / count) * (total - count))}`);
    }
    stream.write(`${CLEAR_LINE}${parts.join(' · ')}`);
    painted = true;
  };

  return {
    enabled: true,

    /** Begin a phase. `total` may be 0 when the size is not known yet. */
    start(newLabel, newTotal = 0) {
      label = newLabel;
      total = newTotal;
      count = 0;
      bytes = 0;
      startedAt = now();
      lastPaint = 0;
      paint();
    },

    /**
     * One more unit done. Repainting is throttled: at 71 606 files an unthrottled bar spends more
     * time writing escape codes than the scan spends hashing.
     */
    tick(sizeBytes = 0) {
      count += 1;
      bytes += sizeBytes;
      const t = now();
      if (t - lastPaint >= REFRESH_MS) { lastPaint = t; paint(); }
    },

    /** Finish the phase: overwrite the line with a one-line summary that stays on screen. */
    done(summary) {
      const elapsed = now() - startedAt;
      clear();
      if (summary) stream.write(`${summary} · ${humanDuration(elapsed)}\n`);
    },
  };
}
