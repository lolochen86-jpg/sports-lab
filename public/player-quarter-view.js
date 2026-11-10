import {seasonGameCandidates,parsePlayerQuarterGame} from './player-quarter-core.js?v=20261110';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fetchJson=async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`來源回應 ${response.status}`);return response.json();};
const gameUrl=id=>`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(id)}`;

export async function loadPlayerQuarterScores(playerId,seasonYear,{formatDate,shortTeam}){
 const target=()=>location.hash===`#player/nba/${playerId}`?document.getElementById('player-quarter-results'):null;
 const initial=target();if(!initial)return;
 if(!/^\d+$/.test(String(playerId))||!Number.isInteger(seasonYear)){initial.textContent='缺少可核對的球季資料，暫時無法顯示。';return;}
 const url=`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${encodeURIComponent(playerId)}/gamelog?season=${seasonYear}`;
 try{
  const doc=await fetchJson(url);const selected=seasonGameCandidates(doc,{seasonYear});const container=target();if(!container)return;
  if(selected.status!=='available'||!selected.games.length){container.innerHTML=`<p class="fine-print">${esc(selected.reason||'本季目前沒有可核對的出賽紀錄。')}</p>`;return;}
  let cursor=0;const rows=[];let busy=false;
  const draw=()=>{const out=target();if(!out)return;out.innerHTML=`<p class="fine-print">${esc(seasonYear-1)}–${esc(seasonYear)} 例行賽 · 逐場得分依 ESPN 逐球紀錄統計，並與整場紀錄核對。缺漏或不符標示待確認。<br>資料讀取 ${esc(formatDate(new Date().toISOString()))}（台灣時間） · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">球員賽程來源 ↗</a></p><div class="table-wrap player-quarter-table"><table><thead><tr><th>日期<br>Date</th><th>對手<br>Opponent</th><th>第 1 節<br>Q1</th><th>第 2 節<br>Q2</th><th>第 3 節<br>Q3</th><th>第 4 節<br>Q4</th><th>延長<br>OT</th><th>全場<br>Total</th><th>來源<br>Source</th></tr></thead><tbody>${rows.map(({game,result})=>result.status==='available'?`<tr><td>${esc(formatDate(result.date))}</td><td>${esc(shortTeam(result.opponent))}</td>${result.quarters.map(n=>`<td><strong>${esc(n)}</strong></td>`).join('')}<td>${result.overtime===null?'—':esc(result.overtime)}</td><td><strong>${esc(result.total)}</strong></td><td><a href="https://www.espn.com/nba/playbyplay/_/gameId/${encodeURIComponent(game.id)}" target="_blank" rel="noopener noreferrer">逐球 ↗</a></td></tr>`:`<tr><td>${esc(formatDate(game.date))}</td><td colspan="7">待確認：${esc(result.reason||'來源缺少資料')}</td><td><a href="https://www.espn.com/nba/playbyplay/_/gameId/${encodeURIComponent(game.id)}" target="_blank" rel="noopener noreferrer">來源 ↗</a></td></tr>`).join('')}</tbody></table></div><p class="fine-print">已檢查 ${cursor} / ${selected.games.length} 場；延長賽沒有發生時以「—」表示。${cursor<selected.games.length?'可繼續載入更早場次。':''}</p>${cursor<selected.games.length?`<button type="button" id="player-quarter-more" class="subtle" ${busy?'disabled':''}>${busy?'讀取中…':'載入更多場次 / Load more'}</button>`:''}`;const button=out.querySelector('#player-quarter-more');if(button)button.onclick=loadMore;};
  async function loadMore(){if(busy)return;busy=true;draw();const batch=selected.games.slice(cursor,cursor+5);const results=await Promise.all(batch.map(async game=>{try{return {game,result:parsePlayerQuarterGame(await fetchJson(gameUrl(game.id)),{eventId:game.id,playerId,seasonYear})};}catch{return {game,result:{status:'unavailable',reason:'來源無法讀取，請稍後再試'}};}}));if(!target())return;rows.push(...results);cursor+=batch.length;busy=false;draw();}
  await loadMore();
 }catch{const out=target();if(out)out.innerHTML='<p class="fine-print">球員逐場資料目前無法讀取，請稍後再試。</p>';}
}

