import {homeGameStatus} from './home-dashboard.js?v=compact-all-20261122';
import {renderNbaShotEfficiency} from './nba-advanced-view.js?v=20261122';
import {nbaShotEfficiency} from './nba-shot-efficiency.js?v=20261122';
import {homeNbaTop} from './home-nba-top.js?v=compact-all-20261122';
import {renderPredictionDisplay} from './prediction-provider.js?v=compact-20261122';
import {predictionWalkthrough} from './prediction-walkthrough.js?v=formula-20261110';
import {loadPlayerQuarterScores} from './player-quarter-view.js?v=20261110';
import {quarterPredictionCard} from './quarter-prediction.js?v=20261109';
import { taipeiDay, nextTaipeiMidnight, todayPredictions } from './today-predictions.js?v=20261110';
import {buildRookieRoster,filterRookies,partitionAppearances,rankRookies} from './rookie-filter.js?v=ranked-20261106';
import {parseNbaSupplement} from './nba-supplement.js?v=plusminus-20261106';
import {twoPointStats} from './nba-basic-stats.js';
import {renderNbaRosterCard} from './nba-roster-card.js?v=people-compact-20261122';
import {rankNbaRoster} from './nba-roster-ranking.js?v=compact-20261112';
import {loadNbaGameLog} from './nba-game-log.js?v=20261112';
import {playerChineseText,playerNameCreditHtml} from './player-names.js?v=20261111';
import {nbaRatingBadge,nbaRatingPanel} from './nba-player-rating.js?v=20261111';
import {mlbRatingSummary,mlbRatingDetails} from './mlb-rating.js?v=20261112-compact';
import {teamScores,rosterStatus} from './team-readiness.js';
import {orderConference,gamesBehind} from './playoff-race.js';
import {improvementRanking,declineRanking,improvementSpecs} from './improvement.js?v=decline-20261115';
import {movements,movementReviewDate} from './movements.js';
import {compositeBoard,classifyExperience,dimensions} from './composite.js';
import {createSnapshotRefresh} from './snapshot-refresh.js';
import {teams,players,playerIds,rookieAssets} from './localization.js';
import {renderMlbRoster,renderMlbProfile,rosterPlayer} from './mlb-rosters.js?v=people-compact-20261122';
let predictionTimer;let data;const ui={league:'NBA',date:'',query:'',injuryQuery:'',injuryMode:'all'};
const $=s=>document.querySelector(s),esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={nba:'NBA 官方',espn:'ESPN',cbs:'CBS',fox:'FOX',rotowire:'RotoWire',mlb:'MLB 官方',statshub:'StatsHub',hoopslab:'HoopsLab'};
const statuses={final:'已完賽',live:'進行中',scheduled:'未開賽',postponed:'延期',unknown:'未確認',conflict:'狀態衝突'};
const injuryNames={OUT:'缺陣',SUSPENDED:'停賽',DOUBTFUL:'出賽存疑',QUESTIONABLE:'出賽待定',PROBABLE:'可能出賽',DAY_TO_DAY:'每日觀察',AVAILABLE:'可出賽',CONFLICT:'來源衝突',UNKNOWN:'尚未確認'};
const sourceStatus={live:'即時取得',cached:'使用有效快取',blocked:'來源拒絕',rate_limited:'來源限流',timeout:'請求逾時',cooldown:'暫停重試',failed:'取得失敗'};
const fmt=(v,options={})=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,...options}).format(new Date(v)):'未提供';
const ago=v=>{const n=(Date.now()-Date.parse(v))/60000;return !Number.isFinite(n)?'未知':n<1?'剛剛':n<60?`${Math.floor(n)} 分鐘前`:n<1440?`${Math.floor(n/60)} 小時前`:`${Math.floor(n/1440)} 天前`;};
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const link=(url,label)=>safeUrl(url)?`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:esc(label);
const empty=message=>`<div class="empty"><span>◌</span><h3>${esc(message)}</h3></div>`;
const badge=(label,type='')=>`<span class="badge ${type}">${esc(label)}</span>`;
const percent=v=>typeof v==='number'&&Number.isFinite(v)?`${(v*100).toFixed(1)}%`:'—';
const teamInfo=(code,league='NBA')=>teams[league]?.[code]??{zh:'中文隊名待確認',en:code,logo:null};
const teamText=(code,league='NBA')=>{const t=teamInfo(code,league);return `${t.zh} / ${t.en} (${code})`;};
function teamLogo(code,league='NBA'){const t=teamInfo(code,league);return `<span class="team-icon">${t.logo?`<img src="${esc(t.logo)}" alt="${esc(t.zh)} 隊徽" loading="lazy" onerror="this.hidden=true">`:''}<span>${esc(code)}</span></span>`;}
const shortNbaTeam={ATL:'老鷹',BOS:'塞爾提克',BKN:'籃網',CHA:'黃蜂',CHI:'公牛',CLE:'騎士',DAL:'獨行俠',DEN:'金塊',DET:'活塞',GS:'勇士',GSW:'勇士',HOU:'火箭',IND:'溜馬',LAC:'快艇',LAL:'湖人',MEM:'灰熊',MIA:'熱火',MIL:'公鹿',MIN:'灰狼',NO:'鵜鶘',NOP:'鵜鶘',NY:'尼克',NYK:'尼克',OKC:'雷霆',ORL:'魔術',PHI:'七六人',PHX:'太陽',PHO:'太陽',POR:'拓荒者',SAC:'國王',SA:'馬刺',SAS:'馬刺',TOR:'暴龍',UTA:'爵士',UTAH:'爵士',WSH:'巫師',WAS:'巫師'};
const shortMlbTeam={ARI:'響尾蛇',ATH:'運動家',ATL:'勇士',BAL:'金鶯',BOS:'紅襪',CHC:'小熊',CHW:'白襪',CIN:'紅人',CLE:'守護者',COL:'落磯',DET:'老虎',HOU:'太空人',KC:'皇家',LAA:'天使',LAD:'道奇',MIA:'馬林魚',MIL:'釀酒人',MIN:'雙城',NYM:'大都會',NYY:'洋基',OAK:'運動家',PHI:'費城人',PIT:'海盜',SD:'教士',SDP:'教士',SEA:'水手',SF:'巨人',SFG:'巨人',STL:'紅雀',TB:'光芒',TBR:'光芒',TEX:'遊騎兵',TOR:'藍鳥',WSH:'國民',WSN:'國民'};
const shortTeam=(code,league='NBA')=>(league==='NBA'?shortNbaTeam:shortMlbTeam)[code]||teamInfo(code,league).zh||code;
function playerId(p){const value=p.espnId||p.observations?.find(o=>o.provider==='espn'&&/^\d+$/.test(o.playerId))?.playerId||rookieAssets[p.name||p.player]?.id;return /^\d+$/.test(value||'')?value:null;}
function playerZh(p){return playerChineseText({name:p.name||p.player||'',id:playerId(p),league:'NBA'});}
function rosterMatch(id){if(!id)return null;const rows=(data.rosterDatabase?.teams??[]).flatMap(t=>(t.players??[]).filter(p=>String(p.id)===String(id)).map(p=>({player:p,team:t})));return rows.length===1?rows[0]:null;}
function nbaContext(id,sourceTeam=''){const r=rosterMatch(id),rosterTeam=r?.player?.team,code=sourceTeam||rosterTeam,jersey=r?.player?.jersey??'—';if(!code)return {number:jersey,html:'<small>球隊待確認</small>'};const t=(data.teamDashboard?.teams??[]).find(x=>x.team===code),valid=t&&t.seasonType==='Regular Season'&&t.seasonYear===data.leaderboards?.nba?.seasonYear&&t.record,old=t?.stale||!t?.observedAt||Date.now()-Date.parse(t.observedAt)>24*3600000,rosterOld=r?.team?.stale||!r?.team?.observedAt||Date.now()-Date.parse(r.team.observedAt)>24*3600000,diff=sourceTeam&&rosterTeam&&teamInfo(sourceTeam).zh!==teamInfo(rosterTeam).zh;return {number:jersey,html:`<div class="player-team-info compact-team" title="${esc(teamText(code))}"><span>${teamLogo(code)}</span><div><strong>${esc(shortTeam(code))}</strong>${valid?`<small>本季 ${esc(t.record)}${old?' · 舊資料':''}</small>`:''}${r&&rosterOld?'<small>名單過期</small>':''}${diff?`<small>名單：${esc(shortTeam(rosterTeam))} · 待核對</small>`:''}</div></div>`};}
function playerCard(p,sourceTeam=''){const id=playerId(p),name=p.name||p.player||'',match=rosterMatch(id),url=id?`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`:null,ctx=nbaContext(id,sourceTeam);return `<div class="player-cell"><div class="player-photo">${url?`<a href="#player/nba/${encodeURIComponent(id)}" aria-label="查看 ${esc(name)} 球員資料"><img src="${url}" alt="${esc(name)} 球員頭像" loading="lazy" onerror="this.hidden=true"></a>`:''}<span aria-hidden="true">♙</span></div><div><strong>${esc(playerZh(p))} <span class="jersey-number">#${esc(ctx.number)}</span></strong><small>${esc(name)}</small>${!id?'<small>頭像未提供 / No image</small>':''}${ctx.html}${id&&match?nbaRatingBadge(data.nbaPlayerRatings,id,match.player.team,match.player.position):''}</div></div>`;}
function mlbContext(p){const n=data.mlbPlayerNumbers,number=n?.players?.find(x=>String(x.id)===String(p.id))?.number??'—';const standings=data.leaderboards?.standings,team=standings?.rows?.find(t=>String(t.teamId)===String(p.teamId)),old=standings?.stale||!standings?.observedAt||Date.now()-Date.parse(standings.observedAt)>24*3600000,numberOld=n?.stale||!n?.observedAt||Date.now()-Date.parse(n.observedAt)>24*3600000;return {number,html:`<div class="player-team-info">${p.teamId?`<span class="team-icon"><img src="https://www.mlbstatic.com/team-logos/${encodeURIComponent(p.teamId)}.svg" alt="" loading="lazy" onerror="this.hidden=true"></span>`:''}<div><strong>球季球隊 / Season team：${esc(mlbTeamName(p.team))}</strong><small>${esc(standings?.season??'')} 例行賽戰績 / Record：${team?`${team.wins}–${team.losses}`:'待確認'}${team&&old?' · 舊資料':''}${team?` · ${fmt(standings.observedAt)}`:''}</small><small>背號取得 ${fmt(n?.observedAt)}${numberOld?' · 待確認或舊資料':''}</small></div></div>`};}

