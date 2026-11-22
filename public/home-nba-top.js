import {compositeCurrent, movement} from './nba-composite-view.js?v=20261122';
import {playerChineseText} from './player-names.js?v=20261111';
import {teams} from './localization.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
const position = {G: '後衛', F: '前鋒', C: '中鋒'};

export function homeNbaTop(data, now = Date.now()) {
  const board = data.nbaComposite;
  const rows = board?.rows ?? [];
  const season = board?.season;
  const status = compositeCurrent(board, now) ? '' : ' · 歷史快照';

  const cards = rows.slice(0, 10).map(player => {
    const id = encodeURIComponent(player.id);
    const name = playerChineseText({name: player.name, id: player.id, league: 'NBA'});
    const team = teams.NBA[player.team];
    const initials = player.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('');
    const rankChange = movement(board, player);
    const out = data.injuries?.some(report => report.team === player.team && report.player === player.name &&
      report.status === 'OUT' && report.comparison === 'reported_agreement' &&
      report.observations?.some(observation => {
        const time = Date.parse(observation.observedAt);
        return observation.status === 'OUT' && !observation.stale && time <= now && now - time < 86400000;
      }));
    return `<li class="nba-stars-card"><a href="#player/nba/${id}">
      <div class="nba-stars-portrait">
        <span class="nba-stars-rank" aria-label="第 ${player.rank} 名">${player.rank}</span>
        <span class="nba-stars-initials" aria-hidden="true">${escape(initials)}</span>
        <img class="nba-stars-headshot" src="https://a.espncdn.com/i/headshots/nba/players/full/${id}.png" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">
        ${out ? '<span class="nba-stars-out">缺陣通報</span>' : ''}
      </div>
      <div class="nba-stars-info">
        <strong>${escape(name)}${player.jersey != null && player.jersey !== '' ? ` <span>#${escape(player.jersey)}</span>` : ''}</strong>
        <small class="nba-stars-english">${escape(player.name)}</small>
        <div class="nba-stars-team">${team?.logo ? `<img src="${escape(team.logo)}" alt="" loading="lazy">` : ''}${escape(team?.zh ?? player.team)} · ${escape(position[player.position])}</div>
        <div class="nba-stars-impact"><b aria-label="綜合分 ${player.score.toFixed(2)}">${player.score.toFixed(2)}</b>
        ${rankChange === '待比較' ? '' : `<small>${rankChange}</small>`}</div>
      </div></a></li>`;
  }).join('');

  return `<section class="nba-stars" aria-labelledby="nba-stars-title">
    <div class="nba-stars-heading"><div><h2 id="nba-stars-title">本季 NBA 綜合榜前 10</h2>
      <p>${rows.length ? `${season - 1}–${String(season).slice(-2)} · ${escape(board.date)}${status}` : '綜合榜待更新'} </p></div>
      <a href="./nba-rankings.html?v=20261122">完整排名與趨勢 →</a></div>
    ${cards ? `<ol class="nba-stars-grid">${cards}</ol><details class="nba-stars-source"><summary>綜合分怎麼算</summary><p>adj-RAPM 40% · BPM 40% · WAR 20%。名次與上一次有效日期比較。</p></details>` : ''}
    </section>`;
}
