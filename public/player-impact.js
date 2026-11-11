// A lineup scenario is distinct from a calibrated pregame win forecast.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const MODEL='sportsdataverse-rapm-minute-weighted-v1';
const MAX_AGE=24*60*60*1000;
const fmt=x=>Number.isFinite(Date.parse(x))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x)):'未提供';
const num=x=>finite(x)?x.toFixed(2):'—';
const safeSource=raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&['espn.com','www.espn.com','site.web.api.espn.com','www.cbssports.com','www.rotowire.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
const injurySources=rows=>(Array.isArray(rows)?rows:[]).map(o=>{const url=safeSource(o.reference??o.sourceUrl??o.url);return url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(o.provider??'傷病來源')} ↗</a>`:'';}).filter(Boolean).join(' · ');
const same=(p,g)=>p.gameId===g.id&&p.league==='NBA'&&p.home===g.home&&p.away===g.away&&Date.parse(p.startAt)===Date.parse(g.startAt);
const statusName={unreported_assumption:'未通報，假設可出賽',unknown_assumption:'狀態不明，暫按可出賽試算',questionable_assumption:'出賽成疑，暫按可出賽試算',conflict_assumption:'來源衝突，暫按可出賽試算',reported_out:'來源通報缺陣',confirmed_out:'已列缺陣',confirmed_in:'已確認可出賽',season_estimate:'季前可出賽估計',manual_scenario:'情境假設'};
function validTeam(t,team,at){
 if(!t||t.team!==team||t.status!=='scenario'||!finite(t.teamStrength)||!finite(t.rawTotal)||t.rawTotal<=0||!Array.isArray(t.rotation)||!t.rotation.length)return false;
 if(!Number.isFinite(Date.parse(t.asOf))||Date.parse(t.asOf)>at)return false;
 const ids=new Set();let mins=0,total=0;
 for(const p of t.rotation){
  if(!p||!/^\d+$/.test(String(p.id??''))||ids.has(String(p.id))||typeof p.name!=='string'||!p.name||!Object.hasOwn(statusName,p.availabilityType)||!finite(p.availability)||p.availability<0||p.availability>1||!finite(p.minutesIfAvailable)||p.minutesIfAvailable<0||!finite(p.allocatedMinutes)||p.allocatedMinutes<0||!finite(p.contribution))return false;
  if(['confirmed_out','reported_out'].includes(p.availabilityType)&&(p.availability!==0||p.allocatedMinutes!==0))return false;
  if(p.allocatedMinutes>0&&(!finite(p.rating)||Math.abs(p.contribution-p.allocatedMinutes*p.rating/48)>1e-8))return false;
  if(p.allocatedMinutes===0&&p.contribution!==0)return false;
  ids.add(String(p.id));mins+=p.allocatedMinutes;total+=p.contribution;
 }
 return Math.abs(mins-240)<1e-6&&Math.abs(total-t.teamStrength)<1e-6;
}
function validArchiveReceipts(t,generated){
 const validReceipt=r=>!!r&&!r.stale&&Number.isFinite(Date.parse(r.observedAt))&&Date.parse(r.observedAt)<=generated&&typeof r.sha256==='string'&&/^[0-9a-f]{64}$/i.test(r.sha256);
 if(!validReceipt(t.ratingReceipt)||!validReceipt(t.crosswalkReceipt)||!validReceipt(t.rosterReceipt)||!Array.isArray(t.injurySources)||t.injurySources.length<2||!t.injurySources.every(validReceipt))return false;
 return [...t.rotation,...(Array.isArray(t.outPlayers)?t.outPlayers:[])].every(p=>!p.injurySources||Array.isArray(p.injurySources)&&p.injurySources.every(validReceipt));
}
export function selectPlayerImpactScenario(game,scenarios=[],now=Date.now(),retained=[]){
 if(game?.league!=='NBA')return {scenario:null,reason:null};
 const t=Number(now),start=Date.parse(game.startAt),before=start>t;
 if(!Number.isFinite(t)||!Number.isFinite(start)||before&&game.status!=='scheduled'||!before&&!['scheduled','live','final'].includes(game.status))return {scenario:null,reason:'此場沒有可顯示的賽前球員情境'};
 if(game.comparison==='conflict'||game.comparison==='stale_only'||(game.conflicts??[]).length)return {scenario:null,reason:'賽事資料衝突或過期'};
 const rows=(before?scenarios:retained).filter(p=>same(p,game));
 if(rows.length!==1)return {scenario:null,reason:rows.length?'球員資料重複，等待核對':before?'球員資料尚未建立':'沒有保存此場的賽前球員情境'};
 const p=rows[0],generated=Date.parse(p.generatedAt);
 if(p.status==='pending')return {scenario:null,reason:p.reason??'球員資料待確認'};
 if(p.status!=='scenario'||p.model!==MODEL||!Number.isFinite(generated)||generated>t||generated>=start||before&&t-generated>MAX_AGE||!validTeam(p.homeTeam,game.home,generated)||!validTeam(p.awayTeam,game.away,generated)||!before&&(!validArchiveReceipts(p.homeTeam,generated)||!validArchiveReceipts(p.awayTeam,generated)))return {scenario:null,reason:'球員資料過期或尚未通過核對'};
 return {scenario:p,archived:!before,reason:null};
}
export function playerImpactCard(game,scenarios,now,options={},retained=[]){
 if(game?.league!=='NBA')return '';
 const {scenario:p,archived,reason}=selectPlayerImpactScenario(game,scenarios,now,retained);
 if(!p)return `<section class="provider-prediction-notice"><h3>球員陣容情境</h3><p>待確認：${escapeHtml(reason)}</p></section>`;
 const teamName=code=>escapeHtml(options.shortTeam?.(code,'NBA')??code);
 const bilingual=x=>{const name=x.name??x.player??'';const zh=options.playerName?.({name,id:x.id});return zh?`${escapeHtml(zh)} / ${escapeHtml(name)}`:escapeHtml(name);};
 const oneTeam=t=>{
  const rows=t.rotation.map(x=>{const zh=options.playerName?.(x)??'';const label=zh?`${escapeHtml(zh)} / ${escapeHtml(x.name)}`:escapeHtml(x.name);const sources=injurySources(x.injurySources);return `<tr><th scope="row">${label}<small>${escapeHtml(statusName[x.availabilityType])}${sources?` · ${sources}`:''}</small></th><td>${num(x.rating)}</td><td>${num(x.minutesIfAvailable)}</td><td>${num(x.allocatedMinutes)}</td><td>${num(x.contribution)}</td></tr>`;}).join('');
  const out=Array.isArray(t.outPlayers)&&t.outPlayers.length?`<p>來源通報缺陣：${t.outPlayers.map(x=>`${bilingual(x)}${injurySources(x.injurySources)?`（${injurySources(x.injurySources)}）`:''}`).join('、')}</p>`:'';
  const c=t.coverage??{}, un=Array.isArray(c.unmatchedPlayers)?c.unmatchedPlayers:[], missing=Array.isArray(c.rosterMissing)?c.rosterMissing:[];
  const pct=finite(c.matchedMinutes)&&finite(c.allMinutes)&&c.allMinutes>0?`${(100*c.matchedMinutes/c.allMinutes).toFixed(1)}%`:'未提供';
  const incomplete=un.length||missing.length?`<details><summary>未納入的球員與原因</summary>${un.length?`<p>當季有紀錄但無法核對：${un.map(x=>`${bilingual(x)}（${escapeHtml(x.reason)}）`).join('、')}</p>`:''}${missing.length?`<p>現役名單缺可核對資料：${missing.map(x=>`${bilingual(x)}（${escapeHtml(x.reason)}）`).join('、')}</p>`:''}</details>`:'';
  const coverage=`<p>本季資料與現役名單核對 ${Number.isInteger(c.eligible)?c.eligible:'—'} 人 · 已匹配球員場均分鐘總和占當季資料 ${pct}；名單無當季資料者不在此比例分母。</p>`;
  return `<section><h4>${teamName(t.team)} · ${num(t.teamStrength)}</h4>${coverage}${incomplete}${out}<div class="table-wrap"><table><thead><tr><th>球員 / 狀態</th><th>影響評分</th><th>本季場均分鐘</th><th>分配分鐘</th><th>貢獻</th></tr></thead><tbody>${rows}</tbody></table></div><p>球隊影響 = Σ（球員影響評分 × 分配分鐘 ÷ 48）= ${num(t.teamStrength)}</p><p>評分：${escapeHtml(t.ratingFamily??'未提供')} · 評分資料取得 ${escapeHtml(fmt(t.ratingReceipt?.observedAt))} · 球員名單取得 ${escapeHtml(fmt(t.rosterReceipt?.observedAt))}（台灣時間）</p></section>`;
 };
 return `<section class="provider-prediction-notice"><h3>${archived?'球員陣容賽前情境存檔':'球員陣容影響情境'}</h3><p>客隊 ${teamName(game.away)} ${num(p.awayTeam.teamStrength)} · 主隊 ${teamName(game.home)} ${num(p.homeTeam.teamStrength)}</p><p>${archived?'賽前計算':'計算'}時間 ${escapeHtml(fmt(p.generatedAt))}（台灣時間）${archived?' · 保留原賽前資料':''}</p><details><summary>展開球員、分鐘與計算</summary><p>上場時間以本季場均作參考並分配至全隊 240 分鐘；未通報傷病不代表確認健康，缺陣與衝突依資料來源標示。</p>${oneTeam(p.awayTeam)}${oneTeam(p.homeTeam)}<p>這是不同球員評分資料套用公開的分鐘加權方法，並非原作者的完整勝率模型；尚未完成校準，不提供勝率。</p><p><a href="https://evanz.github.io/nba-lineup-model/rotation-models/win-projections/" target="_blank" rel="noopener noreferrer">分鐘加權方法 ↗</a> · <a href="https://hoopr.sportsdataverse.org/articles/nba-player-impact-model.html" target="_blank" rel="noopener noreferrer">球員影響資料 ↗</a></p></details></section>`;
}