function chart(label,values,total){return `<article class="chart-card"><h3>${label}</h3>${values.map(([name,n])=>`<div class="chart-row"><div><span>${name}</span><strong>${n}</strong></div><div class="chart-track"><i style="width:${total?Math.round(100*n/total):0}%"></i></div></div>`).join('')}<small>合計 / Total：${total}</small></article>`;}
function predictionScenario(p){return p.archivedPregame?(p.archivedScenario??(data.injuryScenarios??[]).find(x=>x.gameId===p.gameId&&Date.parse(x.generatedAt)>=Date.parse(p.generatedAt)&&Date.parse(x.generatedAt)<Date.parse(p.startAt))):(data.injuryScenarios??[]).find(x=>x.gameId===p.gameId);}
function injuryScenarioCard(p){const s=predictionScenario(p);if(!s)return `<div class="scenario-box"><h3>傷病情境 / Injury scenario</h3><p>資料尚未建立，等待更新。</p></div>`;if(s.status!=='experimental')return `<div class="scenario-box"><h3>傷病情境 / Injury scenario</h3><p><strong>待確認 / Pending：</strong>${esc(s.reason)}</p>${s.unresolved?.length?`<details><summary>查看 ${s.unresolved.length} 位待確認球員</summary>${s.unresolved.map(x=>`<p>${esc(teamInfo(x.team).zh)} · ${esc(playerZh({name:x.player,espnId:x.espnId}))} / ${esc(x.player)} · ${esc(injuryNames[x.status]??x.status)}${x.detail?'：'+esc(x.detail):''}</p>`).join('')}</details>`:''}</div>`;return `<div class="scenario-box"><h3>傷病情境 / Injury scenario</h3><div class="scenario-numbers"><div><span>客隊勝率 / Away</span><strong>${percent(s.awayWinProbability)}</strong><small>預估得分 / Points ${s.expectedAway}</small></div><div><span>主隊勝率 / Home</span><strong>${percent(s.homeWinProbability)}</strong><small>預估得分 / Points ${s.expectedHome}</small></div></div><p><strong>${s.unresolved?.length?`不完整：${s.unresolved.length} 位球員待確認或缺少紀錄。`: `僅限來源列出的缺陣狀態。`}</strong>納入 ${s.players.length} 位符合條件的缺陣球員；未校準，並非完整陣容預測。</p>${s.unresolved?.length?`<details><summary>查看 ${s.unresolved.length} 位尚未納入的球員</summary>${s.unresolved.map(x=>`<p>${esc(teamInfo(x.team).zh)} · ${esc(playerZh({name:x.player,espnId:x.espnId}))} / ${esc(x.player)} · ${esc(injuryNames[x.status]??x.status)}${x.detail?'：'+esc(x.detail):''}</p>`).join('')}</details>`:''}<details><summary>查看球員、假設及限制</summary><p>${esc(s.assumption)}</p>${s.players.map(x=>`<p>${esc(teamInfo(x.team).zh)} · ${esc(playerZh({name:x.player,espnId:x.espnId}))} / ${esc(x.player)}：${x.games} 場、${x.minutes} 分鐘、${x.points} 分，假設影響 ${x.adjustment} 分。${link(x.source,'球員紀錄')} ${x.injurySources.map(y=>link(y.reference,names[y.provider]??y.provider)).join(' · ')}</p>`).join('')||'<p>來源未列出符合條件的缺陣球員；不代表全員健康。</p>'}${s.limitations.map(x=>`<p>${esc(x)}</p>`).join('')}</details></div>`;}
function predictions(){
 
  const source = data.dropSourceStatus;
  const sourceLabel = ({ok:'正常',partial:'部分可用',no_valid_predictions:'尚無可用預測',not_requested:'目前無需取得'})[source?.status] ?? '等待更新';
  $('#main').innerHTML = `<div class="prediction-toolbar">
    <h1>今明預測</h1>
    <div class="segmented" aria-label="聯盟">
      ${['NBA','MLB'].map(league => `<button data-league="${league}" class="${ui.league === league ? 'active' : ''}" aria-pressed="${ui.league === league}">${league}</button>`).join('')}
    </div>
    <details class="prediction-source-compact">
      <summary>來源與限制 · 未校準</summary>
      <p>研究預測未經獨立校準。開賽後顯示原賽前記錄。</p>
      <p>The Drop Coverage ${esc(sourceLabel)} · 核對 ${Number(source?.available ?? 0)}／${Number(source?.total ?? 0)} 場。來源未將球隊勝率與比分計入公開成績評分，未提供完整公式與逐節預測。MLB 尚無此來源預測。</p>
      ${infoBanner()}
    </details>
  </div><div id="prediction-list"></div>`;
 const renderArchive=p=>`<div class="prediction-values"><div><span>客隊勝率</span><strong>${percent(p.awayWinProbability)}</strong><small>預估得分 ${Number.isFinite(p.expectedAway)?esc(p.expectedAway):'—'}</small></div><div><span>主隊勝率</span><strong>${percent(p.homeWinProbability)}</strong><small>預估得分 ${Number.isFinite(p.expectedHome)?esc(p.expectedHome):'—'}</small></div></div><p class="prediction-note">舊模型 ${esc(p.model??'未提供')} · 產生 ${fmt(p.generatedAt)}</p>${quarterPredictionCard(p,shortTeam(p.away,p.league),shortTeam(p.home,p.league))}${predictionWalkthrough(p,p.archivedScenario??null,{shortTeam,injuryNames,providerNames:names})}`;
 const render=()=>{clearTimeout(predictionTimer);const now=Date.now(),games=allGames(),external=data.externalPredictions??[],saved=data.retainedExternalPredictions??[];const deadlines=[nextTaipeiMidnight(now),...games.map(g=>Date.parse(g.startAt)),...external.flatMap(p=>[Date.parse(p.sourceUpdatedAt)+8*3600000,Date.parse(p.observedAt)+8*3600000]),...(data.eloForecasts??[]).flatMap(p=>[Date.parse(p.generatedAt)+72*3600000,Date.parse(p.observedAt)+72*3600000]),...(data.playerImpactScenarios??[]).map(p=>Date.parse(p.generatedAt)+24*3600000),...(data.nordbergForecasts??[]).flatMap(p=>[Date.parse(p.generatedAt)+72*3600000,Date.parse(p.observedAt)+72*3600000,Date.parse(p.dataObservedAt)+72*3600000])].filter(t=>Number.isFinite(t)&&t>now);if(deadlines.length)predictionTimer=setTimeout(render,Math.min(...deadlines)-now+100);const list=$('#prediction-list');const openGames=new Set([...list.querySelectorAll('.prediction-compact-details[open]')].map(item=>item.dataset.predictionDetails));list.innerHTML=renderPredictionDisplay({games,external,retainedExternal:saved,eloForecasts:data.eloForecasts??[],retainedEloForecasts:data.retainedEloForecasts??[],playerImpactScenarios:data.playerImpactScenarios??[],retainedPlayerImpactScenarios:data.retainedPlayerImpactScenarios??[],nordbergForecasts:data.nordbergForecasts??[],retainedNordbergForecasts:data.retainedNordbergForecasts??[],archived:[...(data.retainedPredictions??[]),...(data.legacyResearchPredictions??[])],league:ui.league,now},{shortTeam,teamLogo,renderArchive,openGames,playerName:(p,league='NBA')=>league==='MLB'?playerChineseText({name:p.name,id:p.id,league}):playerZh({name:p.name,espnId:p.id})});};
 document.querySelectorAll('[data-league]').forEach(b=>b.onclick=()=>{ui.league=b.dataset.league;document.querySelectorAll('[data-league]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render();});render();
}
function compactEvidence(label, html) {
  return `<details class="compact-evidence"><summary>${esc(label)}</summary><div class="compact-evidence-body">${html}</div></details>`;
}
function compactRankPlayer(p, league='NBA', rawTeam=p.team) {
  const id = String(p.id ?? '');
  const name = p.name ?? '';
  const teamTextShort = rawTeam ? (league === 'NBA' ? shortTeam(rawTeam) : mlbTeamName(rawTeam).split(' / ')[0]) : '';
  const validId = /^\d+$/.test(id);
  const jersey = league === 'NBA' ? rosterMatch(id)?.player?.jersey : mlbContext(p).number;
  const portrait = validId ? (league === 'NBA'
    ? `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`
    : `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,h_120,c_fill,g_face/v1/people/${id}/headshot/67/current`) : '';
  const label = `<strong>${esc(playerChineseText({name,id,league}))}${jersey && jersey!=='—' ? ` <span class="jersey-number">#${esc(jersey)}</span>`:''}</strong><small>${esc(name)}${teamTextShort ? ` · ${esc(teamTextShort)}` : ''}</small>`;
  return validId
    ? `<a class="compact-rank-player" href="#player/${league.toLowerCase()}/${id}"><img src="${portrait}" alt="" loading="lazy" onerror="this.hidden=true"><span>${label}</span></a>`
    : `<div class="compact-rank-player"><span>${label}</span></div>`;
}
function opponentAnalysisPanel(code){
  const a=data.opponentAnalysis, row=a?.teams?.find(x=>x.team===code);
  if(!a||a.status!=='available'||!row){
    return compactEvidence('對手比較 · 資料不足',`<p>${esc(a?.reason??'近 30 天尚無可確認的例行賽資料。')}</p>`);
  }
  const old=!a.observedAt||Date.now()-Date.parse(a.observedAt)>24*3600000;
  const records=row.results??[];
  const indicators=[
    ['勝場對手',row.opponentWinPctInWins,row.winsCovered,row.wins],
    ['敗場對手',row.opponentWinPctInLosses,row.lossesCovered,row.losses],
    ['全部對手',row.opponentWinPct,row.opponentsCovered,row.games],
  ];
  return `<section class="content-section compact-opponents"><div class="section-title"><h2>近 30 天對手</h2>
    <span>${row.wins} 勝 ${row.losses} 敗${old?' · 舊資料':''}</span></div>
    <div class="team-stat-grid">${indicators.map(([label,value,covered,total])=>`<article><span>${label}平均勝率</span><strong>${Number.isFinite(value)?percent(value):'—'}</strong><small>${covered??0}/${total} 場</small></article>`).join('')}
    <article><span>場均淨勝分</span><strong>${row.games?((row.pointsFor-row.pointsAgainst)/row.games).toFixed(1):'—'}</strong></article></div>
    ${compactEvidence('逐場與來源',`<p>ESPN ${esc(a.window?.startDate??'')} 至 ${esc(a.window?.endDate??'')} 例行賽 · 更新 ${fmt(a.observedAt)}。對手勝率樣本排除與本隊交手，反映同期賽後資料。</p>
      <div class="table-wrap"><table><thead><tr><th>日期</th><th>對手</th><th>結果</th><th>淨勝分</th><th>對手同期戰績</th></tr></thead><tbody>${records.slice().reverse().map(r=>`<tr><td>${fmt((a.games??[]).find(g=>g.id===r.gameId)?.date)}</td><td>${teamLogo(r.opponent)} ${esc(shortTeam(r.opponent))}</td><td>${r.win?'勝':'敗'}</td><td>${r.margin>0?'+':''}${esc(r.margin)}</td><td>${Number.isFinite(r.opponentWinPct)?`${r.opponentWins} 勝 ${r.opponentLosses} 敗 · ${percent(r.opponentWinPct)}`:'樣本不足'}</td></tr>`).join('')||'<tr><td colspan="5">沒有可用賽事</td></tr>'}</tbody></table></div><p><a href="#sources">資料來源</a></p>`)}</section>`;
}

function dashboard(){
  const db=data.teamDashboard;
  const title=heading('TEAM','球隊數據','',`<a class="rank-back" href="#rankings/MLB/standings/pct">MLB 球隊戰績 →</a>`);
  if(!db){$('#main').innerHTML=title+empty('球隊統計尚未取得');return;}
  const selected=ui.dashboardTeam??'BOS';
  $('#main').innerHTML=title+`<details class="compact-evidence compact-picker"><summary>NBA 球隊 · <span id="active-team-choice">${esc(shortTeam(selected))}</span></summary><div class="team-picker" role="group" aria-label="選擇 NBA 球隊">${db.teams.slice().sort((a,b)=>shortTeam(a.team).localeCompare(shortTeam(b.team),'zh-Hant')).map(x=>`<button type="button" data-team-choice="${esc(x.team)}" class="${x.team===selected?'active':''}" aria-pressed="${x.team===selected}">${teamLogo(x.team)}<span>${esc(shortTeam(x.team))}</span></button>`).join('')}</div></details><div id="team-dashboard" aria-live="polite"></div>`;
  const specs=[
    ['avgPoints','得分',''],['avgRebounds','籃板',''],['avgAssists','助攻',''],
    ['avgSteals','抄截',''],['avgBlocks','阻攻',''],['avgTurnovers','失誤',''],
    ['fieldGoalPct','投籃','%'],['threePointFieldGoalPct','三分','%'],['freeThrowPct','罰球','%'],
  ];
  const fmtStat=(value,suffix)=>Number.isFinite(value)?`${value.toFixed(1)}${suffix}`:'—';
  const render=()=>{
    const code=ui.dashboardTeam??'BOS', t=db.teams.find(x=>x.team===code);
    if(!t?.stats){$('#team-dashboard').innerHTML=empty('此隊數據暫時無法取得');return;}
    const peers=db.teams.filter(x=>!x.stale&&x.seasonYear===t.seasonYear&&x.seasonType===t.seasonType&&x.stats?.gamesPlayed>0);
    const comparisons=specs.slice(0,6).map(([key,label,suffix])=>{
      const values=peers.map(x=>x.stats[key]).filter(Number.isFinite);
      const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
      const value=t.stats[key], ceiling=Math.max(Number.isFinite(value)?value:0,avg??0,1);
      return `<div class="team-compare-row"><div><strong>${label}</strong><span>${fmtStat(value,suffix)} ／ ${fmtStat(avg,suffix)}</span></div>
        <div class="team-bar"><span style="width:${Number.isFinite(value)?Math.max(0,100*value/ceiling):0}%"></span>${avg!==null?`<i style="left:${Math.max(0,Math.min(100,100*avg/ceiling))}%" title="聯盟平均"></i>`:''}</div></div>`;
    }).join('');
    const injuryRows=data.injuries.filter(i=>i.team===code&&i.status!=='UNKNOWN');
    const out=injuryRows.filter(i=>i.status==='OUT').length;
    const uncertain=injuryRows.filter(i=>['CONFLICT','QUESTIONABLE','DOUBTFUL','DAY_TO_DAY','PROBABLE'].includes(i.status)).length;
    const upcoming=data.games.filter(g=>g.league==='NBA'&&[g.home,g.away].includes(code)).slice(0,4);
    const stale=t.stale||!t.observedAt||Date.now()-Date.parse(t.observedAt)>24*3600000;
    const phase=({ 'Regular Season':'例行賽',Preseason:'季前賽',Postseason:'季後賽'})[t.seasonType]??t.seasonType??'階段待確認';
    $('#team-dashboard').innerHTML=`<section class="team-overview"><div class="team-hero">${teamLogo(code)}<div><h2>${esc(shortTeam(code))}</h2><small>${esc(t.season)} · ${esc(phase)}${stale?' · 舊資料':''}</small></div></div><div class="team-record"><span>戰績</span><strong>${esc(t.record??'—')}</strong></div></section>
      <div class="team-stat-grid compact-stat-grid">${specs.map(([key,label,suffix])=>`<article><span>${label}</span><strong>${fmtStat(t.stats[key],suffix)}</strong></article>`).join('')}</div>
      <div class="dashboard-grid"><article class="chart-card"><h3>球隊／聯盟均值</h3>${comparisons}</article>
      <article class="chart-card"><h3>陣容</h3><div class="team-availability"><span>缺陣 <strong>${out}</strong></span><span>待確認 <strong>${uncertain}</strong></span></div>
        <p class="compact-links"><a href="#injuries">傷病</a> <a href="#rosters">名單</a></p><h3>近期賽程</h3>
        ${upcoming.length?upcoming.map(g=>`<a class="team-fixture" href="#game/${encodeURIComponent(g.id)}">${fmt(g.startAt)} · ${esc(shortTeam(g.away))} @ ${esc(shortTeam(g.home))} · ${esc(statuses[g.status]??'待確認')}</a>`).join(''):'<p>快照內無賽程</p>'}</article></div>
      ${compactEvidence('球隊資料與口徑',`<p>ESPN · ${fmt(t.observedAt)} 取得 · ${Number.isFinite(t.stats.gamesPlayed)?t.stats.gamesPlayed:'—'} 場 · ${esc(t.standing??'排名未提供')}。有效 ${db.availableTeams}/30 隊。${link(t.source,'原始資料')}</p><p>均值比較同球季、同階段且本輪有效的 ${peers.length} 隊。豎線為平均，失誤越少通常越好。傷病快照 ${fmt(data.generatedAt)}，出賽仍須以球隊公告為準。MLB 球隊可查看<a href="#rankings/MLB/standings/pct">戰績</a>。</p>${infoBanner()}`)}
      ${opponentAnalysisPanel(code)}`;
  };
  document.querySelectorAll('[data-team-choice]').forEach(button=>button.onclick=()=>{
    ui.dashboardTeam=button.dataset.teamChoice;
    document.querySelectorAll('[data-team-choice]').forEach(x=>{const active=x===button;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});
    const current=$('#active-team-choice');
    current.textContent=shortTeam(ui.dashboardTeam);
    const picker=current.closest('details');
    picker.open=false;
    picker.querySelector('summary')?.focus({preventScroll:true});
    render();
  });
  render();
}

const mlbTeamName=name=>{const normalized=name==='D-backs'?'Arizona Diamondbacks':name;const found=Object.values(teams.MLB??{}).find(t=>t.en===normalized||t.en.endsWith(' '+normalized));return found?`${found.zh} / ${found.en}`:`中文隊名待確認 / ${name??'Unknown'}`;};
function rankings(){
 const groups={nba:['NBA 球員 / NBA Players',data.leaderboards?.nba],hitting:['MLB 打擊 / MLB Hitting',data.leaderboards?.hitting],pitching:['MLB 投球 / MLB Pitching',data.leaderboards?.pitching],team:['NBA 球隊 / NBA Teams',data.teamDashboard],standings:['MLB 球隊戰績 / MLB Teams',data.leaderboards?.standings]};
 const nbaSpecs=[['avgPoints','場均得分 / Points per game'],['avgRebounds','場均籃板 / Rebounds per game'],['avgAssists','場均助攻 / Assists per game'],['avgSteals','場均抄截 / Steals per game'],['avgBlocks','場均阻攻 / Blocks per game'],['avgTurnovers','場均失誤 / Turnovers per game'],['fieldGoalPct','投籃命中率 / Field goal %'],['threePointFieldGoalPct','三分命中率 / Three-point %'],['freeThrowPct','罰球命中率 / Free throw %']];
 const mlbNames={homeRuns:'全壘打 / Home runs',battingAverage:'打擊率 / Batting average',runsBattedIn:'打點 / RBIs',stolenBases:'盜壘 / Stolen bases',earnedRunAverage:'防禦率 / ERA',strikeouts:'三振 / Strikeouts',wins:'勝投 / Wins',saves:'救援成功 / Saves'};
 const parts=location.hash.slice(1).split('/');const league=parts[1],kind=parts[2],key=parts[3];
 const title=heading('LEADERBOARDS','數據排行','');
 const back=(href,label)=>`<a class="rank-back" href="${href}">← ${label}</a>`;
 if(!['NBA','MLB'].includes(league)){$('#main').innerHTML=title+`<div class="compact-tabs"><a href="#rankings/NBA"><strong>NBA</strong></a><a href="#rankings/MLB"><strong>MLB</strong></a></div>`;return;}
 const card=(category,label,group)=>`<a class="rank-category compact-category" href="#rankings/${league}/${group}/${category}"><strong>${esc(label.split(' / ')[0])}</strong></a>`;
 const mlbGroups={hitting:[['homeRuns','全壘打 / Home runs'],['battingAverage','打擊率 / Batting average'],['runsBattedIn','打點 / RBIs'],['stolenBases','盜壘 / Stolen bases']],pitching:[['earnedRunAverage','防禦率 / ERA'],['strikeouts','三振 / Strikeouts'],['wins','勝投 / Wins'],['saves','救援成功 / Saves']]};
 const allowed=league==='NBA'?{nba:nbaSpecs,team:nbaSpecs}: {...mlbGroups,standings:[['pct','勝率 / Win percentage']]};
 if(!kind||!key||!allowed[kind]?.some(x=>x[0]===key)){$('#main').innerHTML=title+back('#rankings','選聯盟')+`<h2 class="rank-section-title">${league} 球員</h2>`+(league==='NBA'?`<div class="rank-grid">${nbaSpecs.map(([k,l])=>card(k,l,'nba')).join('')}</div>`:`<h3 class="rank-subtitle">打擊</h3><div class="rank-grid">${mlbGroups.hitting.map(([k,l])=>card(k,l,'hitting')).join('')}</div><h3 class="rank-subtitle">投球</h3><div class="rank-grid">${mlbGroups.pitching.map(([k,l])=>card(k,l,'pitching')).join('')}</div>`)+`<h3 class="rank-subtitle">球隊</h3><div class="rank-grid">${(league==='NBA'?nbaSpecs:allowed.standings).map(([k,l])=>card(k,l,league==='NBA'?'team':'standings')).join('')}</div>`;return;}
 const group=groups[kind][1];const label=allowed[kind].find(x=>x[0]===key)?.[1]??'排行榜';
 $('#main').innerHTML=title+back('#rankings/'+league,'返回 '+league+' 數據項目')+`<div id="ranking-results" aria-live="polite"></div>`;
 let limit=30;
 const draw=()=>{const out=$('#ranking-results');if(!group||group.stale){out.innerHTML=empty('資料暫時無法取得，等待下次更新 / Data unavailable');return;}let rows=[],season='',source='',observed='';
 if(kind==='team'){const all=group.teams.filter(x=>!x.stale&&x.stats?.gamesPlayed>0&&x.seasonYear&&x.seasonType&&Date.now()-Date.parse(x.observedAt)<24*3600000);const year=Math.max(0,...all.map(x=>x.seasonYear));const counts={};all.filter(x=>x.seasonYear===year).forEach(x=>counts[x.seasonType]=(counts[x.seasonType]||0)+1);const phase=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];const peers=all.filter(x=>x.seasonYear===year&&x.seasonType===phase&&Number.isFinite(x.stats[key]));season=peers[0]?.season+' · '+(phase==='Regular Season'?'例行賽 / Regular Season':phase??'');source=peers[0]?.source;observed=peers.map(x=>x.observedAt).sort()[0];rows=peers.map(x=>({team:x.team,value:x.stats[key],games:x.stats.gamesPlayed,source:x.source,observed:x.observedAt}));}
 if(kind==='nba'){season=group.season+' · 例行賽 / Regular Season';source=group.source;observed=group.observedAt;rows=group.players.filter(p=>Number.isFinite(p.stats[key])).map(p=>({player:p,value:p.stats[key],games:p.stats.gamesPlayed}));}
 if(kind==='standings'){season=group.season+' · 例行賽 / Regular Season';source=group.source;observed=group.observedAt;rows=(group.rows??[]).slice().sort((a,b)=>b.pct-a.pct).map((x,i,a)=>({mlbTeam:x,value:x.pct,rank:i&&x.pct===a[i-1].pct?a.findIndex(y=>y.pct===x.pct)+1:i+1,games:x.games}));}
 if(kind==='hitting'||kind==='pitching'){season=group.season+' · 例行賽 / Regular Season';source=group.source;observed=group.observedAt;rows=(group.categories.find(c=>c.category===key)?.rows??[]).map(x=>({mlb:x,value:x.value,rank:x.rank}));}
 if((kind==='nba'||kind==='hitting'||kind==='pitching'||kind==='standings')&&(!Number.isFinite(Date.parse(observed))||Date.now()-Date.parse(observed)>24*3600000)){out.innerHTML=empty('排行榜資料已超過 24 小時，等待更新 / Stale data');return;}
 if(kind==='team'||kind==='nba'){const low=kind==='team'&&key==='avgTurnovers';rows.sort((a,b)=>low?a.value-b.value:b.value-a.value);rows.forEach((x,i)=>x.rank=i&&Math.round(x.value*10)===Math.round(rows[i-1].value*10)?rows[i-1].rank:i+1);}
 if(!rows.length){out.innerHTML=empty('此項目前沒有可用資料 / No data available');return;}const valueLabel=label.split(' / ')[0], isPct=key.endsWith('Pct');
 const sourceNote=kind==='team'
   ? '同球季、同階段隊伍比較。失誤由少到多，名次按原值排序。'
   : kind==='nba'
     ? 'ESPN 合格球員。依原始數值排序，同顯示小數綁定名次，資格可能不同於官方獎項。'
     : '保留 MLB 官方排名與資格。部分中文姓名採暫定音譯。';
 out.innerHTML=`<div class="compact-section-head"><h2>${esc(valueLabel)}</h2><small>${rows.length} 筆</small></div>
 <div class="table-wrap compact-stat-table"><table><thead><tr><th>名次</th><th>${kind==='team'||kind==='standings'?'球隊':'球員'}</th>
 ${kind==='standings'?'<th>戰績</th>':''}<th>${esc(valueLabel)}</th><th>場</th></tr></thead><tbody>
 ${rows.slice(0,limit).map(x=>{
   const teamRow=(logo,name,full)=>`<div class="ranking-team" title="${esc(full)}">${logo}<strong>${esc(name)}</strong></div>`;
   const player=x.mlbTeam
     ? teamRow(`<img width="30" height="30" src="https://www.mlbstatic.com/team-logos/${encodeURIComponent(x.mlbTeam.teamId)}.svg" alt="" onerror="this.hidden=true">`,mlbTeamName(x.mlbTeam.name).split(' / ')[0],mlbTeamName(x.mlbTeam.name))
     : x.team ? teamRow(teamLogo(x.team),shortTeam(x.team),teamText(x.team))
     : x.player ? compactRankPlayer(x.player) : compactRankPlayer(x.mlb,'MLB');
   const value=typeof x.value==='number'?(kind==='standings'?x.value.toFixed(3):x.value.toFixed(1)+(isPct?'%':'')):esc(x.value);
   return `<tr><td>${esc(x.rank)}</td><td>${player}</td>${x.mlbTeam?`<td>${x.mlbTeam.wins}–${x.mlbTeam.losses}</td>`:''}<td><strong>${value}</strong></td><td>${x.games??'—'}</td></tr>`;
 }).join('')}</tbody></table></div>`+peopleMore('ranking-more',limit,rows.length)+compactEvidence('來源與排序規則',`<p>${esc(season)} · ${fmt(observed)} 取得（台灣時間） · ${link(source,'資料來源')}</p>
 <p>${sourceNote}</p>${kind==='team'?`<ul class="compact-source-list">${rows.map(x=>`<li>${esc(shortTeam(x.team))} · ${fmt(x.observed)} · ${link(x.source,'來源')}</li>`).join('')}</ul>`:''}${infoBanner()}`);
 const more=$('#ranking-more');if(more)more.onclick=()=>{limit+=30;draw();};};draw();
}
function radarChart(player){
 const center=130,r=85,point=(value,i)=>{const a=-Math.PI/2+i*2*Math.PI/5;return [center+Math.cos(a)*r*value/100,center+Math.sin(a)*r*value/100];};const poly=level=>dimensions.map((_,i)=>point(level,i).map(x=>x.toFixed(1)).join(',')).join(' ');
 return `<svg viewBox="0 0 260 260" role="img" aria-label="${esc(player.name)} 五維雷達圖；各軸為同來源合格球員的百分位"><title>五維數據 / Five dimensions</title>${[25,50,75,100].map(n=>`<polygon points="${poly(n)}" fill="none" stroke="#c9dadc"/>`).join('')}${dimensions.map((d,i)=>{const [x,y]=point(100,i),[tx,ty]=point(128,i);return `<line x1="130" y1="130" x2="${x}" y2="${y}" stroke="#c9dadc"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#214454">${esc(d[1].split(' / ')[0])}</text>`;}).join('')}<polygon points="${player.radar.map((v,i)=>point(v,i).map(x=>x.toFixed(1)).join(',')).join(' ')}" fill="#149b8a66" stroke="#087e75" stroke-width="3"/></svg>`;
}
function composite(){
 const source=data.leaderboards?.nba,part=location.hash.slice(1).split('/'),view=part[1]||'all',id=part[2];const prefix=heading('NBA PLAYER HUB','NBA 球員綜合平台','');
 const card=(v,zh)=>`<a href="#composite/${v}" ${v===view?'aria-current="page"':''}>${zh}</a>`;
 const menu=`<nav class="compact-tabs" aria-label="球員分類">${card('all','前 30 名')}${card('recent','近期')}${card('popular','人氣')}${card('rookie','一年級')}${card('sophomore','二年級')}</nav>`;
 if(!source||source.stale||Date.now()-Date.parse(source.observedAt)>24*3600000){$('#main').innerHTML=prefix+menu+empty('NBA 球員統計資料暫時不可用或已過期');return;}
 const all=compositeBoard(classifyExperience(source.players,data.rosterDatabase));const form=data.recentForm;
 const names={all:'綜合前 30 名 / Overall Top 30',recent:'近期表現熱度 / Recent Form',popular:'網路人氣熱度 / Popularity',rookie:'一年級新人 / Rookies',sophomore:'二年級球員 / Sophomores'};
 if(view==='player'){const p=all.find(x=>x.id===id);if(!p){$('#main').innerHTML=prefix+menu+empty('找不到符合條件的球員');return;}$('#main').innerHTML=prefix+`<a class="rank-back" href="#composite/all">← 返回綜合榜</a><section class="radar-panel">${compactRankPlayer(p)}<div class="radar-layout">${radarChart(p)}<div><h2>五維數據</h2><p>綜合 ${p.score.toFixed(1)} 分 · 出賽 ${p.stats.gamesPlayed} 場</p>${dimensions.map(([key,label],i)=>`<p><strong>${esc(label)}</strong>：${p.stats[key].toFixed(1)} · 同樣本百分位 ${p.radar[i].toFixed(0)}</p>`).join('')}</div></div>${compactEvidence('雷達資料來源',`<p>五項百分位採同一合格樣本。ESPN 本季 ${esc(source.season)} · ${fmt(source.observedAt)} 取得。</p>${link(source.source,'數據來源')}`)}</section>`;return;}
 let rows=all,info='五項百分位等權平均，得分／籃板／助攻／抄截／阻攻各 20%；至少出賽 3 場，不是官方排名。';
 if(view==='rookie'||view==='sophomore'){rows=all.filter(p=>p.yearClass===view);info='依 ESPN 名單年資對照，第一年 experience 0、第二年 experience 2；僅納入來源合格且至少出賽 3 場者，未對上的球員不列入。';}
 if(view==='popular'){const pop=data.popularity;const usablePop=pop?.observedAt&&Date.now()-Date.parse(pop.observedAt)<24*3600000;const m=new Map((usablePop?pop?.rows??[]:[]).map(x=>[x.id,x]));rows=all.filter(p=>m.has(p.id)).map(p=>({...p,pop:m.get(p.id)})).sort((a,b)=>b.pop.views-a.pop.views);info=`英文維基百科球員條目 ${pop?.start??'—'} 至 ${pop?.end??'—'} 七日瀏覽量，以 Wikidata ESPN ID 核對身分；僅比較綜合前 30 及合格一、二年級球員。未包含中文維基、搜尋或社群人氣。樣本 ${pop?.rows?.length??0}/${pop?.requested??0} 人；${pop?.missing?.length??0} 人未核對或資料不足。樣本不完整時不是全聯盟完整人氣榜。日期以 UTC 計。`;}
 if(view==='recent'){const usableForm=form?.observedAt&&Date.now()-Date.parse(form.observedAt)<24*3600000;const m=new Map((usableForm?form?.rows??[]:[]).map(x=>[x.id,x]));rows=all.filter(p=>m.has(p.id)).map(p=>({...p,form:m.get(p.id)})).sort((a,b)=>b.form.score-a.form.score);info=`僅比較綜合前 30 和符合條件的一、二年級球員；最近最多 5 場、至少 3 場已核對完賽。加權分＝得分＋1.2×籃板＋1.5×助攻＋2×抄截＋2×阻攻－失誤；這是場上表現，並非人氣。${form?.missing?.length?` ${form.missing.length} 人資料不足未列入。`:''}`;}
 rows=rows.slice(0,30);
 const metric=view==='recent'?'近期分':view==='popular'?'七日瀏覽':'綜合分';
 $('#main').innerHTML=prefix+menu+`<div class="compact-section-head"><h2>${esc((names[view]??names.all).split(' / ')[0])}</h2><small>${rows.length} 人</small></div>`+
  (rows.length?`<div class="table-wrap compact-stat-table"><table><thead><tr><th>名次</th><th>球員</th><th>${metric}</th><th>場</th><th>五維</th></tr></thead><tbody>
  ${rows.map((p,i)=>`<tr><td>${i+1}</td><td>${compactRankPlayer(p)}</td><td><strong>${view==='popular'?p.pop.views.toLocaleString():(p.form?.score??p.score).toFixed(1)}</strong></td>
  <td>${view==='recent'?p.form.games:p.stats.gamesPlayed}</td><td><a href="#composite/player/${encodeURIComponent(p.id)}">五維</a>
  ${p.pop?compactEvidence('來源',`<p>${link(p.pop.article,'球員文章')} · ${link(p.pop.source,'瀏覽量原始資料')}<br>取得 ${fmt(p.pop.observedAt)}（台灣時間）</p>`)
  :p.form?compactEvidence('來源',`<p>${link(p.form.source,'比賽紀錄')}<br>取得 ${fmt(p.form.observedAt)}（台灣時間）</p>`):''}</td></tr>`).join('')}</tbody></table></div>`
  :empty(view==='recent'?form?.reason??'近期紀錄不足或尚未取得':'目前沒有可核對的球員資料'))+compositeAttribution(view,source,info);
}

function compositeAttribution(view,source,description=''){
 const teams=data.rosterDatabase?.teams??[];
 const pop=data.popularity;
 return `<details class="compact-evidence"><summary>資料來源與方法</summary>${description?`<p>${esc(description)}</p>`:''}<p>球季數據：${link(source.source,'ESPN 球員數據')}，${esc(source.season)} 例行賽，取得 ${fmt(source.observedAt)}（台灣時間）。綜合分與雷達由本站依合格樣本計算，並非 ESPN 官方排名。</p><p>球員年資：ESPN 球隊名單；下列為各隊實際來源與取得時間。缺少或未對上的球員不會列入年級榜。</p><div class="report-links">${teams.map(t=>`${link(t.source,teamText(t.team??t.abbreviation??t.name??'球隊名單'))} <small>${t.observedAt?fmt(t.observedAt):'未取得'}${t.stale?' · 過期或不可用':''}</small>`).join(' · ')||'目前沒有可用名單來源'}</div>${view==='popular'?`<p>網路人氣：${link('https://www.wikidata.org/wiki/Property:P3685','Wikidata ESPN 球員 ID 對照')}，以及每位球員英文維基百科的 Wikimedia 七日瀏覽量。每列提供文章與實際 API 來源；${esc(pop?.start??'—')} 至 ${esc(pop?.end??'—')}（UTC）。觀測到 ${pop?.rows?.length??0}/${pop?.requested??0} 人，不代表全聯盟或其他平台人氣。</p>`:''}${view==='recent'?'<p>近期表現：各列連結 ESPN 球員比賽紀錄，並以 ESPN 賽程結果核對已結束比賽；分數由本站計算。</p>':''}<p><a href="#sources">查看其他來源狀態與球卡行情參考 →</a></p></details>`;
}
const nbaProfileStats=[['gamesPlayed','出賽場數 / Games'],['avgMinutes','場均時間 / Minutes'],['avgPoints','場均得分 / Points'],['avgRebounds','場均籃板 / Rebounds'],['avgAssists','場均助攻 / Assists'],['avgSteals','場均抄截 / Steals'],['avgBlocks','場均阻攻 / Blocks'],['avgTurnovers','場均失誤 / Turnovers'],['fieldGoalPct','投籃命中率 / FG%'],['threePointFieldGoalPct','三分命中率 / 3P%'],['freeThrowPct','罰球命中率 / FT%'],['points','總得分 / Total points'],['rebounds','總籃板 / Total rebounds'],['assists','總助攻 / Total assists'],['steals','總抄截 / Total steals'],['blocks','總阻攻 / Total blocks'],['doubleDouble','雙十 / Double-doubles'],['tripleDouble','大三元 / Triple-doubles']];
const mlbHittingStats=[['gamesPlayed','出賽 / Games'],['plateAppearances','打席 / Plate appearances'],['atBats','打數 / At bats'],['runs','得分 / Runs'],['hits','安打 / Hits'],['doubles','二壘安打 / Doubles'],['triples','三壘安打 / Triples'],['homeRuns','全壘打 / Home runs'],['rbi','打點 / RBI'],['stolenBases','盜壘 / Stolen bases'],['baseOnBalls','保送 / Walks'],['strikeOuts','三振 / Strikeouts'],['avg','打擊率 / AVG'],['obp','上壘率 / OBP'],['slg','長打率 / SLG'],['ops','攻擊指數 / OPS']];
const mlbPitchingStats=[['gamesPlayed','出賽 / Games'],['gamesStarted','先發 / Starts'],['wins','勝投 / Wins'],['losses','敗投 / Losses'],['saves','救援成功 / Saves'],['inningsPitched','投球局數 / Innings'],['strikeOuts','三振 / Strikeouts'],['baseOnBalls','保送 / Walks'],['hits','被安打 / Hits'],['homeRuns','被全壘打 / Home runs'],['era','防禦率 / ERA'],['whip','每局上壘率 / WHIP']];

function peopleDetails(label, content, className='') {
  return `<details class="people-disclosure ${className}"><summary>${esc(label)}</summary><div class="people-disclosure-body">${content}</div></details>`;
}
function peopleMore(id, showing, total) {
  return showing<total?`<button type="button" class="subtle people-show-more" id="${id}">顯示更多 · ${showing}/${total}</button>`:'';
}
function peopleNumbers(items) {
  return `<dl class="people-numbers">${items.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value??'—')}</dd></div>`).join('')}</dl>`;
}
function peopleIdentity(row, sourceTeam='') {
  const id=playerId(row), name=row.name||row.player||'', team=sourceTeam||row.team;
  const jersey=rosterMatch(id)?.player.jersey??row.jersey;
  const standings=(data.teamDashboard?.teams??[]).find(t=>t.team===team&&t.seasonType==='Regular Season'&&t.seasonYear===data.leaderboards?.nba?.seasonYear);
  const staleRecord=standings?.stale||!standings?.observedAt||Date.now()-Date.parse(standings.observedAt)>86400000;
  const record=standings?.record?`<span class="people-record" title="${staleRecord?'本季歷史戰績':'本季戰績'}">${esc(standings.record)}${staleRecord?' · 舊':''}</span>`:'';
  const shownName=`<strong>${esc(playerZh(row))}${jersey!=null?` <span class="jersey-number">#${esc(jersey)}</span>`:''}</strong><small>${esc(name)}</small>`;
  const photo=id?`<img src="https://a.espncdn.com/i/headshots/nba/players/full/${encodeURIComponent(id)}.png" alt="" loading="lazy" onerror="this.hidden=true">`:'';
  return `<div class="people-identity">${id?`<a href="#player/nba/${encodeURIComponent(id)}">${photo}<span>${shownName}</span></a>`:`<span>${shownName}</span>`}${team?`<span class="people-team" title="${esc(teamText(team))}">${teamLogo(team)} ${esc(shortTeam(team))} ${record}</span>`:''}</div>`;
}
function profileTiles(stats,spec){return `<div class="team-stat-grid profile-stats">${spec.map(([key,label])=>{const value=stats?.[key];return `<article><span>${esc(label)}</span><strong>${value===null||value===undefined?'—':esc(typeof value==='number'&&!Number.isInteger(value)?value.toFixed(1):value)}${key.endsWith('Pct')&&value!==null&&value!==undefined?'%':''}</strong></article>`;}).join('')}</div>`;}
function nbaStatsPanel(s){
 const two=twoPointStats(s),value=(v,digits=1)=>Number.isFinite(v)?v.toFixed(digits):'—',pct=(attempts,v)=>Number.isFinite(attempts)&&attempts>0&&Number.isFinite(v)?`${v.toFixed(1)}%`:'—';
 const groups=[['出賽與場均 / Per game',[['出賽 / GP',s.gamesPlayed],['先發 / GS',s.gamesStarted],['時間 / MIN',s.avgMinutes],['得分 / PTS',s.avgPoints],['籃板 / REB',s.avgRebounds],['進攻籃板 / OREB',s.avgOffensiveRebounds],['防守籃板 / DREB',s.avgDefensiveRebounds],['助攻 / AST',s.avgAssists],['抄截 / STL',s.avgSteals],['阻攻 / BLK',s.avgBlocks],['失誤 / TOV',s.avgTurnovers],['犯規 / PF',s.avgFouls]]],['球季累計 / Season totals',[['正負值 / +/−',s.plusMinus],['得分 / PTS',s.points],['籃板 / REB',s.rebounds],['助攻 / AST',s.assists],['抄截 / STL',s.steals],['阻攻 / BLK',s.blocks],['失誤 / TOV',s.turnovers],['雙十 / DD',s.doubleDouble],['大三元 / TD',s.tripleDouble]]]];
 const shot=[['投籃 / FG',s.fieldGoalsMade,s.fieldGoalsAttempted,pct(s.fieldGoalsAttempted,s.fieldGoalPct)],['兩分 / 2PT',two.made,two.attempts,two.pct===null?'—':`${two.pct.toFixed(1)}%`],['三分 / 3PT',s.threePointFieldGoalsMade,s.threePointFieldGoalsAttempted,pct(s.threePointFieldGoalsAttempted,s.threePointFieldGoalPct)],['罰球 / FT',s.freeThrowsMade,s.freeThrowsAttempted,pct(s.freeThrowsAttempted,s.freeThrowPct)]];
 return `${groups.map(([title,stats])=>`<h3 class="stats-group-title">${esc(title)}</h3><div class="basic-stat-grid">${stats.map(([label,v])=>`<div><span>${esc(label)}</span><strong>${v===null||v===undefined?'—':esc(label==='正負值 / +/−'&&Number.isFinite(v)&&v>0?`+${v}`:Number.isInteger(v)?v:value(v))}</strong></div>`).join('')}</div>`).join('')}<h3 class="stats-group-title">投籃表現 / Shooting</h3><div class="shooting-grid">${shot.map(([label,made,attempted,percentage])=>`<article><span>${esc(label)}</span><strong>${esc(percentage)}</strong><small>命中 / 出手 ${Number.isFinite(made)?made:'—'} / ${Number.isFinite(attempted)?attempted:'—'}</small></article>`).join('')}</div><p class="fine-print">兩分命中數＝總投籃命中－三分命中；兩分出手數＝總出手－三分出手。沒有出手或來源未提供時顯示「—」。正負值是球員在場期間球隊得分減失分的累計，受隊友、對手與輪替影響。</p>`;
}
function loadNbaExtras(id,season,stats){
 const url=`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${season}/types/2/athletes/${id}/statistics`;
 fetch(url,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('來源無法讀取');return r.json();}).then(d=>{if(location.hash!==`#player/nba/${id}`)return;const panel=document.getElementById('nba-basic-panel'),out=document.getElementById('nba-extra-status');if(!panel||!out)return;const extra=parseNbaSupplement(d,id,season,stats.gamesPlayed);panel.innerHTML=nbaStatsPanel({...stats,...extra});out.innerHTML=`<p class="fine-print">先發、進攻／防守籃板與正負值補充來源：${link(url,'ESPN 球員統計')} · 讀取 ${fmt(new Date().toISOString())}（台灣時間）；已核對球員、球季及 ${stats.gamesPlayed} 場出賽。</p>`;}).catch(()=>{const out=document.getElementById('nba-extra-status');if(out&&location.hash===`#player/nba/${id}`)out.innerHTML=`<p class="fine-print">先發、進攻／防守籃板與正負值來源無法讀取或出賽場次不一致，暫不合併。${link(url,'檢查補充來源')}</p>`;});
}
function playerProfile(league,id){
 if(!/^\d+$/.test(id??'')||!['nba','mlb'].includes(league)){ $('#main').innerHTML=empty('找不到球員');return; }
 if(league==='mlb'&&rosterPlayer(data.mlbRosterDatabase,id)){void renderMlbProfile(data.mlbRosterDatabase,id,mlbRosterContext());return;}
 if(league==='nba'){
  const roster=(data.rosterDatabase?.teams??[]).flatMap(t=>(t.players??[]).filter(p=>p.id===id).map(p=>({...p,rosterSource:t})));const entry=roster.length===1?roster[0]:null;const fresh=(data.improvement?.currentStatus==='available'||data.improvement?.status==='available')&&data.improvement.current&&!data.improvement.current.stale&&(!data.leaderboards?.nba?.seasonYear||data.improvement.current.seasonYear===data.leaderboards.nba.seasonYear)&&Date.now()-Date.parse(data.improvement.current.observedAt)<86400000?data.improvement.current:null;const qualified=data.leaderboards?.nba;const source=fresh?.players?.some(x=>x.id===id)?fresh:qualified;const p=source?.players?.find(x=>x.id===id);const injury=(data.injuries??[]).find(i=>playerId(i)===id&&(!entry||i.team===entry.team));
  if(!entry&&!p){$('#main').innerHTML=heading('PLAYER PROFILE','球員資料 / Player profile','此球員尚未對上名單或球季資料。')+empty('目前沒有可核對的資料');return;}
  const person=entry??p,radar=compositeBoard(qualified?.players).find(x=>x.id===id),title=playerZh({name:person.name,espnId:id});
  const stats=p?.stats??{},efficiency=nbaShotEfficiency(data,person);
  const number=(v,suffix='')=>Number.isFinite(v)?v.toFixed(1)+suffix:'—';
  const isOld=source?.stale||Date.now()-Date.parse(source?.observedAt)>86400000;
  const teamMismatch=p?.team&&entry?.team&&shortTeam(p.team)!==shortTeam(entry.team);
  const overview=peopleNumbers([['得分',number(stats.avgPoints)],['籃板',number(stats.avgRebounds)],['助攻',number(stats.avgAssists)],['TS%',number(efficiency?.tsPct,'%')],['eFG%',number(efficiency?.efgPct,'%')],['場次',stats.gamesPlayed]]);
  $('#main').innerHTML=`<a class="rank-back" href="#rosters">← 返回球員資料庫</a>`+`<section class="profile-hero"><img src="https://a.espncdn.com/i/headshots/nba/players/full/${id}.png" alt="${esc(person.name)}" onerror="this.hidden=true"><div><h1>${esc(title)} <span class="jersey-number">#${esc(nbaContext(id).number)}</span></h1><p class="profile-name-en">${esc(person.name)}</p>${nbaContext(id).html}<p class="profile-basics">${[({G:'後衛',F:'前鋒',C:'中鋒'})[entry?.position]??entry?.positionEn,entry?.height,entry?.weight,entry?.age==null?null:`${entry.age} 歲`].filter(Boolean).map(esc).join(' · ')}</p><p class="profile-availability">傷病 ${injury?esc(injuryNames[injury.status]??'待確認'):'未確認'}</p>${nbaRatingBadge(data.nbaPlayerRatings,id,entry?.team,entry?.position)}</div></section><section class="people-profile-overview"><h2>球季重點</h2>${isOld||teamMismatch?`<p class="people-warning">${[isOld?'資料已過期':null,teamMismatch?'統計與名單球隊異動待核對':null].filter(Boolean).join(' · ')}</p>`:''}${overview}</section>${peopleDetails('球員評分',nbaRatingPanel(data.nbaPlayerRatings,id,entry?.team,entry?.position))}${peopleDetails('投籃效率與來源',renderNbaShotEfficiency(data,person))}<details class="people-disclosure"><summary>完整球季數據</summary><div class="people-disclosure-body">${p?`<p>ESPN ${esc(source.season)} 例行賽 · 取得 ${fmt(source.observedAt)}（台灣時間）${source.stale||Date.now()-Date.parse(source.observedAt)>86400000?' · 資料已過期':''} · ${link(source.source,'球季數據來源')}${p.team?` · 統計所列球隊 ${esc(p.team)}${entry?.team&&shortTeam(entry.team)!==shortTeam(p.team)?`；名單所列 ${esc(shortTeam(entry.team))}，球隊異動待核對`:''}`:''}</p><div id="nba-basic-panel">${nbaStatsPanel(p.stats)}</div><div id="nba-extra-status"><small>正在核對先發、籃板與正負值…</small></div>`:empty('此球員尚無可核對的本季數據')}</div></details><details class="people-disclosure"><summary>逐場比賽</summary><section id="nba-game-log" class="people-disclosure-body" aria-live="polite"><p>正在取得球季比賽資料…</p></section></details><details class="people-disclosure"><summary>每節得分</summary><div id="player-quarter-results" class="people-disclosure-body" role="status">正在核對逐球紀錄與全場得分…</div></details>${radar?`<details class="people-disclosure"><summary>五維雷達</summary><div class="radar-layout people-disclosure-body">${radarChart(radar)}<p>五項數據以同樣本百分位呈現，並非能力值或預測。<br>綜合分 ${radar.score.toFixed(1)}</p></div></details>`:''}<details class="people-disclosure"><summary>球員資料來源</summary><div class="people-disclosure-body"><p>${entry?`${link(entry.rosterSource.source,'球隊名單來源')} · 取得 ${fmt(entry.rosterSource.observedAt)}${entry.rosterSource.stale?' · 過期':''} · `:''}${link(`https://www.espn.com/nba/player/_/id/${id}`,'ESPN 球員頁面')}</p></div></details>`;
  if(p&&Number.isInteger(source?.seasonYear))loadNbaExtras(id,source.seasonYear,p.stats);
  const gameLogSeason=source?.seasonYear??data.improvement?.current?.seasonYear??data.leaderboards?.nba?.seasonYear;
  loadNbaGameLog(id,gameLogSeason,document.getElementById("nba-game-log"),{shortTeam});
  loadPlayerQuarterScores(id,source?.seasonYear??data.improvement?.current?.seasonYear??data.leaderboards?.nba?.seasonYear,{formatDate:fmt,shortTeam});
  return;
 }
 const groups=['hitting','pitching'].flatMap(k=>(data.leaderboards?.[k]?.categories??[]).flatMap(c=>c.rows.filter(r=>String(r.id)===id).map(r=>({...r,category:c.category}))));const p=groups[0];if(!p){$('#main').innerHTML=empty('目前沒有可核對的 MLB 球員資料');return;}const season=data.leaderboards?.hitting?.season??data.leaderboards?.pitching?.season;
 $('#main').innerHTML=`<a class="rank-back" href="#rankings/MLB">← 返回 MLB 排行榜</a>`+`<section class="profile-hero"><img src="https://img.mlbstatic.com/mlb-photos/image/upload/w_240,h_240,c_fill,g_face/v1/people/${id}/headshot/67/current" alt="${esc(p.name)}" onerror="this.hidden=true"><div><h1>${esc(playerChineseText({name:p.name,id:p.id,league:'MLB'}))} <span class="jersey-number">#${esc(mlbContext(p).number)}</span></h1><p class="profile-name-en">${esc(p.name)}</p>${mlbContext(p).html}<p>${link(`https://www.mlb.com/player/${id}`,'MLB 官方球員頁面')}</p></div></section>${peopleDetails('球員評分',mlbRatingDetails(data.mlbPerformance,id))}<details class="people-disclosure"><summary>${esc(season??'')} 球季數據</summary><div class="people-disclosure-body" id="mlb-player-stats" role="status">正在讀取 MLB 官方資料…</div></details>`;
 if(!/^\d{4}$/.test(String(season??''))){$('#mlb-player-stats').innerHTML=empty('尚無可核對的球季');return;}
 const url=`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&group=hitting,pitching&season=${season}`;fetch(url,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('MLB 資料不可用');return r.json();}).then(d=>{const el=document.getElementById('mlb-player-stats');if(!el||location.hash!==`#player/mlb/${id}`)return;const stats=(d.stats??[]).flatMap(g=>(g.splits??[]).filter(x=>String(x.season)===String(season)&&x.stat).map(x=>({group:g.group?.displayName,team:x.team?.name,stat:x.stat})));el.innerHTML=stats.length?`<p>MLB 官方資料 · 讀取時間 ${fmt(new Date().toISOString())}（台灣時間） · ${link(url,'原始資料')}</p>`+stats.map(x=>`<h3>${x.group==='hitting'?'打擊 / Hitting':'投球 / Pitching'}${x.team?' · '+esc(mlbTeamName(x.team)):''}</h3>${profileTiles(x.stat,x.group==='hitting'?mlbHittingStats:mlbPitchingStats)}`).join(''):empty('官方來源目前沒有此球季數據');}).catch(()=>{const el=document.getElementById('mlb-player-stats');if(el&&location.hash===`#player/mlb/${id}`)el.innerHTML=empty('MLB 官方數據目前無法讀取，請稍後再試');});
}
function movementsPage(){
 const league=location.hash.split('/')[1]||'NBA';
 const records=movements.filter(x=>x.league===league).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name));
 const period=league==='NBA'?'2025–26 球季結束後 · 2026 年休賽季':'2026 球季結束後 · 2026–27 休賽季';
 const describeTeam=code=>league==='NBA'?teamText(code):mlbTeamName(code);
 $('#main').innerHTML=heading('OFFSEASON PLAYER MOVEMENT','球員轉隊','依正式交易與自由球員簽約整理，最新日期排在前面。')+`<div class="people-tabs move-leagues"><a class="rank-league ${league==='NBA'?'move-active':''}" href="#movements/NBA">NBA</a><a class="rank-league ${league==='MLB'?'move-active':''}" href="#movements/MLB">MLB</a></div><details class="people-disclosure"><summary>${esc(period)} · 部分已核對</summary><div class="people-disclosure-body"><p>人工核對 ${esc(movementReviewDate)}。</p><p>目前是已核對的部分紀錄，尚非完整名單；不會隨網站賽程自動更新。日期依聯盟公布日期（美國當地），球員連續換隊會保留每一次紀錄。MLB 休賽季仍在進行。</p>${league==='NBA'?link('https://www.nba.com/news/2026-offseason-trade-tracker','NBA 官方交易清單'):link('https://www.mlb.com/news/mlb-2026-2027-free-agents-trades-offseason-transaction-tracker','MLB 官方休賽季追蹤')}</div></details><label class="search movement-search">⌕ <input id="movement-search" type="search" placeholder="搜尋球員或球隊" aria-label="搜尋球員或球隊"></label><div id="movement-results"></div>`;
 let limit=24;const render=()=>{const q=document.querySelector('#movement-search').value.trim().toLowerCase();const rows=records.filter(r=>`${r.name} ${r.zh??playerZh({name:r.name})} ${describeTeam(r.from)} ${describeTeam(r.to)} ${r.date}`.toLowerCase().includes(q));document.querySelector('#movement-results').innerHTML=`<p class="result-label">${rows.length} 筆已核對</p><div class="movement-list">${rows.slice(0,limit).map(r=>{const matching=league==='NBA'?(data.rosterDatabase?.teams??[]).flatMap(t=>t.players??[]).filter(p=>p.name.toLowerCase()===r.name.toLowerCase()):[];const pid=matching.length===1?matching[0].id:null;return `<article class="movement-card people-move"><div class="movement-date"><strong>${esc(r.date)}</strong><span>${esc(r.type)}</span></div><div class="movement-person">${pid?peopleIdentity({name:r.name,espnId:pid}):`<div class="player-cell"><div><strong>${esc(r.zh??playerZh({name:r.name}))}</strong><small>${esc(r.name)}</small></div></div>`}</div><div class="movement-teams"><div><strong title="${esc(describeTeam(r.from))}">${esc(league==='NBA'?shortTeam(r.from):describeTeam(r.from))}</strong></div><span aria-hidden="true">→</span><div><strong title="${esc(describeTeam(r.to))}">${esc(league==='NBA'?shortTeam(r.to):describeTeam(r.to))}</strong></div></div><div class="movement-source">${link(r.source,'官方來源')}</div></article>`;}).join('')||empty('沒有符合條件的換隊紀錄')}</div>${peopleMore("movement-more",limit,rows.length)}`;const more=$('#movement-more');if(more)more.onclick=()=>{limit+=24;render();};};document.querySelector('#movement-search').oninput=()=>{limit=24;render();};render();
}
function improvementPage(){
 const d=data.improvement,part=location.hash.split('/')[1];
 const title=`<nav class="people-tabs" aria-label="球季變化排行"><a href="#improvement" aria-current="page">進步</a><a href="#decline">退步</a></nav>`+heading('NBA IMPROVEMENT / 球員進步','球員進步排行榜 / Improvement','今年比去年進步多少？先選擇一項場均數據。')+infoBanner();
 const menu=`<div class="people-tabs people-metrics" aria-label="排行數據">${improvementSpecs.map(([key,label])=>`<a${part===key?' aria-current="page"':''} href="#improvement/${key}">${esc(label.split(' / ')[0])}</a>`).join('')}</div>`;
 if(!d?.current||!d?.previous||d.status!=='available'||Date.now()-Date.parse(d.current.observedAt)>86400000){$('#main').innerHTML=title+menu+empty('球季比較資料暫時不可用或已過期，等待更新');return;}
 const label=improvementSpecs.find(x=>x[0]===part)?.[1];
 const info=`<details class="people-disclosure"><summary>${esc(d.previous.season)} → ${esc(d.current.season)} · 方法與來源</summary><div class="people-disclosure-body"><p>今年至少出賽 4 場；今年所選項目先在符合 4 場條件的球員中排名前 100，並列同名次；與上季有資料的同一球員比較，僅列出增加者。上季場數少可能使變動放大。進步幅度＝今年場均－上季場均，不是預測或官方獎項。兩季以 ESPN 球員 ID 對照，資料仍受來源涵蓋範圍限制。</p><p>本季取得 ${fmt(d.current.observedAt)} · 上季取得 ${fmt(d.previous.observedAt)}（台灣時間）</p><p>${link(d.current.source,'本季來源')} · ${link(d.previous.source,'上季來源')}</p></div></details>`;
 if(!label){$('#main').innerHTML=title+info+menu;return;}
 const rows=improvementRanking(d.current,d.previous,part);$('#main').innerHTML=title+info+menu+`<h2 class="rank-section-title">${esc(label)} · 進步排行</h2><p class="fine-print">${rows.length} 人符合條件；以下依未四捨五入的進步幅度排序。</p>`+(rows.length?`<div class="table-wrap"><table><thead><tr><th>排名</th><th>球員</th><th>上季場均</th><th>今年場均</th><th>變化</th><th>今年名次</th><th>出賽<br>今／上季</th></tr></thead><tbody>${rows.map((p,i)=>`<tr><td><strong>${i+1}</strong></td><td>${peopleIdentity({...p,espnId:p.id})}</td><td>${p.previous.stats[part].toFixed(2)}</td><td>${p.stats[part].toFixed(2)}</td><td><strong>+${p.change.toFixed(2)}</strong></td><td>${p.currentRank}</td><td>${p.stats.gamesPlayed} / ${p.previous.stats.gamesPlayed}</td></tr>`).join('')}</tbody></table></div>`:empty('目前沒有符合條件的進步球員'));
}
function declinePage(){
 const d=data.improvement,part=location.hash.split('/')[1];
 const title=`<nav class="people-tabs" aria-label="球季變化排行"><a href="#improvement">進步</a><a href="#decline" aria-current="page">退步</a></nav>`+heading('NBA IMPROVEMENT / 球員退步','球員退步排行榜 / Improvement','今年比去年退步多少？先選擇一項場均數據。')+infoBanner();
 const menu=`<div class="people-tabs people-metrics" aria-label="排行數據">${improvementSpecs.map(([key,label])=>`<a${part===key?' aria-current="page"':''} href="#decline/${key}">${esc(label.split(' / ')[0])}</a>`).join('')}</div>`;
 if(!d?.current||!d?.previous||d.status!=='available'||Date.now()-Date.parse(d.current.observedAt)>86400000){$('#main').innerHTML=title+menu+empty('球季比較資料暫時不可用或已過期，等待更新');return;}
 const label=improvementSpecs.find(x=>x[0]===part)?.[1];
 const info=`<details class="people-disclosure"><summary>${esc(d.previous.season)} → ${esc(d.current.season)} · 方法與來源</summary><div class="people-disclosure-body"><p>今年至少出賽 4 場；今年所選項目先在符合 4 場條件的球員中排名前 100，並列同名次；與上季有資料的同一球員比較，僅列出減少者。上季場數少可能使變動放大。退步幅度＝今年場均－上季場均，不是預測或官方獎項。兩季以 ESPN 球員 ID 對照，資料仍受來源涵蓋範圍限制。</p><p>本季取得 ${fmt(d.current.observedAt)} · 上季取得 ${fmt(d.previous.observedAt)}（台灣時間）</p><p>${link(d.current.source,'本季來源')} · ${link(d.previous.source,'上季來源')}</p></div></details>`;
 if(!label){$('#main').innerHTML=title+info+menu;return;}
 const rows=declineRanking(d.current,d.previous,part);$('#main').innerHTML=title+info+menu+`<h2 class="rank-section-title">${esc(label)} · 退步排行</h2><p class="fine-print">${rows.length} 人符合條件；以下依未四捨五入的退步幅度排序。</p>`+(rows.length?`<div class="table-wrap"><table><thead><tr><th>排名</th><th>球員</th><th>上季場均</th><th>今年場均</th><th>變化</th><th>今年名次</th><th>出賽<br>今／上季</th></tr></thead><tbody>${rows.map((p,i)=>`<tr><td><strong>${i+1}</strong></td><td>${peopleIdentity({...p,espnId:p.id})}</td><td>${p.previous.stats[part].toFixed(2)}</td><td>${p.stats[part].toFixed(2)}</td><td><strong>${p.change.toFixed(2)}</strong></td><td>${p.currentRank}</td><td>${p.stats.gamesPlayed} / ${p.previous.stats.gamesPlayed}</td></tr>`).join('')}</tbody></table></div>`:empty('目前沒有符合條件的退步球員'));
}
function playoffPage(){
  const league=location.hash.split('/')[1]||'NBA', nba=data.nbaConferenceStandings, mlb=data.leaderboards?.standings;
  const menu=`<nav class="compact-tabs" aria-label="季後賽聯盟">${['NBA','MLB'].map(l=>`<a href="#playoffs/${l}" ${l===league?'aria-current="page"':''}>${l}</a>`).join('')}</nav>`;
  const title=heading('PLAYOFF','季後賽衝刺榜','')+menu;
  const scoreText=entry=>entry?entry.score.toFixed(1):'—';
  const table=(name,rows,renderRow)=>`<section class="content-section compact-standings"><h2>${esc(name)}</h2><div class="table-wrap"><table><thead><tr>
    <th>名次</th><th>球隊</th><th>勝敗</th><th>勝率</th><th>分數</th><th>明細</th>
    </tr></thead><tbody>${rows.map(renderRow).join('')}</tbody></table></div></section>`;
  if(league==='NBA'){
    if(!nba?.groups||nba.stale||Date.now()-Date.parse(nba.observedAt)>86400000){$('#main').innerHTML=title+empty('NBA 戰績不可用或已過期');return;}
    const info=teamScores(nba.groups);
    $('#main').innerHTML=title+`<p class="compact-note">${esc(nba.season)} · 暫列戰績</p>`+nba.groups.map(g=>{
      const rows=orderConference(g.rows), six=rows[5], ten=rows[9];
      const gap=(row,target)=>{
        const value=target?gamesBehind(row,target):null;
        return Number.isFinite(value)?value===0?'—':`${value<0?'領先':'落後'} ${Math.abs(value).toFixed(1)}`:'—';
      };
      return table(g.name==='Eastern Conference'?'東區':'西區',rows,r=>{
        const roster=rosterStatus(r.team,data.rosterDatabase,data.injuries,data.generatedAt);
        const evidence=`<p>第 6 名 ${gap(r,six)} · 第 10 名 ${gap(r,ten)}<br>剩餘 ${Math.max(0,82-r.wins-r.losses)} 場 · ${esc(r.streak??'—')} · 近十場 ${esc(r.lastTen??'—')}</p>
          ${roster?`<p>缺陣 ${roster.out} · 待定 ${roster.uncertain} · 未確認 ${roster.unknown}／名單 ${roster.total}<br>名單 ${fmt(roster.observedAt)} · ${link(roster.source,'來源')}</p>`:'<p>陣容資料不足</p>'}<p>可補強人數待確認</p>`;
        return `<tr><td>${r.rank}</td><td><div class="ranking-team" title="${esc(teamText(r.team))}">${teamLogo(r.team)}<strong>${esc(shortTeam(r.team))}</strong></div></td><td>${r.wins}–${r.losses}</td><td>${r.pct.toFixed(3)}</td><td>${scoreText(info.scores[r.team])}</td><td>${compactEvidence('看明細',evidence)}</td></tr>`;
      });
    }).join('')+compactEvidence('資料來源與分數方法',`<p>${fmt(nba.observedAt)} 取得（台灣時間） · ${link(nba.source,'ESPN 分區戰績')}</p>
      <p>勝率相同並列，尚未套用官方同分規則。第 6、10 名分界僅供觀察。剩餘按 82 場計算；實際席次依聯盟規則。</p>
      <p>${info.sample} 隊同快照的勝率、場均得分、場均失分百分位各占三分之一，滿分 100。場均受節奏影響，傷病及名單另外保留。正式及雙向合約資料不足，無法可靠計算空位。<a href="#injuries">查看傷病</a></p>${infoBanner()}`);
    return;
  }
  if(league!=='MLB'||!mlb?.rows||mlb.stale||Date.now()-Date.parse(mlb.observedAt)>86400000){$('#main').innerHTML=title+empty('MLB 戰績不可用或已過期');return;}
  const info=teamScores([{rows:mlb.rows.map(r=>({team:String(r.teamId),pct:r.pct,pointsFor:Number.isFinite(r.runsScored)&&r.games>0?r.runsScored/r.games:null,pointsAgainst:Number.isFinite(r.runsAllowed)&&r.games>0?r.runsAllowed/r.games:null}))}]);
  const labels={201:'美聯東區',202:'美聯中區',200:'美聯西區',204:'國聯東區',205:'國聯中區',203:'國聯西區'};
  const nearEnd=mlb.rows.every(r=>r.games>=160);
  $('#main').innerHTML=title+`<p class="compact-note">${esc(mlb.season)} 例行賽${nearEnd?' · 後段或已結束':''}</p>`+Object.entries(labels).map(([id,name])=>{
    const rows=mlb.rows.filter(r=>String(r.division)===id).sort((a,b)=>Number(a.divisionRank??99)-Number(b.divisionRank??99));
    return table(name,rows,r=>`<tr><td>${esc(r.divisionRank??'—')}</td><td><div class="ranking-team" title="${esc(mlbTeamName(r.name))}"><img width="30" height="30" src="https://www.mlbstatic.com/team-logos/${encodeURIComponent(r.teamId)}.svg" alt="" onerror="this.hidden=true"><strong>${esc(mlbTeamName(r.name).split(' / ')[0])}</strong></div></td><td>${r.wins}–${r.losses}</td><td>${r.pct.toFixed(3)}</td><td>${scoreText(info.scores[String(r.teamId)])}</td><td>${compactEvidence('看明細',`<p>${r.games} 場 · 陣容資料不足 · 可補強人數待確認</p>`)}</td></tr>`);
  }).join('')+compactEvidence('資料來源與分數方法',`<p>${fmt(mlb.observedAt)} 取得 · ${link(mlb.source,'MLB 官方分區')}</p><p>保留官方例行賽排名；季後賽、外卡及晉級須另查。</p><p>${info.sample} 隊的勝率、場均得分、場均失分百分位各占三分之一。分數未包含傷病。</p>${infoBanner()}`);
}

