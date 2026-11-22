import {playerImpactRows} from './analysis-core.js';
import {playerChineseText} from './player-names.js?v=20261111';
import {teams} from './localization.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
const position = {G: '後衛', F: '前鋒', C: '中鋒'};

export function homeNbaTop(data, now = Date.now()) {
  const rows = playerImpactRows(data, 'impact', now);
  const season = data.nbaPlayerRatings?.season;
  const observed = Date.parse(data.nbaPlayerRatings?.observedAt);
  const stamp = Number.isFinite(observed)
    ? new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(observed)
    : '';

  const cards = rows.slice(0, 10).map((player, index) => {
    const id = encodeURIComponent(player.id);
    const name = playerChineseText({name: player.name, id: player.id, league: 'NBA'});
    const team = teams.NBA[player.team];
    const impact = player.rating.impact;
    const initials = player.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('');
    const out = data.injuries?.some(report => report.team === player.team && report.player === player.name &&
      report.status === 'OUT' && report.comparison === 'reported_agreement' &&
      report.observations?.some(observation => {
        const time = Date.parse(observation.observedAt);
        return observation.status === 'OUT' && !observation.stale && time <= now && now - time < 86400000;
      }));
    return `<li class="nba-stars-card"><a href="#player/nba/${id}">
      <div class="nba-stars-portrait">
        <span class="nba-stars-rank" aria-label="第 ${index + 1} 名">${index + 1}</span>
        <span class="nba-stars-initials" aria-hidden="true">${escape(initials)}</span>
        <img class="nba-stars-headshot" src="https://a.espncdn.com/i/headshots/nba/players/full/${id}.png" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">
        ${out ? '<span class="nba-stars-out">缺陣通報</span>' : ''}
      </div>
      <div class="nba-stars-info">
        <strong>${escape(name)}${player.jersey != null && player.jersey !== '' ? ` <span>#${escape(player.jersey)}</span>` : ''}</strong>
        <small class="nba-stars-english">${escape(player.name)}</small>
        <div class="nba-stars-team">${team?.logo ? `<img src="${escape(team.logo)}" alt="" loading="lazy">` : ''}${escape(team?.zh ?? player.team)} · ${escape(position[player.position])}</div>
        <div class="nba-stars-impact"><b>${impact > 0 ? '+' : ''}${impact.toFixed(3)}</b><small>總影響</small></div>
      </div></a></li>`;
  }).join('');

  return `<section class="nba-stars" aria-labelledby="nba-stars-title">
    <div class="nba-stars-heading"><div><h2 id="nba-stars-title">本季 NBA 球員前 10</h2>
      <p>${rows.length ? `${season - 1}–${String(season).slice(-2)} 例行賽 · ${rows.length} 人符合條件 · ${escape(stamp)} 台灣時間` : '本季合格評分資料暫未取得。'}<\/p></div>
      <a href="./analysis.html?v=20261122interactive">完整球員排行 →</a></div>
    ${cards ? `<ol class="nba-stars-grid">${cards}</ol><p class="nba-stars-source">總影響為 adj-RAPM 每百回合估計淨分影響。<a href="https://hoopr.sportsdataverse.org/articles/nba-player-impact-model.html" target="_blank" rel="noopener noreferrer">評分方法</a></p>` : ''}
    </section>`;
}
