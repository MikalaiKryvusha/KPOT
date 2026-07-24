// tests/season.test.mjs — specs for the season mapping.
// [TESTED: 2026-07-24 · runs green via npm test — suite 15/15]
// The expected table IS interview #001 Q2 — if these assertions ever need editing, that is an owner
// decision changing, not a refactor.

import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonForMonth, SEASONS, SEASON_ORDER } from '../src/plan/season.mjs';

test('every month lands in the owner-decided bucket', () => {
  const expected = {
    1: SEASONS.WINTER_START, 2: SEASONS.WINTER_START,
    3: SEASONS.SPRING, 4: SEASONS.SPRING, 5: SEASONS.SPRING,
    6: SEASONS.SUMMER, 7: SEASONS.SUMMER, 8: SEASONS.SUMMER,
    9: SEASONS.AUTUMN, 10: SEASONS.AUTUMN, 11: SEASONS.AUTUMN,
    12: SEASONS.WINTER_END,
  };
  for (const [month, season] of Object.entries(expected)) {
    assert.equal(seasonForMonth(Number(month)), season, `month ${month}`);
  }
});

test('bucket names are the canonical Russian directory names', () => {
  assert.deepEqual(SEASON_ORDER,
    ['Зима начало года', 'Весна', 'Лето', 'Осень', 'Зима конец года']);
});

test('invalid months fail loudly instead of guessing', () => {
  for (const bad of [0, 13, -1, 1.5, NaN, undefined, null, '7']) {
    assert.throws(() => seasonForMonth(bad), RangeError, String(bad));
  }
});