function dailyPage(){
  const now=Date.now(), today=taipeiDay(now), valid=now-Date.parse(data.generatedAt)<8*3600000;
  const games=valid?data.games.filter(g=>g.date===today && !g.conflicts.length && g.sourceCount>=2):[];
  const completed=games.filter(g=>g.status==='final'&&Number.isFinite(g.homeScore)&&Number.isFinite(g.awayScore))
    .sort((a,b)=>Math.abs(b.homeScore-b.awayScore)-Math.abs(a.homeScore-a.awayScore));
  const next=games.filter(g=>g.status==='scheduled'&&Date.parse(g.startAt)>now)
    .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt))[0];
  const nba=data.nbaConferenceStandings;
  const boards=nba?.groups&&!nba.stale&&now-Date.parse(nba.observedAt)<86400000?nba.groups:[];
  const conflicts=valid?data.injuries.filter(row=>row.comparison==='conflict').length:0;
  const cards=[];
  const match=(g,label,score)=>`<a class="compact-tile" href="#game/${encodeURIComponent(g.id)}">
    <small>${label}</small><div class="compact-match">${teamLogo(g.away,g.league)}<span>${esc(shortTeam(g.away,g.league))}</span>
    <strong>${score}</strong><span>${esc(shortTeam(g.home,g.league))}</span>${teamLogo(g.home,g.league)}</div></a>`;
  if(completed[0]){
    const g=completed[0];
    cards.push(match(g,`最大分差 ${Math.abs(g.homeScore-g.awayScore)} 分`,`${g.awayScore}–${g.homeScore}`));
  }
  if(next)cards.push(match(next,`即將開賽 ${fmt(next.startAt)}`,'VS'));
  for(const g of boards){
    const leaders=orderConference(g.rows).filter(x=>x.rank===1);
    if(!leaders.length)continue;
    cards.push(`<a class="compact-tile" href="#playoffs/NBA"><small>${g.name==='Eastern Conference'?'東區':'西區'}勝率領先</small>
      ${leaders.map(x=>`<div class="compact-leader">${teamLogo(x.team)}<span>${esc(shortTeam(x.team))}</span><strong>${x.wins}–${x.losses}</strong></div>`).join('')}</a>`);
  }
  if(conflicts)cards.push(`<a class="compact-tile" href="#injuries"><small>傷病來源不一致</small><strong>${conflicts} 筆</strong></a>`);
  $('#main').innerHTML=heading('DAILY DATA BRIEF','每日話題',`${today}（台灣時間）`)+
    `<div class="compact-card-grid">${cards.join('')||empty('暫無可核對的當日焦點')}</div>`+
    compactEvidence('整理方式與來源',`<p>${today} 台灣日期。依可核對的賽程、賽果、戰績和傷病自動整理，樣本不足時略過。傷病來源不一致仍須查隊伍公告。</p>${nba?.observedAt?`<p>分區戰績 ${fmt(nba.observedAt)} 取得。</p>`:''}${infoBanner()}`);
}

