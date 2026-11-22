import {teamComparison} from './team-compare.js?v=compact-20261122';
import {teamPower} from './team-power.js?v=20261122power';
import {percentile,bar,radar} from './analysis-charts.js?v=20261122charts';
import {playerImpactRows,teamEvidence} from './analysis-core.js';
import {teams} from './localization.js';
import {playerChineseText} from './player-names.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const when=x=>Number.isFinite(Date.parse(x))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'}).format(new Date(x)):'未提供';const value=x=>Number.isFinite(x)?x.toFixed(2):'—';const signed=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}`:'—';const link=(url,label)=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';}catch{return '';}};const club=code=>teams.NBA[code]??{zh:code};let data,view=new URLSearchParams(globalThis.location?.search).get('view')==='teams'?'teams':'players',metric='impact',query='',selected='';const $=s=>document.querySelector(s);
function person(p){return `<div class="person"><img src="https://a.espncdn.com/i/headshots/nba/players/full/${encodeURIComponent(p.id)}.png" alt="" loading="lazy" onerror="this.hidden=true"><div><a href="./#player/nba/${encodeURIComponent(p.id)}"><strong>${esc(playerChineseText({name:p.name,id:p.id,league:'NBA'}))} #${esc(p.jersey??'—')}</strong></a><small>${esc(p.name)}</small></div></div>`;}
function draw(){document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));if(view==='teams'){drawTeams();return;}$('#content').innerHTML=`<div class="controls">${[['impact','總體影響'],['offense','進攻影響'],['defense','防守影響']].map(([k,t])=>`<button data-metric="${k}" aria-pressed="${metric===k}">${t}</button>`).join('')}<input id="player-search" type="search" placeholder="搜尋球員或球隊" aria-label="搜尋球員或球隊" value="${esc(query)}"></div><div id="player-results"></div><details><summary>評分方法、條件與來源</summary><p>使用同季 SportsDataverse adj-RAPM，單位為每百回合估計淨分影響，總體＝進攻＋防守。至少 5 場、60 分鐘，來源須通過既有身分、位置、球隊與時效驗證。字母等級依同位置百分位，不拿字母直接跨位置排序。本頁不混合 EPM 或 LEBRON，也未計算累積貢獻。</p><p>${esc(data.nbaPlayerRatings?.season-1)}–${esc(data.nbaPlayerRatings?.season)} · 取得 ${when(data.nbaPlayerRatings?.observedAt)} · ${link(data.nbaPlayerRatings?.method,'模型方法')} · ${link(data.nbaPlayerRatings?.source,'評分資料')}</p></details>`;document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{metric=b.dataset.metric;draw();});$('#player-search').oninput=e=>{query=e.target.value;renderPlayers();};renderPlayers();}
const impactLabels = {impact:'總體',offense:'進攻',defense:'防守'};
const zhName = p => playerChineseText({name:p.name,id:p.id,league:'NBA'});
function compactPercentile(raw, amount) {
  const track = Number.isFinite(amount)
    ? `<span class="compact-meter" role="img" aria-label="第 ${amount.toFixed(1)} 百分位"><i style="width:${amount.toFixed(2)}%"></i></span>`
    : '';
  return `<div class="compact-number"><strong>${esc(raw)}</strong>${track}</div>`;
}

function renderPlayers() {
  const all = playerImpactRows(data, metric);
  const search = query.trim().toLowerCase();
  const values = Object.fromEntries(Object.keys(impactLabels).map(key => [key, all.map(p => p.rating[key])]));
  let rank = 0;
  const rows = all.map((p, i) => {
    if (!i || p.rating[metric] !== all[i - 1].rating[metric]) rank = i + 1;
    return {player:p, rank};
  }).filter(({player:p}) => `${p.name} ${zhName(p)} ${club(p.team).zh} ${p.team}`.toLowerCase().includes(search));
  const shown = rows.slice(0, 30);
  const body = shown.map(({player:p, rank}) => `<tr>
    <td>${rank}</td>
    <td>${person(p)}</td>
    <td>${compactPercentile(signed(p.rating[metric]),percentile(p.rating[metric],values[metric]))}</td>
    <td><details class="impact-row-notes"><summary aria-label="${esc(zhName(p))} 指標明細">明細</summary>
      <p>${esc(club(p.team).zh)} · ${p.rating.games} 場／${value(p.rating.minutes)} 分鐘</p>
      ${Object.keys(impactLabels).map(key => bar(impactLabels[key],percentile(p.rating[key],values[key]),signed(p.rating[key])+'／100 回合')).join('')}
    </details></td>
  </tr>`).join('');
  $('#player-results').innerHTML = shown.length ? `<div class="compact-context-inline"><span>${all.length} 人樣本</span><span>${shown.length} 筆 · 原名次</span></div>
    <div class="table-scroll impact-table"><table><thead><tr><th>名次</th><th>球員</th><th>${impactLabels[metric]}／100 回合</th><th><span class="standalone-sr-only">明細</span></th></tr></thead><tbody>${body}</tbody></table></div>`
    : '<p>沒有符合條件的有效資料。</p>';
}

