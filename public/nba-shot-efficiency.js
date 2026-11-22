import {percentile} from './analysis-charts.js';
import {fresh} from './analysis-core.js';
import {teams} from './localization.js';

export const NBA_SHOT_MIN_FGA = 100;
export const NBA_SHOT_MIN_PEERS = 10;
const positions = new Set(['G', 'F', 'C']);
const count = value => Number.isInteger(value) && value >= 0 ? value : null;
const teamAliases = {BRK: 'BKN', CHO: 'CHA', WSN: 'WAS'};

function teamIdentity(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return teams.NBA[teamAliases[code] ?? code]?.en;
}

function uniquePlayers(rows) {
  const players = new Map();
  for (const row of rows) {
    const id = String(row?.id ?? '');
    if (/^\d+$/.test(id)) players.set(id, players.has(id) ? null : row);
  }
  return players;
}

function shotNumbers(stats) {
  const games = count(stats?.gamesPlayed);
  if (!games) return null;

  const points = count(stats.points);
  const fga = count(stats.fieldGoalsAttempted);
  const fta = count(stats.freeThrowsAttempted);
  const threePa = count(stats.threePointFieldGoalsAttempted);
  const fgm = count(stats.fieldGoalsMade);
  const threePm = count(stats.threePointFieldGoalsMade);
  const twoConsistent = threePa === null || (fga !== null && threePa <= fga &&
    threePm <= threePa && fgm - threePm <= fga - threePa);
  const effectiveAttempts = fga === null || fta === null ? null : fga + 0.44 * fta;

  return {
    games, fga, fta,
    threePa: fga !== null && threePa > fga ? null : threePa,
    tsPct: points !== null && effectiveAttempts > 0 ? 100 * points / (2 * effectiveAttempts) : null,
    efgPct: fga > 0 && fgm !== null && threePm !== null && threePm <= fgm && fgm <= fga && twoConsistent
      ? 100 * (fgm + 0.5 * threePm) / fga : null,
  };
}

function prepareSource(source, roster) {
  const rows = uniquePlayers(source.players);
  const numbers = new Map();
  const buckets = new Map();
  for (const [id, row] of rows) {
    const result = shotNumbers(row?.stats);
    if (!result) continue;
    const active = roster.get(id);
    const team = teamIdentity(row.team);
    const position = active && team && team === teamIdentity(active.team) && positions.has(active.position)
      ? active.position : null;
    const comparable = position && result.fga >= NBA_SHOT_MIN_FGA &&
      Number.isFinite(result.tsPct) && Number.isFinite(result.efgPct);
    const value = {...result, position, comparable};
    numbers.set(id, value);
    if (comparable) {
      if (!buckets.has(position)) buckets.set(position, {ts: [], efg: []});
      const peers = buckets.get(position);
      peers.ts.push(result.tsPct);
      peers.efg.push(result.efgPct);
    }
  }
  return {source, rows, numbers, buckets};
}

// Build once per render when showing or sorting a list of players from one snapshot.
export function createNbaShotEfficiency(data, now = Date.now()) {
  const current = data?.improvement?.current;
  const leaders = data?.leaderboards?.nba;
  const years = [data?.nbaComposite?.season, current?.seasonYear, leaders?.seasonYear].filter(Number.isInteger);
  const season = Math.max(...years);
  const roster = uniquePlayers((data?.rosterDatabase?.teams ?? []).filter(team => fresh(team, now))
    .flatMap(team => team.players ?? []));
  const candidates = [current, leaders].filter(source => source?.seasonYear === season &&
    source.seasonType === 'Regular Season' && Array.isArray(source.players) && fresh(source, now))
    .map(source => prepareSource(source, roster));

  return player => {
    const id = String(player?.id ?? '');
    const team = teamIdentity(player?.team);
    if (!team || (Number.isInteger(player?.seasonYear) && player.seasonYear !== season)) return null;
    const snapshot = candidates.find(candidate => candidate.rows.has(id));
    const row = snapshot?.rows.get(id);
    const numbers = snapshot?.numbers.get(id);
    if (!row || !numbers || team !== teamIdentity(row.team)) return null;
    const {comparable, ...result} = numbers;
    const peers = snapshot.buckets.get(result.position);
    const rankable = comparable && peers.ts.length >= NBA_SHOT_MIN_PEERS;
    return {
      ...result,
      tsPercentile: rankable ? percentile(result.tsPct, peers.ts) : null,
      efgPercentile: rankable ? percentile(result.efgPct, peers.efg) : null,
      peerCount: peers?.ts.length ?? 0,
      season,
      seasonLabel: snapshot.source.season,
      observedAt: snapshot.source.observedAt,
      source: snapshot.source.source,
      qualifiedOnly: snapshot.source.qualified === true,
    };
  };
}

export function nbaShotEfficiency(data, player, now = Date.now()) {
  return createNbaShotEfficiency(data, now)(player);
}