function nextUpdate(){const now=new Date(),tpe=new Date(now.getTime()+8*3600000);for(const h of [7,14,21])if(h>tpe.getUTCHours())return `${String(h).padStart(2,'0')}:00`;return '明天 07:00';}
function heading(kicker, title, description, actions = '') {
  const shortTitle = kicker.includes('PLAYER PROFILE') ? title : title.replace(/ \/ [A-Za-z][A-Za-z .&-]*$/, '');
  const urgent = kicker === 'DATA UNAVAILABLE' || kicker === 'NOT FOUND';
  return `<div class="page-heading"><div><h1>${esc(shortTitle)}</h1>
    ${description && urgent ? `<p>${esc(description)}</p>` : ''}</div>
    <div class="dashboard-heading-tools">${description && !urgent ? `<details class="dashboard-context"><summary>頁面說明</summary><p>${esc(description)}</p></details>` : ''}${actions}</div>
  </div>`;
}
function infoBanner() {
  const isOld = Date.now() - Date.parse(data.generatedAt) > 8 * 3600000;
  const status = isOld ? '資料已過期' : data.collection.status === 'partial_success' ? '部分來源未完成' : '';
  return `<details class="notice info-summary ${isOld ? 'warning' : ''}"><summary>
    <strong>資料來源與更新</strong>${status ? `<span class="dashboard-data-status">${status}</span>` : ''}
    </summary><p>更新 ${fmt(data.generatedAt)}（台灣時間） · ${data.collection.usable}／${data.collection.total} 個請求可用 · 耗時 ${(data.collection.durationMs / 1000).toFixed(1)} 秒</p>
    <p>下次預定 ${nextUpdate()}（台灣時間，執行可能延遲）</p><a href="#sources">查看來源狀態 ↗</a></details>`;
}
const gameDates=()=>[...new Set([...data.targetDates,...(data.historicalDates??[])])].sort((a,b)=>b.localeCompare(a));
const allGames=()=>[...data.games,...(data.historicalGames??[])];
function toolbar(){return `<div class="filter-row"><div class="segmented"><button data-league="NBA" class="${ui.league==='NBA'?'active':''}" aria-pressed="${ui.league==='NBA'}">NBA</button><button data-league="MLB" class="${ui.league==='MLB'?'active':''}" aria-pressed="${ui.league==='MLB'}">MLB</button></div><label class="field-label"><select id="game-date" aria-label="台灣日期">${gameDates().map(d=>`<option ${d===ui.date?'selected':''}>${d}</option>`).join('')}</select></label><label class="search">⌕ <input id="game-search" type="search" aria-label="搜尋球隊" placeholder="搜尋球隊…" value="${esc(ui.query)}"></label></div>`;}
function gameCard(game) {
  const {league, away, home} = game;
  const teamSide = (code, side) => `<div aria-label="${side} ${esc(teamText(code, league))}">${teamLogo(code, league)}
    <h3 title="${esc(teamText(code, league))}">${esc(shortTeam(code, league))}</h3></div>`;
  const source = game.comparison === 'conflict' ? ['資料待核對', 'danger'] :
    game.comparison === 'stale_only' ? ['舊資料', 'amber'] :
    game.sourceCount > 1 ? [`${game.sourceCount} 個來源`, 'mint'] : ['單一來源', 'amber'];
  const hasScore = Number.isFinite(game.awayScore) && Number.isFinite(game.homeScore);
  const score = hasScore ? `<strong>${game.awayScore}<em>:</em>${game.homeScore}</strong>` : '<span>VS</span>';
  return `<a class="game-card" href="#game/${encodeURIComponent(game.id)}">
    <div class="game-meta"><span>${league} · ${fmt(game.startAt)}</span>
      ${badge(statuses[game.status] ?? '未確認', game.status === 'final' ? 'neutral' : game.status === 'live' ? 'mint' : '')}</div>
    <div class="matchup">${teamSide(away, '客隊')}<div class="score">${score}</div>${teamSide(home, '主隊')}</div>
    <div class="game-bottom">${badge(...source)}<span>${game.forecasts?.length ? `${game.forecasts.length} 份研究存檔 ` : ''}↗</span></div>
  </a>`;
}
function compactHomeMatch(game) {
  const {league, away, home, status} = game;
  const conflict = game.comparison === 'conflict' || !!game.conflicts?.length;
  const old = game.comparison === 'stale_only';
  const hasScore = Number.isInteger(game.awayScore) && Number.isInteger(game.homeScore) && !conflict;
  const matchup = (code, side) => `<span title="${esc(teamText(code, league))}" aria-label="${side} ${esc(shortTeam(code, league))}">${teamLogo(code, league)}<b>${esc(shortTeam(code, league))}</b></span>`;
  return `<a class="game-card home-match" href="#game/${encodeURIComponent(game.id)}">
    <div class="home-match-meta"><time datetime="${esc(game.startAt)}">${fmt(game.startAt,{month:undefined,day:undefined,hour12:undefined,hourCycle:'h23'})}</time>
      ${badge(conflict ? '待核對' : old ? '舊資料' : statuses[status] ?? '未確認',conflict ? 'danger' : old ? 'amber' : status==='live' ? 'mint' : 'neutral')}</div>
    <div class="home-match-teams">${matchup(away,'客隊')}
      <strong class="home-match-score">${hasScore ? `${game.awayScore} : ${game.homeScore}` : 'VS'}</strong>
      ${matchup(home,'主隊')}</div>
    </a>`;
}

