// tests/core_pool.test.mjs — specs for the bounded-concurrency mapper.
// [TESTED: 2026-07-24 · runs green via npm test — suite 40/40]

import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { mapLimit } from '../src/core/pool.mjs';

test('results come back in item order even when completion order differs', async () => {
  const items = [50, 10, 30, 0, 20]; // later items finish before earlier ones
  const out = await mapLimit(items, 3, async (ms) => { await sleep(ms); return ms * 2; });
  assert.deepEqual(out.map(r => r.value), [100, 20, 60, 0, 40]);
  assert.ok(out.every(r => r.ok));
});

test('never runs more than `limit` workers at once', async () => {
  let active = 0, peak = 0;
  await mapLimit(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
    active++; peak = Math.max(peak, active);
    await sleep(5);
    active--;
  });
  assert.ok(peak <= 4, `peak concurrency ${peak} exceeded limit 4`);
  assert.ok(peak >= 2, `pool never actually ran concurrently (peak ${peak})`);
});

test('one failing item settles as an error and aborts nothing', async () => {
  const out = await mapLimit(['a.jpg', 'BOOM', 'c.jpg'], 2, async (name) => {
    if (name === 'BOOM') throw new Error(`unreadable: ${name}`);
    return name.toUpperCase();
  });
  assert.deepEqual(out[0], { ok: true, value: 'A.JPG' });
  assert.equal(out[1].ok, false);
  assert.match(out[1].error.message, /unreadable: BOOM/); // errors carry the path (AGENT_GUIDE style)
  assert.deepEqual(out[2], { ok: true, value: 'C.JPG' });
});

test('edge cases: empty input, limit larger than the list, invalid limit', async () => {
  assert.deepEqual(await mapLimit([], 8, async () => 1), []);
  const out = await mapLimit([1, 2], 100, async (x) => x);
  assert.deepEqual(out.map(r => r.value), [1, 2]);
  for (const bad of [0, -1, 1.5, NaN, undefined]) {
    await assert.rejects(() => mapLimit([1], bad, async (x) => x), RangeError, String(bad));
  }
});
