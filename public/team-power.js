import {fresh} from './analysis-core.js';

// SRS = average margin + average opponent rating, centered at zero.
export function teamPower(data, now = Date.now()) {
  const source = data.opponentAnalysis;
  const season = data.improvement?.current?.seasonYear ?? data.leaderboards?.nba?.seasonYear;
  if (source?.status !== 'available' || source.seasonYear !== season || !fresh(source, now)) return [];

  const teams = new Map();
  for (const game of source.games ?? []) {
    for (const [code, opponent, margin] of [
      [game.home, game.away, game.homeScore - game.awayScore],
      [game.away, game.home, game.awayScore - game.homeScore],
    ]) {
      if (!code || !opponent || code === opponent || !Number.isFinite(margin) || margin === 0) return [];
      if (!teams.has(code)) teams.set(code, {code, total: 0, wins: 0, opponents: []});
      const row = teams.get(code);
      row.total += margin;
      row.wins += Number(margin > 0);
      row.opponents.push(opponent);
    }
  }
  const rows = [...teams.values()];
  if (rows.length !== 30 || rows.some(row => row.opponents.length < 4)) return [];
  const connected = new Set([rows[0].code]);
  for (const code of connected) for (const opponent of teams.get(code).opponents) connected.add(opponent);
  if (connected.size !== teams.size) return [];

  let ratings = new Map(rows.map(row => [row.code, 0]));
  const opponentAverage = row => row.opponents.reduce((sum, code) => sum + ratings.get(code), 0) / row.opponents.length;
  const margin = row => row.total / row.opponents.length;
  for (let i = 0; i < 1000; i++) {
    const next = rows.map(row => (ratings.get(row.code) + margin(row) + opponentAverage(row)) / 2);
    const mean = next.reduce((sum, rating) => sum + rating, 0) / rows.length;
    ratings = new Map(rows.map((row, index) => [row.code, next[index] - mean]));
    if (rows.every(row => Math.abs(ratings.get(row.code) - margin(row) - opponentAverage(row)) < 1e-7)) {
      return rows.map(row => ({
        code: row.code,
        wins: row.wins,
        losses: row.opponents.length - row.wins,
        margin: margin(row),
        schedule: opponentAverage(row),
        score: Number(ratings.get(row.code).toFixed(2)),
      })).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
        .map((row, _index, sorted) => ({...row, rank: sorted.findIndex(peer => peer.score === row.score) + 1}));
    }
  }
  return [];
}