function overview() {
  const conflicts = data.games.filter(game => game.conflicts.length).length +
    data.injuries.filter(injury => injury.comparison === 'conflict').length;
  $('#main').innerHTML = `<div class="home-title">
    <h1>賽事</h1>
    <a class="home-primary" href="#predictions">今明預測 →</a>
  </div>
  <div class="home-board">
    <section class="home-panel home-schedule" aria-labelledby="home-schedule-title">
      <h2 id="home-schedule-title">賽程</h2>
      ${toolbar()}
      <div id="game-results" aria-live="polite"></div>
    </section>
    <aside class="home-rail" aria-label="賽況與快速查閱">
      <section class="home-panel" aria-labelledby="home-status-title">
        <h2 id="home-status-title">賽況</h2>
        <div id="home-game-counts"></div>
      </section>
      <section class="home-panel" aria-labelledby="home-links-title">
        <h2 id="home-links-title">快速查閱</h2>
        <div class="home-links">
          <a href="./nba-rankings.html?v=dashboard-20261122">球員綜合榜</a>
          <a href="./analysis.html?view=teams&v=dashboard-20261122">球隊戰力</a>
          <a href="#injuries">傷病與出賽</a>
          <a href="#archive">預測存檔</a>
        </div>
      </section>
      <details class="home-panel home-sources">
        <summary>資料狀態${Date.now() - Date.parse(data.generatedAt) > 8 * 3600000 ? ' <small>資料過期</small>' : data.collection.status === 'partial_success' ? ' <small>部分未更新</small>' : ''}</summary>
        <div class="home-source-counts">
          <span><b>${data.collection.activeProviderCount}</b> 可用來源</span>
          <span><b>${conflicts}</b> 狀態差異</span>
          <span><b>${data.unresolvedSchedule.length}</b> 賽程未配對</span>
        </div>
        ${infoBanner()}
      </details>
    </aside>
  </div>
  ${homeNbaTop(data)}`;
  wireGames();
}