function renderTeamRanking(ranking) {
  const range = Math.max(1, ...ranking.map(row => Math.abs(row.score)));
  const period = data.opponentAnalysis?.window;
  const rows = ranking.map(row => {
    const team = club(row.code);
    const width = Math.abs(row.score) / range * 50;
    const left = row.score < 0 ? 50 - width : 50;
    return `<button class="power-row" data-team="${esc(row.code)}" aria-pressed="${selected === row.code}">
      <b>${row.rank}</b><span class="power-name"><img src="${esc(team.logo)}" alt="">${esc(team.zh)}</span>
      <span class="power-record">${row.wins} 勝 ${row.losses} 負</span>
      <span class="power-track" aria-hidden="true"><i style="width:${width}%;left:${left}%"></i></span>
      <strong>${signed(row.score)}</strong></button>`;
  }).join('');
  return `<section class="panel power-panel"><h2 id="team-ranking">NBA 球隊戰力榜</h2>
    ${rows ? `<p>${esc(period?.startDate)} 至 ${esc(period?.endDate)} · ${ranking.length} 隊</p><div class="power-list">${rows}</div>` : "<p>近期完賽資料不足或過期，暫無戰力排名。仍可查個別球隊。</p>"}
    <details><summary>戰力怎麼算</summary><p>中線是 0，向右越強。近 30 日 SRS＝場均淨勝分＋交手對手的平均 SRS。以聯盟平均為 0，單位是每場分差。使用同季例行賽完賽比分，同一對手交手多次就計多次。傷病及主客場未另行調整。</p><p><a href="https://www.basketball-reference.com/about/glossary.html" target="_blank" rel="noopener noreferrer">Basketball Reference 的 SRS 定義</a></p></details></section>`;
}
let comparisonMode = false;
let comparisonCode = '';

function drawTeams() {
  const ranking = teamPower(data);
  const available = data.teamDashboard?.teams ?? [];
  const choices = ranking.length ? ranking.map(row => row.code) : available.map(team => team.team);
  if (!choices.includes(selected)) selected = choices[0];
  if (!ranking.some(row => row.code === comparisonCode) || comparisonCode === selected) comparisonCode = '';
  if (!ranking.length) comparisonMode = false;

  const fallback = ranking.length ? '' : `<div class="clubs">${choices.slice().sort().map(code =>
    `<button data-team="${esc(code)}" aria-pressed="${selected === code}">${esc(club(code).zh)}</button>`
  ).join('')}</div>`;
  $('#content').innerHTML = `<div class="team-workspace">
    <aside class="team-rank-column">${renderTeamRanking(ranking)}${fallback}</aside>
    <div class="team-inspector"><div id="team-controls"></div>
    <section id="team-comparison" tabindex="-1"></section>
    <section id="team-result" tabindex="-1"></section></div></div>`;

  const buttons = [...document.querySelectorAll('[data-team]')];
  function update() {
    for (const button of buttons) {
      const code = button.dataset.team;
      button.setAttribute('aria-pressed', String(code === selected || code === comparisonCode));
      button.classList.toggle('compare-pick', code === comparisonCode);
      button.setAttribute('aria-disabled', String(comparisonMode && code === selected));
    }

    $('#team-controls').innerHTML = ranking.length > 1 ? `<div class="team-actions">
      <div role="status">${comparisonMode
        ? (comparisonCode ? '' : '選擇第二隊')
        : ''}</div>
      <a class="ranking-return" href="#team-ranking">回球隊榜</a><button id="compare-toggle" aria-pressed="${comparisonMode}">${comparisonMode ? '結束比較' : '比較兩隊'}</button>
    </div>` : '';
    const toggle = $('#compare-toggle');
    if (toggle) toggle.onclick = () => {
      comparisonMode = !comparisonMode;
      comparisonCode = '';
      update();
      $('#compare-toggle')?.focus();
    };

    const first = ranking.find(row => row.code === selected);
    const second = ranking.find(row => row.code === comparisonCode);
    $('#team-comparison').innerHTML = first && second ? teamComparison(data, first, second, (code, index) =>
      `<span class="comparison-name"><i class="compare-color-${index}" aria-hidden="true"></i>${esc(club(code).zh)}</span>`
    ) : '';
    renderTeamDetail(ranking);
  }

  for (const button of buttons) button.onclick = () => {
    const code = button.dataset.team;
    if (comparisonMode) {
      if (code === selected) return;
      comparisonCode = code;
    } else {
      selected = code;
    }
    update();
    if (globalThis.matchMedia('(max-width: 850px)').matches) {
      const panel = $(comparisonCode ? '#team-comparison' : '#team-result');
      panel.focus({preventScroll: true});
      panel.scrollIntoView({block: 'start'});
    }
  };
  update();
}

