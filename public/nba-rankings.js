import {components, compositeCurrent, movement} from './nba-composite-view.js?v=20261122';
import {bar} from './analysis-charts.js?v=20261122charts';
import {playerChineseText} from './player-names.js?v=20261111';
import {teams} from './localization.js';
import {createSnapshotRefresh} from './snapshot-refresh.js';
import {renderNbaShotEfficiency} from './nba-advanced-view.js?v=20261122';
import {createNbaShotEfficiency, NBA_SHOT_MIN_FGA} from './nba-shot-efficiency.js?v=20261122';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
const chinese = row => playerChineseText({name: row.name, id: row.id, league: 'NBA'});
const team = row => teams.NBA[row.team]?.zh ?? row.team;
const day = 86400000;

let board;
let snapshot;
let selected = new URLSearchParams(location.search).get('player');
let range = 30;
let sortMetric = 'composite';
let shotRows = [];

function trend(row) {
  const start = Date.parse(board.date) - (range - 1) * day;
  const points = (board.history ?? []).filter(entry => Date.parse(entry.date) >= start && entry.values[row.id])
    .map(entry => ({date: entry.date, rank: entry.values[row.id][0], score: entry.values[row.id][1]}));
  if (points.length < 2) return '<p class="compact-context-inline">趨勢待更多快照</p>';

  const highest = Math.min(...points.map(point => point.rank));
  const lowest = Math.max(...points.map(point => point.rank));
  const coordinates = points.map(point => ({
    x: 26 + 344 * (Date.parse(point.date) - start) / ((range - 1) * day),
    y: 22 + 100 * (point.rank - highest) / Math.max(1, lowest - highest),
  }));
  let segments = '';
  for (let index = 1; index < points.length; index++) {
    if (Date.parse(points[index].date) - Date.parse(points[index - 1].date) !== day) continue;
    const first = coordinates[index - 1];
    const next = coordinates[index];
    segments += `<polyline points="${first.x},${first.y} ${next.x},${next.y}"/>`;
  }
  const markers = coordinates.map(({x, y}, index) => {
    const point = points[index];
    return `<circle cx="${x}" cy="${y}" r="4"><title>${escape(point.date)} 第 ${point.rank} 名 · ${point.score.toFixed(2)} 分</title></circle>`;
  }).join('');
  return `<figure class="rank-trend"><svg class="trend-plot" viewBox="0 0 396 151" role="img" aria-label="近 ${range} 日排名，名次越前越靠上">
    <rect x="26" y="126" width="344" height="1"/>${segments}${markers}
    <text x="26" y="144">近 ${range} 日</text><text x="370" y="144" text-anchor="end">${escape(board.date.slice(5))}</text>
    </svg></figure>
    <details class="rank-history-table standalone-data-detail"><summary>每日名次與分數</summary><p>名次越前越靠上，沒有快照的日期留空。</p>
    <table><thead><tr><th>日期</th><th>名次</th><th>綜合分</th></tr></thead>
    <tbody>${points.slice().reverse().map(point => `<tr><td>${escape(point.date)}</td><td>${point.rank}</td><td>${point.score.toFixed(2)}</td></tr>`).join('')}</tbody></table></details>`;
}

function drawDetail() {
  const row = board.rows.find(player => player.id === selected);
  if (!row) {
    $('#rank-detail').textContent = '目前沒有可比較的球員資料。';
    return;
  }
  const id = encodeURIComponent(row.id);
  $('#rank-detail').innerHTML = `<div class="rank-player"><img src="https://a.espncdn.com/i/headshots/nba/players/full/${id}.png" alt="">
    <div><h2><a href="./#player/nba/${id}">${escape(chinese(row))}</a></h2><small>${escape(row.name)} · ${escape(team(row))}</small></div></div>
    <div class="rank-compact-summary"><span><strong class="rank-score">${row.score.toFixed(2)}</strong> 分</span><span>第 ${row.rank} 名</span><span>${movement(board, row)}</span><small>${row.games} 場／${Math.round(row.minutes)} 分鐘</small></div>
    <div class="compact-components">${components.map(([key, label]) => {
      const component = row.components[key];
      return bar(label, component.percentile, component.value.toFixed(2));
    }).join('')}</div>
    <div class="rank-trend-toolbar"><h3>趨勢</h3>
    <div class="rank-period">${[7, 30].map(days => `<button data-period="${days}" aria-pressed="${days === range}">近 ${days} 日</button>`).join('')}</div></div>
    ${trend(row)}
    <details class="standalone-data-detail rank-shot-detail"><summary>投籃明細與來源</summary>${renderNbaShotEfficiency(snapshot, row)}</details>`;
  for (const button of document.querySelectorAll('[data-period]')) button.onclick = () => {
    range = Number(button.dataset.period);
    drawDetail();
    $(`[data-period="${range}"]`)?.focus({preventScroll: true});
  };
}