function renderGames() {
  const query = ui.query.trim().toLowerCase();
  const games = allGames()
    .filter(game => game.league === ui.league && game.date === ui.date &&
      `${teamText(game.home, game.league)} ${teamText(game.away, game.league)}`.toLowerCase().includes(query))
    .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  const historical = !data.targetDates.includes(ui.date);
  $('#game-results').innerHTML = `<div class="result-label">${games.length} 場${historical ? ' · 歷史快照' : ''}</div>
    ${historical ? '<details class="home-history-note"><summary>快照說明</summary><p>顯示當時最後保存的資料。完整賽果與來源時間請到單場頁核對。</p></details>' : ''}
    <div class="home-game-scroll" tabindex="0" role="region" aria-label="賽程列表">
      <div class="game-grid">${games.length ? games.map(compactHomeMatch).join('') :
        empty(ui.league === 'MLB' ? '這個日期沒有取得 MLB 賽事' : '沒有符合條件的賽事')}</div>
    </div>`;
  $('#home-game-counts').innerHTML = homeGameStatus(games);
}
function wireGames(){document.querySelectorAll('[data-league]').forEach(b=>b.onclick=()=>{ui.league=b.dataset.league;document.querySelectorAll('[data-league]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderGames();});$('#game-date').onchange=e=>{ui.date=e.target.value;renderGames();};$('#game-search').oninput=e=>{ui.query=e.target.value;renderGames();};renderGames();}
function forecastCard(p){
  const archiveStatus=p.status==='invalid_pregame_timestamp'?'賽前時間不符':p.historical?'歷史存檔':'研究候選';
  return `<article class="forecast compact-forecast">
    <div class="forecast-top"><strong>${esc(names[p.source]??p.source)}</strong>${badge(archiveStatus,p.status==='invalid_pregame_timestamp'?'danger':'amber')}</div>
    <div class="forecast-score"><span>${esc(shortTeam(p.away,p.league))}<b>${percent(p.awayWinProbability)}</b></span><span>${esc(shortTeam(p.home,p.league))}<b>${percent(p.homeWinProbability)}</b></span></div>
    <small>${fmt(p.startAt)}${p.stale?' · 已過期':''}</small>
    ${compactEvidence('存檔明細',`<p>原產生 ${fmt(p.generatedAt)} · 原站封存研究</p><p>${esc(p.limitation)}</p>
      <dl><dt>SHA-256</dt><dd class="hash">${esc(p.sourceHash)}</dd><dt>下載觀測</dt><dd>${fmt(p.observedAt)}</dd>
      <dt>校準</dt><dd>${p.calibrated?'原站標示已校準；本站尚未獨立驗證':'尚未獨立校準'}</dd></dl>`)}</article>`;
}

function detail(id){
  const g=allGames().find(g=>g.id===id);
  if(!g){$('#main').innerHTML=heading('NOT FOUND','找不到這場比賽','資料快照可能已更新。','<a class="button" href="#overview">回到總覽</a>');return;}
  const observations=g.observations??[], forecasts=g.forecasts??[], modelState=g.modelState??[];
  const evidence=observations.map(o=>`<tr><td>${link(o.reference??o.sourceUrl,names[o.provider])}</td><td>${esc(statuses[o.status]??'待確認')}</td>
    <td>${o.awayScore??'—'}：${o.homeScore??'—'}</td><td>${fmt(o.observedAt)}</td>
    <td>${g.archiveObservedAt?'歷史觀測':o.stale?'過期資料':'本輪有效'}<details><summary>SHA</summary><span class="hash">${esc(o.sha256)}</span></details></td></tr>`).join('');
  const notes=modelState.map(s=>`<p><strong>StatsHub · ${s.status==='not_built'?'尚未建模':s.status==='predicted'?'研究輸出已存':esc(s.status)}</strong><br>
    ${(s.reasons??[]).length?s.reasons.map(esc).join('；'):'模型輸入及校準仍待確認。'}</p>`).join('');
  const injuriesForGame=g.archiveObservedAt?[]:data.injuries.filter(i=>[g.away,g.home].includes(i.team)&&i.status!=='UNKNOWN');
  $('#main').innerHTML=`<a class="back" href="#overview">← 賽事</a>`+heading('MATCH',`${shortTeam(g.away,g.league)} ＠ ${shortTeam(g.home,g.league)}`,'')+
    gameCard(g)+compactEvidence(`來源對照 · ${observations.length} 筆`, `<div class="table-wrap"><table><thead><tr><th>來源</th><th>狀態</th><th>客：主比分</th><th>觀測</th><th>資料狀態</th></tr></thead><tbody>${evidence}</tbody></table></div><p>按聯盟、主客隊及開賽時間配對。網站結果一致，仍須核對上游是否相同。</p>`)+
    compactEvidence(`研究模型 · ${forecasts.length} 份`,`${forecasts.length?`<div class="two-panels">${forecasts.map(forecastCard).join('')}</div>`:'<p>暫無可對應的原站預測。</p>'}${notes||'<p>尚無模型條件回報。</p>'}`)+
    compactEvidence(g.archiveObservedAt?'歷史傷病資料':`兩隊出賽狀態 · ${injuriesForGame.length} 筆`,g.archiveObservedAt?'<p>歷史賽事保留比賽當時的資料範圍，不套用目前的傷病名單。</p>':injuryTable(injuriesForGame));
}

function injuryTable(rows) {
  if(!rows.length)return empty('沒有符合條件的出賽紀錄');
  return `<div class="people-injuries">${rows.map(i=>{
    const status=badge(injuryNames[i.status],i.comparison==='conflict'?'danger':i.status==='OUT'?'amber':'neutral');
    const lineup=i.confirmedLineup?badge('RotoWire 標示確認','mint'):i.expectedLineup?badge('預期先發','neutral'):'';
    const sources=i.observations.map(o=>`<p class="inj-observation">${link(o.reference,names[o.provider])}：${injuryNames[o.status]}<small>紀錄 ${fmt(o.updatedAt)} · 取得 ${fmt(o.observedAt)}${o.stale?' · 過期':''}${o.upstream==='rotowire'?' · 上游 RotoWire':''}</small></p>`).join('');
    return `<article class="people-injury-card"><div class="people-injury-summary">${peopleIdentity(i,i.team)}<div class="people-injury-tags">${status}${lineup}</div></div>${peopleDetails(i.comparison==='conflict'?'查看衝突來源':`${i.sourceCount} 個來源`,sources+'<p class="fine-print">未知上游不算獨立證據；未標示上場機率。</p>')}</article>`;
  }).join('')}</div>`;
}
function mlbRosterContext(){return {root:$('#main'),teamName:mlbTeamName,playerName:(name,id)=>playerChineseText({name,id,league:'MLB'}),formatTime:fmt,performance:data.mlbPerformance};}
function rosterPage(){
 const db=data.rosterDatabase;if(!db){$('#main').innerHTML=heading('PLAYER DATABASE / NBA','NBA 球員資料庫 / Player Database','尚未取得球員名單資料，請等待更新。');return;}
 const positions={G:'後衛',F:'前鋒',C:'中鋒','G-F':'後衛／前鋒','F-G':'前鋒／後衛','F-C':'前鋒／中鋒','C-F':'中鋒／前鋒'};
 let query='',teamFilter='',position='',page=0;
 const players=db.teams.flatMap(t=>t.players.map(p=>({...p,espnId:p.id,rosterSource:t})));
 const season=data.improvement?.current?.seasonYear??data.leaderboards?.nba?.seasonYear;
 const all=rankNbaRoster(players,data.nbaPlayerRatings,season);
 $('#main').innerHTML=`<nav class="people-tabs" aria-label="聯盟"><a aria-current="page" href="#rosters">NBA</a><a href="#rosters/mlb">MLB</a><a href="./transfers.html?league=NBA">轉隊紀錄</a></nav>`+heading('PLAYER DATABASE / NBA','NBA 球員資料庫','先看本季重點與球員評分。')+`<details class="people-disclosure"><summary>名單與評分來源 · ${db.availableTeams}/30 隊</summary><div class="people-disclosure-body">${playerNameCreditHtml}<p>依 SportsDataverse 的本季 adj-RAPM 在場影響值由高到低排序；S–D 為同位置百分位等級，並非全面實力。至少 5 場、60 分鐘且資料通過核對才排名；待評球員列在後方。名次以全部已核對球員計算，篩選後不重新編號。</p><p>名單：ESPN · ${db.availableTeams} / 30 隊本輪有效 · ${db.players} 位球員紀錄。名單與出賽狀態可能延遲，未列傷病不代表健康。</p><p>評分取得 ${fmt(data.nbaPlayerRatings?.observedAt)}（台灣時間）· ${link(data.nbaPlayerRatings?.method,'評分方法')} · ${link(data.nbaPlayerRatings?.source,'評分資料')}</p></div></details><div class="filter-row roster-filters"><label class="search">⌕ <input id="roster-search" type="search" aria-label="搜尋球員或球隊" placeholder="搜尋中文、英文、球隊…"></label><label class="field-label">球隊<select id="roster-team"><option value="">全部球隊</option>${db.teams.slice().sort((a,b)=>teamText(a.team).localeCompare(teamText(b.team),'zh-Hant')).map(t=>`<option value="${esc(t.team)}">${esc(teamText(t.team))}</option>`).join('')}</select></label><label class="field-label">位置<select id="roster-position"><option value="">全部位置</option>${Object.entries(positions).map(([v,n])=>`<option value="${v}">${esc(n)}</option>`).join('')}</select></label></div><div id="roster-results" aria-live="polite"></div>`;
 const render=()=>{const q=query.trim().toLowerCase();const filtered=all.filter(p=>(!teamFilter||p.team===teamFilter)&&(!position||p.position===position)&&`${p.name} ${playerZh(p)} ${teamText(p.team)} ${p.jersey??''}`.toLowerCase().includes(q));const maxPage=Math.max(0,Math.ceil(filtered.length/24)-1);page=Math.min(page,maxPage);const rows=filtered.slice(page*24,page*24+24);$('#roster-results').innerHTML=`<p class="result-label">${filtered.length} 位球員 · 第 ${page+1} / ${maxPage+1} 頁</p>${rows.length?`<div class="roster-grid people-roster-grid">${rows.map(p=>renderNbaRosterCard(p,{data,playerName:playerZh,teamLogo,shortTeam,teamText,positions,formatTime:fmt,link})).join('')}</div>`:empty('找不到符合條件的球員')}<div class="roster-pagination"><button id="roster-prev" ${page===0?'disabled':''}>← 上一頁</button><span>${page+1} / ${maxPage+1}</span><button id="roster-next" ${page>=maxPage?'disabled':''}>下一頁 →</button></div>`;$('#roster-prev').onclick=()=>{page--;render();};$('#roster-next').onclick=()=>{page++;render();};};
 $('#roster-search').oninput=e=>{query=e.target.value;page=0;render();};$('#roster-team').onchange=e=>{teamFilter=e.target.value;page=0;render();};$('#roster-position').onchange=e=>{position=e.target.value;page=0;render();};render();
}
function injuries(){const known=data.injuries.filter(i=>i.status!=='UNKNOWN');$('#main').innerHTML=heading('AVAILABILITY / CROSS-CHECK','傷病與出賽','同隊、完整姓名配對，避免把同一球員拆成不同記錄；沒有傷病記錄不等於健康。')+infoBanner()+`<details class="people-disclosure"><summary>出賽判讀 · 以球隊公告為準</summary><div class="people-disclosure-body"><p>部分 ESPN 紀錄與 RotoWire 同源。官方 PDF 提供原始報告，還沒有整合成球員共識。未列傷病的球員仍可能缺陣。</p></div></details><div class="filter-row"><label class="search"><input type="search" id="injury-search" placeholder="搜尋球員或球隊…" aria-label="搜尋球員或球隊"></label><label class="field-label">顯示<select id="injury-mode"><option value="all">所有明確狀態</option><option value="conflict">只看衝突</option><option value="lineup">只看先發資訊</option></select></label><span class="fine-print">${known.length} 筆有明確狀態 · ${data.injuries.filter(i=>i.status==='UNKNOWN').length} 筆未確認</span></div><div id="injury-results"></div>`;let limit=24;const render=()=>{const q=$('#injury-search').value.toLowerCase(),mode=$('#injury-mode').value;const rows=data.injuries.filter(i=>`${i.player} ${playerZh(i)} ${teamText(i.team)}`.toLowerCase().includes(q)&&(mode==='lineup'?i.expectedLineup||i.confirmedLineup:i.status!=='UNKNOWN')&&(mode!=='conflict'||i.comparison==='conflict'));$('#injury-results').innerHTML=injuryTable(rows.slice(0,limit))+peopleMore('injury-more',limit,rows.length);const more=$('#injury-more');if(more)more.onclick=()=>{limit+=24;render();};};const reset=()=>{limit=24;render();};$('#injury-search').oninput=reset;$('#injury-mode').onchange=reset;render();}
function rookies(){
 const database=data.rosterDatabase, roster=buildRookieRoster(database), view=ui.rookieView??'all';
 const current=(data.improvement?.currentStatus==='available'||data.improvement?.status==='available')&&data.improvement.current&&!data.improvement.current.stale&&data.improvement.current.seasonType==='Regular Season'&&(!data.leaderboards?.nba?.seasonYear||data.improvement.current.seasonYear===data.leaderboards.nba.seasonYear)&&Date.now()-Date.parse(data.improvement.current.observedAt)<86400000?data.improvement.current:null;
 const appearances=partitionAppearances(roster.rows,current?.players), selected=filterRookies(appearances.played,view), pending=filterRookies(appearances.pending,view), noGames=filterRookies(appearances.noGames,view);
 const statsById=new Map((current?.players??[]).map(p=>[String(p.id),p.stats]));
 const ranking=rankRookies(selected,statsById), rows=ranking.rows;
 const format=v=>Number.isFinite(v)?v.toFixed(1):'—',pct=(attempt,v)=>Number.isFinite(attempt)&&attempt>0&&Number.isFinite(v)?`${v.toFixed(1)}%`:'—';
 const teams=database?.teams??[],fresh=teams.filter(t=>!t.stale&&Number.isFinite(Date.parse(t.observedAt))&&Date.now()-Date.parse(t.observedAt)<=86400000).length;
 $('#main').innerHTML=heading('NBA ROOKIE WATCH / PLAYER ROSTERS','新人觀察 / Rookie Watch','只列出本季例行賽至少出賽 1 場，且球隊名單未過期的一、二年級球員。')+`<details class="people-disclosure"><summary>球季與來源 · ${fresh}/30 隊${current?'':' · 本季統計待更新'}</summary><div class="people-disclosure-body"><p>名單來源：ESPN；本季綜合表現按得分、籃板、助攻、抄截、阻攻五項場均數據的組內百分位等權平均排序；至少出賽 3 場且五項數據齊全才能排名。排名隨所選年級重新計算，並非預測或球員實力的完整評估。名單可能延遲或未完整列出；來源過期或出賽紀錄缺少者列為待確認。${roster.unresolved.length} 位名單球員年資或身分待確認，未列入分類。</p><details><summary>球隊名單來源與時間 / Roster sources</summary>${teams.map(t=>`<p>${esc(teamText(t.team))} · ${fmt(t.observedAt)}${t.stale||!t.observedAt||Date.now()-Date.parse(t.observedAt)>86400000?' · 舊資料或不可用':''} ${link(t.source,'ESPN 名單')}</p>`).join('')}</details><strong>本季數據：${esc(current?.season??'尚未取得')}</strong><small>${current?`ESPN ${fmt(current.observedAt)} 取得（台灣時間），無出手時命中率顯示「—」。`:'本季統計來源不可用或已過期；球員仍保留於名單，數據顯示待確認。'} 名單與統計更新時間不同。</small>${current?link(current.source,'本季數據來源'):''}</div></details><div class="filter-row"><div class="segmented rookie-tabs" role="group" aria-label="新人年級分類">${[['all','全部'],['rookie','一年級'],['sophomore','二年級']].map(([key,label])=>`<button type="button" data-rookie-view="${key}" class="${view===key?'active':''}" aria-pressed="${view===key}">${label}</button>`).join('')}</div><label class="search"><input type="search" id="rookie-search" placeholder="搜尋球員或球隊…" aria-label="搜尋球員或球隊" value="${esc(ui.rookieSearch??'')}"></label></div><p class="section-description">出賽 ${rows.length} · 排名 ${ranking.ranked.length} · 未達門檻 ${ranking.unranked.length} · 待核對 ${pending.length} · 未出賽 ${noGames.length}</p>${pending.length?`<details class="notice"><summary>查看 ${pending.length} 位待核對</summary><p>來源缺少資料或名單過期，不能認定為未出賽。</p>${pending.map(p=>`<p>${esc(playerZh(p))} / ${esc(p.name)} · ${esc(teamText(p.team))}${p.rosterStale?' · 名單過期':' · 缺少本季出賽紀錄'}</p>`).join('')}</details>`:''}<div id="rookie-results"></div>`;
 const search=$('#rookie-search');
 const renderRows=()=>{
  const q=search.value.trim().toLowerCase(), limit=ui.rookieLimit??24;
  const matches=q?rows.filter(p=>`${playerZh(p)} ${p.name} ${teamText(p.team)}`.toLowerCase().includes(q)):rows;
  $('#rookie-results').innerHTML=`${q?`<p class="result-label">找到 ${matches.length} 位</p>`:''}<div class="rookie-grid">${matches.slice(0,limit).map(p=>{const s=statsById.get(p.id),two=twoPointStats(s),numbers=s?[['得分 / PTS',format(s.avgPoints)],['籃板 / REB',format(s.avgRebounds)],['助攻 / AST',format(s.avgAssists)],['兩分 / 2P%',two.pct===null?'—':`${two.pct.toFixed(1)}%`],['三分 / 3P%',pct(s.threePointFieldGoalsAttempted,s.threePointFieldGoalPct)],['罰球 / FT%',pct(s.freeThrowsAttempted,s.freeThrowPct)],['時間 / MIN',format(s.avgMinutes)],['抄截 / STL',format(s.avgSteals)],['阻攻 / BLK',format(s.avgBlocks)],['失誤 / TOV',format(s.avgTurnovers)]]:[];return `<article class="rookie-card people-rookie"><div class="rookie-card-head"><span class="rookie-rank">${p.rank?`#${p.rank} · ${p.displayScore.toFixed(1)} 分`:'未排名'}<br>${p.yearClass==='rookie'?'一年級':'二年級'}</span>${peopleIdentity({...p,espnId:p.id})}</div>${s?peopleNumbers([['得分',format(s.avgPoints)],['籃板',format(s.avgRebounds)],['助攻',format(s.avgAssists)],['場次',s.gamesPlayed]]):'<p>本季數據待核對</p>'}<details class="people-disclosure"><summary>詳細資料</summary><div class="people-disclosure-body"><div class="rookie-archive"><span>名單時間 ${fmt(p.rosterObservedAt)}${p.rosterStale?' · 舊資料 / Stale':''}</span>${link(p.rosterSource,'球隊名單')}</div><div class="rookie-current-title"><strong>本季數據 / ${esc(current?.season??'Season')}</strong><span>${s?`${s.gamesPlayed} 場 / GP`:'資料不足'}</span></div>${s?`<div class="rookie-stats">${numbers.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`:'<p class="fine-print">尚未取得可核對的本季數據。</p>'}<div class="rookie-card-foot"><a href="#player/nba/${encodeURIComponent(p.id)}">完整數據 / Player profile →</a><small>兩分命中率依累計命中與出手計算</small></div></div></details></article>`;}).join('')}</div>${peopleMore("rookie-more",limit,matches.length)}${!matches.length?empty(q?'沒有符合條件的球員':current?'目前沒有可確認本季出賽的球員':'本季出賽資料不可用，請稍後再試'):''}`;
 const more=$('#rookie-more');if(more)more.onclick=()=>{ui.rookieLimit=limit+24;renderRows();};
 };
 search.oninput=()=>{ui.rookieSearch=search.value;ui.rookieLimit=24;renderRows();};
 renderRows();
 document.querySelectorAll('[data-rookie-view]').forEach(button=>button.addEventListener('click',()=>{ui.rookieView=button.dataset.rookieView;ui.rookieLimit=24;rookies();}));
}

function archive(){
  const records=data.forecasts??[], backtests=data.backtests??[];
  $('#main').innerHTML=heading('MODEL ARCHIVE','模型研究存檔','')+
    `<p class="compact-note">研究存檔 · ${records.length} 份</p><div class="two-panels">${records.length?records.map(forecastCard).join(''):empty('暫無模型存檔')}</div>`+
    compactEvidence('原站回測與使用限制',`<p>以下數據來自原站研究存檔，仍待驗證賽前時間、傷病及名單。</p>${backtests.map(b=>`<p>${esc(b.source)} · ${fmt(b.updatedAt)} · 原站 ${b.summary.games??0} 場<br>本站尚未重新計算或獨立驗證。</p>`).join('')||'<p>暫無回測摘要。</p>'}`);
}

function sources(){
  const providers=data.sources.filter(s=>!s.aggregate), unresolved=data.unresolvedSchedule??[], reports=data.officialReports??[];
  $('#main').innerHTML=heading('SOURCE HEALTH','資料來源','')+infoBanner()+
    `<div class="source-grid">${providers.map(s=>`<article class="source-card compact-source-card">
      <div class="source-title"><h2>${esc(s.name)}</h2>${badge(s.status==='ok'?'可用':s.status==='partial'?'部分可用':'不可用',s.status==='ok'?'mint':s.status==='partial'?'amber':'danger')}</div>
      <div class="source-numbers"><strong>${s.usableEndpoints}<small> / ${s.totalEndpoints}</small></strong><span>有效請求</span></div>
      <div class="meter"><span style="--fill:${100*s.usableEndpoints/Math.max(s.totalEndpoints,1)}%"></span></div>
      ${compactEvidence('請求明細',`<p>${esc(s.role)}</p>${s.endpoints.map(r=>`<div class="endpoint"><strong>${esc(r.id)}</strong>
        <span>${esc(sourceStatus[r.status]??r.status)} · ${r.httpStatus??'—'} · ${r.recordCount} 筆 · ${(r.elapsedMs/1000).toFixed(2)} 秒</span>
        <small>${r.parseStatus==='failed'?esc(r.parseError):r.stale?'過期快取，排除新共識':r.error?esc(r.error):'解析完成'}${r.observedAt?' · 原觀測 '+fmt(r.observedAt):''}</small>
        ${link(r.url,'開啟來源')}<div class="hash">${esc(r.sha256??'本次沒有可用內容指紋')}</div></div>`).join('')}`)}
      </article>`).join('')}</div>`+
    compactEvidence(`未配對賽程 · ${unresolved.length} 筆`,`<p>與主要來源無法唯一配對的資料。</p><div class="table-wrap"><table><thead><tr><th>來源</th><th>日期（美東）</th><th>配對</th><th>原因</th></tr></thead><tbody>${unresolved.map(r=>`<tr><td>${link(r.reference,names[r.provider])}</td><td>${esc(r.date)}</td><td>${esc(teamText(r.away,r.league))} ＠ ${esc(teamText(r.home,r.league))}</td><td>${r.reason==='same_teams_multiple_games'?'同隊多場，無法唯一配對':'與主要賽程配對不符'}</td></tr>`).join('')||'<tr><td colspan="4">沒有未配對資料</td></tr>'}</tbody></table></div>`)+
    compactEvidence(`官方傷病報告 · ${reports.length} 份`,`<p>NBA 官方 PDF 索引，球員狀態須查看原報告。</p><div class="report-links">${reports.map(r=>link(r.url,r.label)).join('')}</div>`)+
    compactEvidence('球卡行情參考',`<p>尚未取得成交價格或匯入人氣排行。</p><div class="report-links">${link('https://www.psacard.com/auctionprices','PSA Auction Prices')}${link('https://www.130point.com/','130point')}${link('https://www.cardladder.com/','Card Ladder')}${link('https://www.sportscardinvestor.com/','Sports Card Investor')}</div>`)+
    compactEvidence('更新紀錄',`<p>頁面重新載入時會讀取最新快照。GitHub 專案擁有者可從更新流程手動執行。</p>${link('https://github.com/lolochen86-jpg/sports-lab/actions','開啟更新紀錄')}`);
}

function method(){
  $('#main').innerHTML=heading('METHOD','資料方法與限制','')+
    `<div class="compact-card-grid">
    <div class="compact-tile"><small>台灣預定更新</small><strong>07:00 · 14:00 · 21:00</strong></div>
    <div class="compact-tile"><small>單次請求上限</small><strong>10 秒</strong></div>
    <div class="compact-tile"><small>每輪蒐集預算</small><strong>90 秒</strong></div>
    </div>`+
    compactEvidence('蒐集與比對','<p>6 個並行工作，每次請求 10 秒，最多 2 次。403／401 不重試；429 依 Retry-After。程序鎖避免重疊。賽程比對聯盟、主客隊、時區與開賽時間。球員傷病以同隊完整姓名交叉比對，衝突保留各方資料。</p>')+
    compactEvidence('保存紀錄與發布','<p>來源保留觀測時間與 SHA-256。舊快取會明確標示，不納入新共識。蒐集、測試、建置及發布分段呈現。GitHub 排程可能延遲，實際資料時間以站上顯示為準。</p>')+
    compactEvidence('資料限制與研究模型',`<ul class="limitations">${data.limitations.map(v=>`<li>${esc(v)}</li>`).join('')}</ul><p>原站預測屬研究資料。本站尚無獨立校準命中率。</p>`);
}

function route(){clearTimeout(predictionTimer);const hash=location.hash.slice(1)||'overview';const part=hash.startsWith('playoffs/')?'playoffs':hash.startsWith('decline/')?'decline':hash.startsWith('improvement/')?'improvement':hash.startsWith('movements/')?'movements':hash.startsWith('player/')||hash==='rosters/mlb'?'rosters':hash.startsWith('game/')?'overview':hash.startsWith('rankings/')?'rankings':hash.startsWith('composite/')?'composite':hash;const labels={daily:'每日話題',playoffs:'季後賽衝刺榜',decline:'球員退步排行榜',improvement:'球員進步排行榜',movements:'球員換隊紀錄',overview:'總覽',predictions:'今日預測',dashboard:'數據儀表板',composite:'球員綜合平台',rankings:'各項排行榜',rosters:'球員資料庫',injuries:'傷病與出賽',rookies:'新人觀察',archive:'模型研究存檔',sources:'來源與比對',method:'方法與限制'};document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===part);a.setAttribute('aria-current',a.dataset.nav===part?'page':'false');});$('#breadcrumb').textContent=hash.startsWith('game/')?'賽事總覽 / 比對明細':labels[part]??'找不到頁面';if(hash.startsWith('playoffs/'))playoffPage();else if(hash.startsWith('decline/'))declinePage();else if(hash.startsWith('improvement/'))improvementPage();else if(hash.startsWith('movements/'))movementsPage();else if(hash==='rosters/mlb')renderMlbRoster(data.mlbRosterDatabase,mlbRosterContext());else if(hash.startsWith('player/')){const [,league,id]=hash.split('/');playerProfile(league,id);}else if(hash.startsWith('game/')){try{detail(decodeURIComponent(hash.slice(5)));}catch{detail('');}}else if(hash.startsWith('rankings/'))rankings();else if(hash.startsWith('composite/'))composite();else({overview,predictions,dashboard,rankings,composite,daily:dailyPage,playoffs:playoffPage,decline:declinePage,improvement:improvementPage,movements:movementsPage,rosters:rosterPage,injuries,rookies,archive,sources,method}[hash]??(()=>detail('')))();window.scrollTo(0,0);document.title=`${$('#breadcrumb').textContent}｜Sports Lab`;}
const load=createSnapshotRefresh({
 fetchSnapshot:async()=>{const response=await fetch('./data/dashboard.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('快照讀取失敗');return response.json();},
 apply:(next,previous)=>{const scroll=window.scrollY;const values=[...document.querySelectorAll('#main input[id],#main select[id]')].map(e=>[e.id,e.value,e.tagName]);data=next;if(!gameDates().includes(ui.date))ui.date=gameDates()[0];route();if(previous){for(const [id,value,tag] of values){const e=document.getElementById(id);if(e&&(tag!=='SELECT'||[...e.options].some(o=>o.value===value))){e.value=value;e.dispatchEvent(new Event(tag==='SELECT'?'change':'input'));}}window.scrollTo(0,scroll);}},
 status:snapshot=>{$('#freshness').textContent=`更新 ${fmt(snapshot.generatedAt)}`;$('#freshness').className=Date.now()-Date.parse(snapshot.generatedAt)>8*3600000?'stale':'current';},
 failed:(error,previous)=>{if(previous){$('#freshness').textContent=`更新檢查失敗 · 保留 ${fmt(previous.generatedAt)} 資料`;$('#freshness').className='stale';}else{$('#main').innerHTML=heading('DATA UNAVAILABLE','暫時無法讀取快照','請稍後重新載入，或檢查 GitHub 更新紀錄。');}}
});
$('#refresh').onclick=()=>load();window.addEventListener('hashchange',()=>data&&route());
setInterval(()=>{if(!document.hidden)load();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
window.addEventListener('online',()=>load());
await load();