function renderTeamDetail(ranking) {
  const result = teamEvidence(data, selected);
  const node = $('#team-result');
  if (!result) {
    node.textContent = '球隊資料過期或不足。';
    return;
  }
  const {team, metrics, strengths, needs, opponent} = result;
  const power = ranking.find(row => row.code === selected);
  const net = opponent?.games > 0 && Number.isFinite(opponent.pointsFor) && Number.isFinite(opponent.pointsAgainst)
    ? signed((opponent.pointsFor - opponent.pointsAgainst) / opponent.games) : '—';
  const modelNumbers = power ? `<dl class="compact-team-kpis">
    <div><dt>戰力 SRS</dt><dd>${signed(power.score)}</dd></div>
    <div><dt>淨勝分</dt><dd>${signed(power.margin)}</dd></div>
    <div><dt>賽程強度</dt><dd>${signed(power.schedule)}</dd></div>
  </dl>` : '';
  const opponentCharts = opponent ? `
    ${bar('對手平均勝率',Number.isFinite(opponent.opponentWinPct)?100*opponent.opponentWinPct:null,'','rate')}
    ${bar('勝場對手平均勝率',Number.isFinite(opponent.opponentWinPctInWins)?100*opponent.opponentWinPctInWins:null,'','rate')}
    <p>${opponent.games} 場 · ${opponent.wins} 勝 ${opponent.losses} 負 · 原始場均淨勝分 ${net}</p>
    <p>涵蓋 ${opponent.opponentsCovered}／${opponent.games} 場 · ${esc(data.opponentAnalysis.window?.startDate)} 至 ${esc(data.opponentAnalysis.window?.endDate)}。勝率用來描述賽程背景。</p>`
    : '<p>無有效對手分析。</p>';
  const list = (rows, showNeed = false) => rows.map(row => `<li><b>${esc(row.label)} · 第 ${row.rank}／${row.count}</b>${showNeed ? `<br>${esc(row.need)}` : ''}</li>`).join('');
  node.innerHTML = `<section class="panel team-compact-panel">
    <div class="team-compact-heading">
      <h2 class="team-title">${club(selected).logo? `<img src="${esc(club(selected).logo)}" alt="">` : ''}${esc(club(selected).zh)}</h2>
      <span>${esc(team.record ?? '戰績待補')}${power ? ` · 第 ${power.rank}／${ranking.length}` : ''}</span>
    </div>
    ${modelNumbers}
    <div class="team-compact-charts">${radar(metrics)}
      <div class="team-compact-metrics">${metrics.map(m => `<div><span>${esc(m.label)}</span>${compactPercentile(value(m.value)+(m.key.endsWith('Pct')?'%':''),m.percentile)}</div>`).join('')}</div>
    </div>
    <details class="standalone-data-detail"><summary>對手、補強與資料來源</summary>
      <p>${esc(team.season)} 例行賽 · ${team.stats.gamesPlayed} 場 · ${when(team.observedAt)} · ${link(team.source,'球隊統計來源')}</p>
      <h3>對手與賽程</h3>${opponentCharts}
      <h3>目前優勢</h3>${strengths.length ? `<ul>${list(strengths)}</ul>` : '<p>本輪沒有前 25% 指標。</p>'}
      <h3>補強研究</h3>${needs.length ? `<ul>${list(needs,true)}</ul>` : '<p>本輪沒有後 25% 指標。</p>'}
      <p>解讀時一起核對傷兵、角色和輪替。投籃與三分越高越前，失誤越少越前。助攻與失誤未按回合校正。每項至少 20 隊且同球季例行賽至少 4 場，資料須在 24 小時內有效，同值並列。</p>
      <p>百分位＝（比自己差的隊數＋（同值隊數－1）÷ 2）÷（樣本數－1）。目前資料未包含完整防守、陣容厚度、合約與補強人數評估。</p>
    </details>
  </section>`;
}

document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;draw();});
fetch('./data/dashboard.json',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{data=d;$('#status').textContent=`更新 ${when(d.generatedAt)}`;draw();}).catch(()=>{$('#status').textContent='資料載入失敗，請重新整理；也可返回原球員資料庫。';});
