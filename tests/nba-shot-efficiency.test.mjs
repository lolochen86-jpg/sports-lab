import test from 'node:test';
import assert from 'node:assert/strict';
import {createNbaShotEfficiency, nbaShotEfficiency} from '../public/nba-shot-efficiency.js';

const now = Date.parse('2027-01-15T12:00:00Z');
const observedAt = '2027-01-15T11:00:00Z';
const source = 'https://site.web.api.espn.com/';
const stats = {
  gamesPlayed: 10, points: 155, fieldGoalsAttempted: 100, fieldGoalsMade: 55,
  freeThrowsAttempted: 20, threePointFieldGoalsAttempted: 50, threePointFieldGoalsMade: 30,
};

function fixture() {
  const players = Array.from({length: 12}, (_, index) => ({
    id: String(index + 1), team: 'NY', stats: {...stats, points: stats.points - index},
  }));
  const roster = {team: 'NYK', observedAt, players: players.map((p, i) => ({
    id: p.id, team: 'NYK', position: i === 11 ? 'F' : 'G',
  }))};
  const season = {seasonYear: 2027, season: '2026-27', seasonType: 'Regular Season', source, observedAt, players};
  return {improvement: {current: season}, rosterDatabase: {teams: [roster]}};
}

test('calculates TS and eFG from cumulative shots and compares only qualified peers at the same position', () => {
  const data = fixture();
  data.improvement.current.players[10].stats.fieldGoalsAttempted = 99;
  const read = createNbaShotEfficiency(data, now);
  const first = read({id: 1, team: 'NYK'});
  assert.equal(first.tsPct, 100 * 155 / (2 * (100 + 0.44 * 20)));
  assert.equal(first.efgPct, 70);
  assert.equal(first.tsPercentile, 100);
  assert.equal(first.efgPercentile, 50);
  assert.equal(first.peerCount, 10);
  assert.deepEqual([first.fga, first.fta, first.threePa, first.games], [100, 20, 50, 10]);
  const lowVolume = read({id: '11', team: 'NYK'});
  assert.ok(Number.isFinite(lowVolume.tsPct));
  assert.equal(lowVolume.tsPercentile, null);
  const forward = read({id: '12', team: 'NYK'});
  assert.equal(forward.peerCount, 1);
  assert.equal(forward.tsPercentile, null);
});

test('requires exact athlete and team, rejects duplicate IDs and stale or wrong-season sources', () => {
  const data = fixture();
  const query = {id: '1', team: 'NYK'};
  assert.equal(nbaShotEfficiency(data, {...query, team: 'BOS'}, now), null);
  assert.equal(nbaShotEfficiency(data, {...query, seasonYear: 2026}, now), null);
  assert.equal(nbaShotEfficiency(data, query, now + 86400000), null);
  const primary = data.improvement.current;
  data.leaderboards = {nba: {...primary, players: primary.players.slice(), qualified: true}};
  primary.players.push(primary.players[0]);
  assert.equal(nbaShotEfficiency(data, query, now), null);
  primary.players = primary.players.filter(p => p.id !== '1');
  assert.equal(nbaShotEfficiency(data, query, now).qualifiedOnly, true);
  data.leaderboards.nba.seasonYear = 2026;
  assert.equal(nbaShotEfficiency(data, query, now), null);
});

test('keeps true zeroes, missing inputs and percentage values above 100 distinct', () => {
  const data = fixture();
  const query = {id: '1', team: 'NYK'};
  data.improvement.current.players[0].stats = {
    ...stats, fieldGoalsMade: 100, threePointFieldGoalsMade: 100,
    threePointFieldGoalsAttempted: 100, freeThrowsAttempted: 0, points: 300,
  };
  const record = nbaShotEfficiency(data, query, now);
  assert.deepEqual([record.tsPct, record.efgPct, record.fta], [150, 150, 0]);
  data.improvement.current.players[0].stats.freeThrowsAttempted = null;
  assert.equal(nbaShotEfficiency(data, query, now).tsPct, null);
  assert.equal(nbaShotEfficiency(data, query, now).efgPct, 150);
  data.improvement.current.players[0].stats.fieldGoalsAttempted = 0;
  assert.equal(nbaShotEfficiency(data, query, now).efgPct, null);
});
