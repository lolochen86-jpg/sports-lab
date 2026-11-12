import {seasonGameCandidates} from './player-quarter-core.js?v=20261110';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=(row,names,name)=>{const i=names.indexOf(name),v=i>=0?row.stats?.[i]:null;return typeof v==='string'&&v.trim()?v:'—';};

// ESPN separates preseason from regular season; only use rows belonging to the requested season.
export function parseNbaGameLog(doc,seasonYear){
 const selected=seasonGameCandidates(doc,{seasonYear});
 if(selected.status!=='available')return selected;
 const label=`${seasonYear-1}-${String(seasonYear).slice(-2)} Regular Season`;
 const regular=doc.seasonTypes.find(x=>x.displayName===label);
 const sourceRows=new Map(regular.categories.flatMap(x=>x.events).map(x=>[String(x.eventId),x]));
 const fields=['minutes','fieldGoalsMade-fieldGoalsAttempted','threePointFieldGoalsMade-threePointFieldGoalsAttempted','freeThrowsMade-freeThrowsAttempted','totalRebounds','assists','blocks','steals','turnovers','points'];
 const games=selected.games.map(g=>{const event=doc.events[g.id],row=sourceRows.get(g.id);if(!row||!['W','L'].includes(event.gameResult))return null;
  const stats=Object.fromEntries(fields.map(name=>[name,value(row,doc.names,name)]));
  return {id:g.id,date:g.date,opponent:event.opponent?.abbreviation??'',homeAway:event.atVs??'',result:event.gameResult,score:event.score??'',stats};
 }).filter(Boolean);
 return {status:'available',games};
}

export async function loadNbaGameLog(playerId,seasonYear,target,{shortTeam=x=>x}={}){
 if(!target)return;
 if(!/^\d+$/.test(String(playerId))||!Number.isInteger(seasonYear)){target.textContent='缺少可核對的球員或球季，無法載入逐場數據。';return;}
 target.innerHTML='<p class="fine-print">正在載入逐場數據…</p>';
 const url=`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${encodeURIComponent(playerId)}/gamelog?season=${seasonYear}&seasontype=2`;
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HTTP ${response.status}`);
  const parsed=parseNbaGameLog(await response.json(),seasonYear);if(parsed.status!=='available')throw Error(parsed.reason);
  if(!target.isConnected)return;
  const when=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'}).format(new Date());
  let expanded=false;
  const draw=()=>{
   const shown=expanded?parsed.games:parsed.games.slice(0,10);
   const rows=shown.map(g=>`<tr><td>${esc(g.date.slice(0,10))}</td><td>${esc(g.homeAway==='@'?'客場':g.homeAway==='vs'?'主場':'—')} ${esc(shortTeam(g.opponent))}</td><td>${esc(g.result==='W'?'勝':'負')} ${esc(g.score)}</td>${['minutes','points','totalRebounds','assists','steals','blocks','turnovers','fieldGoalsMade-fieldGoalsAttempted','threePointFieldGoalsMade-threePointFieldGoalsAttempted','freeThrowsMade-freeThrowsAttempted'].map(k=>`<td>${esc(g.stats[k])}</td>`).join('')}<td><a href="https://www.espn.com/nba/boxscore/_/gameId/${encodeURIComponent(g.id)}" target="_blank" rel="noopener noreferrer">來源 ↗</a></td></tr>`).join('');
   target.innerHTML=`<h3>比賽紀錄 / Game log</h3><p class="fine-print">${esc(seasonYear-1)}–${esc(seasonYear)} 例行賽 · 顯示 ${shown.length} / ${parsed.games.length} 場 · 日期依 ESPN 原始賽事日期 · 取得時間 ${esc(when)}（台灣時間） · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">ESPN 資料來源 ↗</a></p>${rows?`<div class="table-wrap"><table><thead><tr><th>日期</th><th>對手</th><th>結果</th><th>分鐘</th><th>得分</th><th>籃板</th><th>助攻</th><th>抄截</th><th>阻攻</th><th>失誤</th><th>投籃</th><th>三分</th><th>罰球</th><th>明細</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="fine-print">本季沒有可核對的出賽紀錄。</p>'}${parsed.games.length>10?`<button type="button" class="subtle" data-game-log-toggle aria-expanded="${expanded}">${expanded?'收合為最近 10 場':'查看本季全部比賽'}</button>`:''}`;
   const button=target.querySelector('[data-game-log-toggle]');if(button)button.onclick=()=>{expanded=!expanded;draw();};
  };
  draw();
 }catch{if(target.isConnected)target.innerHTML='<h3>最近比賽 / Recent games</h3><p class="fine-print">逐場數據目前無法讀取或球季無法核對，請稍後再試。</p>';}
}