function drawList() {
  const query = $('#find-ranked-player').value.trim().toLowerCase();
  const shots = sortMetric !== 'composite';
  let ordered = board.rows;
  if (shots) {
    ordered = shotRows.filter(row => Number.isFinite(row.shot[sortMetric]))
      .sort((a, b) => b.shot[sortMetric] - a.shot[sortMetric] || a.rank - b.rank);
    let place = 1;
    ordered = ordered.map((row, index, sorted) => {
      if (index > 0 && row.shot[sortMetric] !== sorted[index - 1].shot[sortMetric]) place = index + 1;
      return {...row, listRank: place};
    });
  }
  $('#rank-sort-note').textContent = shots
    ? `${ordered.length} 人 · ≥${NBA_SHOT_MIN_FGA} FGA`
    : '';
  const rows = ordered.filter(row => `${chinese(row)} ${row.name} ${team(row)} ${row.team} #${row.jersey ?? ''}`.toLowerCase().includes(query));
  $('#rank-list').innerHTML = rows.map(row => `<button class="rank-entry" data-ranked-player="${escape(row.id)}" aria-pressed="${row.id === selected}">
    <b>${row.listRank ?? row.rank}</b><span>${escape(chinese(row))}<small>${escape(row.name)} · ${escape(team(row))}</small></span>
    <strong>${shots ? `${row.shot[sortMetric].toFixed(1)}%` : row.score.toFixed(2)}</strong>
    <span class="rank-move">${shots ? `${row.shot.fga} 出手` : movement(board, row)}</span></button>`).join('') ||
    '<p>找不到符合條件的球員。</p>';
  const buttons = [...document.querySelectorAll('[data-ranked-player]')];
  for (const button of buttons) button.onclick = () => {
    selected = button.dataset.rankedPlayer;
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    drawDetail();
    if (matchMedia('(max-width:780px)').matches) {
      $('#rank-detail').focus({preventScroll: true});
      $('#rank-detail').scrollIntoView({block: 'start'});
    }
  };
}

async function fetchSnapshot() {
  const response = await fetch('./data/dashboard.json', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('無法載入資料');
  return response.json();
}

function applyRankings(data) {
  snapshot = data;
  board = data.nbaComposite;
  if (!board?.rows?.length) {
    $('#rank-list').textContent = '';
    $('#rank-detail').textContent = '等待資料更新。';
    return;
  }
  const shotEfficiency = createNbaShotEfficiency(snapshot);
  shotRows = board.rows.flatMap(row => {
    const shot = shotEfficiency(row);
    return shot?.fga >= NBA_SHOT_MIN_FGA ? [{...row, shot}] : [];
  });
  for (const button of document.querySelectorAll('[data-shot-sort]')) button.onclick = () => {
    sortMetric = button.dataset.shotSort;
    for (const option of document.querySelectorAll('[data-shot-sort]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    drawList();
  };
  if (!board.rows.some(row => row.id === selected)) selected = board.rows[0].id;
  $('#find-ranked-player').oninput = drawList;
  drawList();
  drawDetail();
}

function showStatus() {
  if (!board?.rows?.length) {
    $('#rating-status').textContent = board?.reason ?? '綜合榜尚無有效資料。';
    return;
  }
  const status = compositeCurrent(board) ? '' : ' · 歷史快照';
  $('#rating-status').textContent = `${board.date} · ${board.count} 人${status}`;
  $('#rating-status').title = `${board.season - 1}–${String(board.season).slice(-2)} 賽季 · 台灣日期`;
}

const refresh = createSnapshotRefresh({fetchSnapshot, apply: applyRankings, status: showStatus, failed() {
  if (board?.rows?.length) {
    showStatus();
    $('#rating-status').textContent += ' · 暫未取得新資料';
  } else {
    $('#rating-status').textContent = '資料載入失敗，稍後自動重試。';
  }
}});
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
