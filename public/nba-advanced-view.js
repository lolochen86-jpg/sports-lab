import {nbaShotEfficiency, NBA_SHOT_MIN_FGA, NBA_SHOT_MIN_PEERS} from './nba-shot-efficiency.js?v=20261122';

const positionName = {G: '後衛', F: '前鋒', C: '中鋒'};
const taipeiTime = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function scoreCard(title, rate, percentile) {
  return `<div class="nba-advanced-score">
    <span>${title}</span>
    <strong>${Number.isFinite(rate) ? `${rate.toFixed(1)}%` : '—'}</strong>
    ${Number.isFinite(percentile) ? `<div class="nba-advanced-track" aria-hidden="true"><span style="width:${percentile.toFixed(2)}%"></span></div>
      <small>同位置第 ${percentile.toFixed(1)} 百分位</small>` : '<small>樣本不足，暫無百分位</small>'}
  </div>`;
}

function sourceLink(url) {
  try {
    const source = new URL(url);
    if (source.protocol === 'https:' && !source.username && !source.password &&
        (source.hostname === 'espn.com' || source.hostname.endsWith('.espn.com'))) {
      return `<a href="${source.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">ESPN 數據來源</a>`;
    }
  } catch {}
  return 'ESPN';
}

function trackingLinks() {
  const tracks = [
    ['籃下防守', '對手命中率與防守出手數', 'https://www.nba.com/stats/players/defense-dash-lt6/'],
    ['傳球追蹤', '潛在助攻、二次助攻', 'https://www.nba.com/stats/players/passing'],
    ['Hustle 數據', '掩護助攻、撥球、卡位', 'https://www.nba.com/stats/players/hustle'],
  ];
  return `<section class="nba-advanced-links"><h4>NBA 官方追蹤</h4><div>
    ${tracks.map(([name, summary, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer"><b>${name} ↗</b><small>${summary}</small></a>`).join('')}
    </div></section>`;
}

export function renderNbaShotEfficiency(data, player) {
  const stats = nbaShotEfficiency(data, player);
  if (!stats) return `<section class="nba-advanced-block"><h3>投籃效率</h3><p>目前沒有同季、同隊且有效的出手資料。</p>${trackingLinks()}</section>`;
  const shotVolume = [
    ['投籃出手 FGA', stats.fga],
    ['三分出手 3PA', stats.threePa],
    ['罰球出手 FTA', stats.fta],
  ];
  return `<section class="nba-advanced-block">
    <h3>投籃效率</h3>
    <div class="nba-advanced-pair">
      ${scoreCard('真實命中率 TS%', stats.tsPct, stats.tsPercentile)}
      ${scoreCard('有效命中率 eFG%', stats.efgPct, stats.efgPercentile)}
    </div>
    <dl class="nba-advanced-volume">
      ${shotVolume.map(([label, attempts]) => `<div><dt>${label}</dt><dd>${Number.isFinite(attempts) ? attempts.toFixed(0) : '—'}${Number.isFinite(attempts) && stats.games > 0 ? ` <small>場均 ${(attempts / stats.games).toFixed(1)}</small>` : ''}</dd></div>`).join('')}
    </dl>
    <p class="nba-advanced-source">${stats.games} 場 · ${sourceLink(stats.source)} · 取得 ${taipeiTime.format(new Date(stats.observedAt))}（台灣時間）</p>
    <details class="nba-advanced-method"><summary>比較樣本與公式</summary>
      <p>${stats.peerCount ? `${positionName[stats.position] ?? '同位置'}比較樣本 ${stats.peerCount} 人。 ` : ''}比較門檻為至少 ${NBA_SHOT_MIN_FGA} 次出手、至少 ${NBA_SHOT_MIN_PEERS} 位同位置球員。</p>
      <p>TS%＝得分 ÷ [2 × (投籃出手＋0.44 × 罰球出手)]。eFG%＝(投籃命中＋0.5 × 三分命中) ÷ 投籃出手。<a href="https://www.nba.com/stats/help/glossary" target="_blank" rel="noopener noreferrer">NBA 數據定義</a></p>
    </details>
    ${trackingLinks()}
  </section>`;
}
