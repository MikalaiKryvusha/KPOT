// src/core/pool.mjs — bounded-concurrency mapper.
// [TESTED: 2026-07-24 · tests/core_pool.test.mjs — order, bound, error isolation; suite 40/40 green]
//
// Why: an unbounded `Promise.all` over 71 606 files exhausts file handles (AGENT_GUIDE.md code
// style; real scale in researches/02 §Scale). And per the error policy — "a failure on one file
// must never abort a whole scan" — this mapper SETTLES every item instead of rejecting on the
// first error: the caller gets an in-order array of per-item outcomes and decides what an error
// means. There is deliberately no queue class, no events, no cancellation — a plain function is
// all the scan/hash phases need (PHILOSOPHY.md).

/**
 * Map `items` through async `fn`, running at most `limit` calls at once.
 *
 * @template T, R
 * @param {Iterable<T>} items
 * @param {number} limit  max concurrent `fn` calls; integer ≥ 1
 * @param {(item: T, index: number) => Promise<R>|R} fn
 * @returns {Promise<Array<{ok: true, value: R} | {ok: false, error: unknown}>>}
 *          one entry per item, in the original item order regardless of completion order
 */
export async function mapLimit(items, limit, fn) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`limit must be an integer >= 1, got: ${limit}`);
  }
  const list = Array.from(items);
  const results = new Array(list.length);
  let next = 0; // shared cursor — each worker pulls the next unclaimed index

  async function worker() {
    while (next < list.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await fn(list[i], i) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, list.length) }, worker);
  await Promise.all(workers);
  return results;
}
