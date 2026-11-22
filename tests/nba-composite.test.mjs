import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildNbaComposite} from '../lib/nba-composite.mjs';
import {movement} from '../public/nba-composite-view.js';

function fixture(updatedAt, hash) {
  const observedAt = new Date(Date.parse(updatedAt) + 60000).toISOString();
  const teams = Array.from({length: 30}, (_, index) => ({
    team: `T${index}`, observedAt,
    players: Array.from({length: 4}, (_, offset) => ({
      id: String(index * 4 + offset + 1), position: 'G', name: `Player ${index * 4 + offset + 1}`, team: `T${index}`,
    })),
  }));
  const rows = teams.flatMap(team => team.players).map((player, index) => ({
    ...player, games: 10, minutes: 240, impact: index / 10, offense: index / 10, defense: 0,
    bpm: index / 10, war: 0, status: 'rated', peerCount: 120, grade: 'S', percentile: 99,
  }));
  return {generatedAt: observedAt, improvement: {current: {seasonYear: 2027}}, rosterDatabase: {teams},
    nbaPlayerRatings: {status: 'ok', season: 2027, freshTeams: 30, rows, observedAt, generatedAt: observedAt,
      lastModified: updatedAt, sha256: hash.repeat(64)}};
}

test('blend uses three complete percentiles, preserves ties and drops incomplete rows', () => {
  const data = fixture('2026-11-22T01:00:00Z', 'a');
  data.nbaPlayerRatings.rows[0].war = null;
  data.nbaPlayerRatings.rows[118] = {...data.nbaPlayerRatings.rows[118], impact: 11.9, offense: 11.9, bpm: 11.9};
  const board = buildNbaComposite(data);
  assert.equal(board.count, 119);
  assert.equal(board.eligible, 120);
  assert.deepEqual(board.rows.slice(0, 3).map(row => row.rank), [1, 1, 3]);
  assert.equal(board.rows[0].components.war.percentile, 50);
  assert.ok(Math.abs(board.rows[0].score - (80 * 117.5 / 118 + 10)) < 1e-10);
  assert.equal(movement(board, board.rows[0]), '待比較');
});

test('archive deduplicates identical sources, replaces same-day revision and retains prior day on failure', () => {
  const first = fixture('2026-11-22T01:00:00Z', 'a');
  const initial = buildNbaComposite(first);
  assert.equal(buildNbaComposite(first, initial).history.length, 1);
  const second = buildNbaComposite(fixture('2026-11-22T02:00:00Z', 'b'), initial);
  assert.equal(second.history.length, 1);
  assert.equal(second.history[0].hash, 'b'.repeat(64));
  const thirdInput = fixture('2026-11-22T16:01:00Z', 'c');
  thirdInput.nbaPlayerRatings.rows[119].bpm = -1;
  const third = buildNbaComposite(thirdInput, second);
  assert.deepEqual(third.history.map(point => point.date), ['2026-11-22', '2026-11-23']);
  assert.match(movement(third, third.rows.find(row => row.id === '120')), /^↓ /);
  thirdInput.nbaPlayerRatings.freshTeams = 29;
  const failed = buildNbaComposite(thirdInput, third);
  assert.equal(failed.status, 'stale');
  assert.deepEqual(failed.history, third.history);
});
