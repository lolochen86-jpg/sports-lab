import {nordbergCard} from './nordberg-prediction.js?v=20261111';
import {eloPredictionCard} from './elo-prediction.js?v=20261111';
import {playerImpactCard} from './player-impact.js?v=player-zh-20261111';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const taipeiDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
const day=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?taipeiDate.format(d):null;};
const time=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'未提供';
const nextDay=t=>Math.floor((t+8*3600000)/86400000)*86400000-8*3600000+86400000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const percent=x=>finite(x)&&x>=0&&x<=1?`${(100*x).toFixed(1)}%`:'—';
const score=x=>finite(x)&&x>=0?x.toFixed(1):'—';
const providerUrl=raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&['thedropcoverage.com','www.thedropcoverage.com'].includes(u.hostname)?u.href:null;}catch{return null;}};

// Select only identity-matched source records; never present an earlier own-model prediction as current.
export function selectPredictionDisplay(games,external,archived,league,now,retainedExternal=[]){
 const ts=Number(now),today=day(ts),tomorrow=day(nextDay(ts));if(!Number.isFinite(ts)||!today)return [];
 const eligible=(games??[]).filter(g=>g.league===league&&Number.isFinite(Date.parse(g.startAt))&&(day(g.startAt)===today||(day(g.startAt)===tomorrow&&Date.parse(g.startAt)>ts)));
 const counts=new Map();for(const g of eligible)counts.set(g.id,(counts.get(g.id)??0)+1);
 const identity=(p,g)=>p.gameId===g.id&&p.league===g.league&&p.away===g.away&&p.home===g.home&&Date.parse(p.startAt)===Date.parse(g.startAt);
 return eligible.map(g=>{
  const start=Date.parse(g.startAt),unique=counts.get(g.id)===1;
  const candidates=unique?(external??[]).filter(p=>identity(p,g)):[];
  const row=candidates.length===1?candidates[0]:null;
  const espnIds=new Set((g.observations??[]).filter(o=>o.provider==='espn'&&!o.stale&&o.league===g.league&&o.away===g.away&&o.home===g.home&&Date.parse(o.startAt)===start&&/^\d+$/.test(String(o.sourceId??''))).map(o=>String(o.sourceId)));
  const valid=p=>{const updated=Date.parse(p?.sourceUpdatedAt),observed=Date.parse(p?.observedAt);return espnIds.size===1&&/^\d+$/.test(String(p?.sourceEventId??''))&&espnIds.has(String(p.sourceEventId))&&p?.status==='available'&&Number.isFinite(updated)&&Number.isFinite(observed)&&updated<=observed&&observed-updated<8*3600000&&observed<=ts&&updated<start&&observed<start&&finite(p.homeWinProbability)&&p.homeWinProbability>=0&&p.homeWinProbability<=1&&finite(p.awayWinProbability)&&p.awayWinProbability>=0&&p.awayWinProbability<=1&&Math.abs(p.homeWinProbability+p.awayWinProbability-1)<1e-8&&!!providerUrl(p.sourceUrl);};
  // A live record must be a unique, unstarted and scheduled match.
  const stale=!!(row&&((ts-Date.parse(row.sourceUpdatedAt))>=8*3600000||(ts-Date.parse(row.observedAt))>=8*3600000));
  const current=!!(row&&g.status==='scheduled'&&g.comparison!=='conflict'&&g.comparison!=='stale_only'&&!(g.conflicts??[]).length&&start>ts&&valid(row)&&!stale);
  // Historical external results must have been collected before the match, never recreated after tipoff.
  const saved=unique&&start<=ts&&['scheduled','live','final'].includes(g.status)&&g.comparison!=='conflict'&&g.comparison!=='stale_only'&&!(g.conflicts??[]).length?(retainedExternal??[]).filter(p=>identity(p,g)&&valid(p)).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0]:null;
  const past=unique&&start<=ts&&['scheduled','live','final'].includes(g.status)&&g.comparison!=='conflict'&&g.comparison!=='stale_only'&&!(g.conflicts??[]).length?(archived??[]).filter(p=>p.status==='experimental'&&p.calibrated===false&&typeof p.historyHash==='string'&&p.historyHash&&identity(p,g)&&Number.isFinite(Date.parse(p.generatedAt))&&Date.parse(p.generatedAt)<start).sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt))[0]:null;
  return {game:g,forecast:current?row:saved?{...saved,archivedPregame:true}:null,reason:row?.status==='pending'?String(row.reason??'來源資料不足'):candidates.length>1?'來源資料重複、待確認':stale?'來源資料超過 8 小時，等待更新':null,archive:past?{...past,archivedPregame:true}:null};
 }).sort((a,b)=>Date.parse(a.game.startAt)-Date.parse(b.game.startAt));
}
export function externalPredictionCard(forecast,reason,options={}){
 if(!forecast)return `<section class="provider-prediction-notice"><strong>外部預測暫不可用</strong><p>${esc(reason??'來源尚未提供可核對的賽前資料')}</p><a href="https://thedropcoverage.com/" target="_blank" rel="noopener noreferrer">查看 The Drop Coverage ↗</a></section>`;
 const gamePage=providerUrl(forecast.referenceUrl),source=providerUrl(forecast.sourceUrl),provider=source?`<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">The Drop Coverage ↗</a>`:'The Drop Coverage';
 const outs=arr=>Array.isArray(arr)?arr.length?arr.map(value=>{const name=typeof value==='string'?value:String(value?.name??'');const zh=options.playerName?.({name},forecast.league);return zh?`${esc(zh)} / ${esc(name)}`:esc(name);}).join('、'):'無列出':'未提供';
 return `<section class="provider-prediction-notice"><h3>${forecast.archivedPregame?'外部賽前存檔 / Archived':'外部研究預測 / The Drop Coverage'}</h3><div class="prediction-values"><div><span>客隊勝率</span><strong>${percent(forecast.awayWinProbability)}</strong><small>預估得分 ${score(forecast.expectedAway)}</small></div><div><span>主隊勝率</span><strong>${percent(forecast.homeWinProbability)}</strong><small>預估得分 ${score(forecast.expectedHome)}</small></div></div><p>來源：${provider} · 來源檔案更新 ${esc(time(forecast.sourceUpdatedAt))} · 網站取得 ${esc(time(forecast.observedAt))}（台灣時間）${gamePage?` · <a href="${esc(gamePage)}" target="_blank" rel="noopener noreferrer">來源賽事頁 ↗</a>`:''}</p><details><summary>來源列出的缺陣球員</summary><p>客隊：${outs(forecast.awayOut)}<br>主隊：${outs(forecast.homeOut)}</p><p>以來源檔案時間為準，仍須核對最新出賽狀態。</p></details><p>來源作者表示：球隊比分及勝率僅供參考，尚未納入其公開成績評分。傷病是否納入球隊模型未確認；逐節比分與完整公式未提供。</p></section>`;
}
export function renderPredictionDisplay({games,external,retainedExternal,archived,eloForecasts=[],retainedEloForecasts=[],playerImpactScenarios=[],retainedPlayerImpactScenarios=[],nordbergForecasts=[],retainedNordbergForecasts=[],league,now},options={}){
 const rows=selectPredictionDisplay(games,external,archived,league,now,retainedExternal),today=day(Number(now));if(!rows.length)return '<p>今天與明天暫無可確認賽事。</p>';
 const short=(code,l)=>esc(options.shortTeam?.(code,l)??code);
 return `<div class="prediction-grid">${rows.map(({game:g,forecast,reason,archive},i)=>`${i===0||day(rows[i-1].game.startAt)!==day(g.startAt)?`<h2 class="prediction-date-heading">${day(g.startAt)===today?'今天':'明天'} · ${esc(day(g.startAt))}</h2>`:''}<article class="prediction-card"><div class="forecast-top"><strong>${esc(g.league)} · ${esc(time(g.startAt))}</strong><span>${esc(({scheduled:'未開賽',live:'進行中',final:'已完賽',postponed:'延期',unknown:'未確認',conflict:'狀態衝突'})[g.status]??'未確認')}</span></div><div class="prediction-teams"><div>${options.teamLogo?.(g.away,g.league)??''}<strong>${short(g.away,g.league)}</strong><small>客隊 / Away</small></div><div>${options.teamLogo?.(g.home,g.league)??''}<strong>${short(g.home,g.league)}</strong><small>主隊 / Home</small></div></div>${playerImpactCard(g,playerImpactScenarios,now,options,retainedPlayerImpactScenarios)}${nordbergCard(g,nordbergForecasts,retainedNordbergForecasts,now,options)}${eloPredictionCard(g,eloForecasts,retainedEloForecasts,now)}${externalPredictionCard(forecast,reason,options)}${archive?`<details class="prediction-history"><summary>自設歷史模型（賽前存檔）</summary><p>這是未校準的舊模型紀錄，不代表目前預測。</p>${options.renderArchive?.(archive)??'<p>歷史紀錄可在模型研究存檔查看。</p>'}</details>`:''}</article>`).join('')}</div>`;
}
