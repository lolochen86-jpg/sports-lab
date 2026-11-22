import {playerImpactRows} from '../public/analysis-core.js';
import {taipeiDay} from '../public/today-predictions.js';

export const WEIGHTS = {impact: 0.4, bpm: 0.4, war: 0.2};
export const VERSION = 'composite-v1';
const DAY = 86400000;

function percentiles(rows, key) {
  const ordered = rows.slice().sort((a, b) => a.rating[key] - b.rating[key]);
  const result = new Map();
  for (let first = 0; first < ordered.length;) {
    let end = first + 1;
    while (end < ordered.length && ordered[end].rating[key] === ordered[first].rating[key]) end++;
    const percentile = 100 * (first + (end - first - 1) / 2) / (ordered.length - 1);
    for (let index = first; index < end; index++) result.set(String(ordered[index].id), percentile);
    first = end;
  }
  return result;
}

export function buildNbaComposite(dashboard, previous) {
  const source = dashboard.nbaPlayerRatings;
  const now = Date.parse(dashboard.generatedAt);
  const sourceTime = Date.parse(source?.lastModified);
  const sourceHash = source?.sha256;
  const sameSeason = previous?.version === VERSION && previous.season === source?.season;
  const history = sameSeason ? previous.history ?? [] : [];
  const unavailable = reason => sameSeason && previous.rows?.length
    ? {...previous, status: 'stale', reason}
    : {version: VERSION, season: source?.season, status: 'unavailable', reason, history, rows: []};
  if (!Number.isFinite(now) || !Number.isFinite(sourceTime) || sourceTime > now ||
      now - sourceTime > 3 * DAY || !/^[a-f0-9]{64}$/.test(sourceHash ?? '')) {
    return unavailable('模型資料未取得或已過期');
  }
  if (source.freshTeams !== 30) return unavailable('30 隊名單尚未核對完成');
  const latest = history.at(-1);
  if (latest && sourceTime < Date.parse(latest.sourceUpdatedAt)) return unavailable('來源回傳較舊版本');

  const eligible = playerImpactRows(dashboard, 'impact', now)
    .filter(player => player.rating.games >= 10 && player.rating.minutes >= 200);
  const players = eligible.filter(player => Number.isFinite(player.rating.bpm) && Number.isFinite(player.rating.war));
  if (players.length < 100 || players.length < eligible.length * 0.9) {
    return unavailable('同季三項指標的完整樣本不足');
  }

  const ranks = Object.fromEntries(Object.keys(WEIGHTS).map(key => [key, percentiles(players, key)]));
  const rows = players.map(player => {
    const id = String(player.id);
    const components = Object.fromEntries(Object.keys(WEIGHTS).map(key =>
      [key, {value: player.rating[key], percentile: ranks[key].get(id)}]));
    const score = Object.entries(WEIGHTS).reduce((total, [key, weight]) => total + weight * components[key].percentile, 0);
    return {id, name: player.name, team: player.team, jersey: player.jersey, position: player.position,
      games: player.rating.games, minutes: player.rating.minutes, components, score};
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  for (const [index, row] of rows.entries()) {
    row.rank = index > 0 && Math.abs(row.score - rows[index - 1].score) < 1e-9 ? rows[index - 1].rank : index + 1;
  }

  const date = sourceHash === latest?.hash ? latest.date : taipeiDay(sourceTime);
  const shouldAppend = !latest || (sourceHash !== latest.hash && sourceTime > Date.parse(latest.sourceUpdatedAt));
  const point = {date, sourceUpdatedAt: source.lastModified, hash: sourceHash, count: rows.length,
    values: Object.fromEntries(rows.map(row => [row.id, [row.rank, Number(row.score.toFixed(2))]]))};
  const updated = shouldAppend ? [...history.filter(entry => entry.date !== date), point].slice(-35) : history;
  return {version: VERSION, season: source.season, status: 'available', source: source.source,
    sourceUpdatedAt: source.lastModified, observedAt: source.observedAt, count: rows.length, eligible: eligible.length,
    date, rows, history: updated};
}
