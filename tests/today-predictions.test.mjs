import test from 'node:test';
import assert from 'node:assert/strict';
import { taipeiDay, nextTaipeiMidnight, todayPredictions } from '../public/today-predictions.js';

test('only future games on the current Taiwan date, earliest first', () => {
  const now = Date.parse('2026-11-06T01:00:00Z');
  const rows = [
    { league: 'NBA', startAt: '2026-11-06T16:01:00Z', id: 'tomorrow' },
    { league: 'NBA', startAt: '2026-11-06T03:00:00Z', id: 'late' },
    { league: 'NBA', startAt: '2026-11-06T02:00:00Z', id: 'early' },
    { league: 'NBA', startAt: '2026-11-06T01:00:00Z', id: 'started' },
    { league: 'MLB', startAt: '2026-11-06T02:00:00Z', id: 'other' },
    { league: 'NBA', startAt: 'invalid', id: 'invalid' }
  ];
  assert.deepEqual(todayPredictions(rows, 'NBA', now).map(x => x.id), ['early', 'late']);
  assert.equal(taipeiDay(now), '2026-11-06');
});

test('Taipei midnight, including when no predictions are available', () => {
  const before = Date.parse('2026-11-06T15:59:59Z');
  const midnight = Date.parse('2026-11-06T16:00:00Z');
  assert.equal(nextTaipeiMidnight(before), midnight);
  assert.equal(taipeiDay(before), '2026-11-06');
  assert.equal(taipeiDay(midnight), '2026-11-07');
  assert.equal(nextTaipeiMidnight(midnight), midnight + 86400000);
  const rows = [{ league: 'NBA', startAt: '2026-11-07T02:00:00Z' }];
  assert.equal(todayPredictions(rows, 'NBA', before).length, 0);
  assert.equal(todayPredictions(rows, 'NBA', midnight).length, 1);
});

