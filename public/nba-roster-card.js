import {nbaRosterSeason,nbaRosterStatValues} from './nba-roster-stats.js?v=20261112';

const esc=(s='')=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const old=(at,now,limit=86400000)=>{const t=Date.parse(at);return !Number.isFinite(t)||t>now||now-t>limit;};
const injuryNames={OUT:'缺陣',SUSPENDED:'停賽',DOUBTFUL:'出賽存疑',QUESTIONABLE:'出賽待定',PROBABLE:'可能出賽',DAY_TO_DAY:'每日觀察',AVAILABLE:'可出賽',CONFLICT:'來源衝突',UNKNOWN:'待核對'};

// Only a same-team, ESPN-ID observation can identify a roster player.
const fullName=x=>String(x??'').trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('en-US');
export function nbaInjuryWarning(player,injuries,now=Date.now(),rosterPlayers=[]){
 const matches=(injuries??[]).filter(i=>i.team===player.team&&(i.observations??[]).some(o=>o.provider==='espn'&&String(o.playerId)===String(player.id)));
 if(matches.length>1)return '傷病資料身分待核對';
 const i=matches[0];
 if(!i){
  const name=fullName(player.name);if(!name)return null;
  const rosterMatches=rosterPlayers.filter(p=>p.team===player.team&&fullName(p.name)===name);
  const named=(injuries??[]).filter(row=>row.team===player.team&&fullName(row.player)===name);
  if(rosterMatches.length!==1||named.length!==1)return null;
  const ids=(named[0].observations??[]).filter(o=>o.provider==='espn'&&o.playerId).map(o=>String(o.playerId));
  if(ids.some(id=>id!==String(player.id)))return null;
  return '傷病資料待核對';
 }
 const observations=(i.observations??[]).filter(o=>o.provider==='espn'&&String(o.playerId)===String(player.id));
 if(observations.every(o=>o.stale||old(o.observedAt,now,8*3600000)))return '傷病資料過期';
 if(i.comparison==='conflict'||i.status==='CONFLICT')return '傷病來源衝突';
 if(!i.status||i.status==='UNKNOWN')return '傷病狀態待核對';
 return i.status==='AVAILABLE'?null:`傷病：${injuryNames[i.status]??'待核對'}`;
}

export function renderNbaRosterCard(p,{data,now=Date.now(),playerName,teamLogo,shortTeam,teamText,positions,formatTime,link}){
 const found=nbaRosterSeason(data,p.id),source=found?.source,stats=found?.player?.stats;
 const values=stats?nbaRosterStatValues(stats):[], keys=['得分 / PTS','籃板 / REB','助攻 / AST','投籃 / FG%'];
 const score=p.rosterRating,sign=score?.impact>0?'+':'';
 const rosterOld=p.rosterSource?.stale||old(p.rosterSource?.observedAt,now),statsOld=source&&(source.stale||old(source.observedAt,now));
 const mismatch=found?.player?.team&&p.team&&shortTeam(found.player.team)!==shortTeam(p.team);
 const teamRoster=(data.rosterDatabase?.teams??[]).filter(t=>t.team===p.team).flatMap(t=>t.players??[]);
 const injury=nbaInjuryWarning(p,data.injuries,now,teamRoster);
 const injuryEntries=(data.injuries??[]).filter(i=>i.team===p.team&&(i.observations??[]).some(o=>o.provider==='espn'&&String(o.playerId)===String(p.id)));
 const injuryObservations=injuryEntries.length===1?injuryEntries[0].observations??[]:[];
 const warnings=[rosterOld?'名單資料過期':null,statsOld?'球季數據過期':null,mismatch?'統計球隊與名單不同，待核對':null,injury].filter(Boolean);
 const team=(data.teamDashboard?.teams??[]).find(x=>x.team===p.team);
 const validRecord=team&&team.seasonType==='Regular Season'&&team.seasonYear===data.leaderboards?.nba?.seasonYear&&team.record;
 const recordOld=validRecord&&(team.stale||old(team.observedAt,now));
 const meta=[positions[p.position]??p.position??'位置待確認',p.height??'身高待確認',Number.isFinite(p.age)?`${p.age} 歲`:'年齡待確認',stats&&Number.isFinite(stats.gamesPlayed)?`${stats.gamesPlayed} 場`:'場次待確認'].map(esc).join(' · ');
 return `<article class="roster-card">
  <div class="roster-compact-head"><a href="#player/nba/${encodeURIComponent(p.id)}" aria-label="查看 ${esc(p.name)} 球員資料"><img src="https://a.espncdn.com/i/headshots/nba/players/full/${encodeURIComponent(p.id)}.png" alt="${esc(p.name)} 球員頭像" loading="lazy" onerror="this.hidden=true"></a><div><strong>${esc(playerName(p))} <span class="jersey-number">#${esc(p.jersey??'—')}</span></strong><small>${esc(p.name)}</small></div></div>
  <div class="roster-compact-meta"><span title="${esc(teamText(p.team))}">${teamLogo(p.team)} <strong>${esc(shortTeam(p.team))}</strong>${validRecord?` · ${esc(team.record)}${recordOld?'（舊）':''}`:''}</span><span>${meta}</span></div>
  <div class="roster-compact-score">${score?`<span>第 ${p.rosterRank} 名</span><strong>${esc(score.grade)}</strong><span>在場影響 ${esc(sign+score.impact.toFixed(2))}</span>`:`<strong>待評</strong><span>${esc(p.rosterRatingReason??'評分資料不足')}</span>`}</div>
  ${stats?`<div class="roster-compact-stats">${keys.map(k=>{const value=values.find(v=>v[0]===k)?.[1]??'—';return `<div><strong>${esc(value)}</strong><span>${esc(k.replace(' / ',' '))}</span></div>`;}).join('')}</div>`:'<p class="roster-compact-warning">本季數據待確認</p>'}
  ${warnings.length?`<p class="roster-compact-warning">${esc(warnings.join(' · '))}</p>`:''}
  <a class="roster-compact-link" href="#player/nba/${encodeURIComponent(p.id)}">查看完整球員數據 →</a>
  <details class="roster-compact-details"><summary>資料來源與時間</summary><p>名單：ESPN · ${esc(formatTime(p.rosterSource?.observedAt))}${rosterOld?' · 舊資料':''} · ${link(p.rosterSource?.source,'名單來源')}</p>
   ${source?`<p>球季數據：${esc(source.season)} · ESPN · ${esc(formatTime(source.observedAt))}${statsOld?' · 舊資料':''} · ${link(source.source,'數據來源')}</p>`:'<p>球季數據尚未取得。</p>'}
   <p>評分資料：SportsDataverse · ${esc(formatTime(data.nbaPlayerRatings?.observedAt))} · ${link(data.nbaPlayerRatings?.method,'評分方法')} · ${link(data.nbaPlayerRatings?.source,'評分資料')}</p>
   ${validRecord?`<p>球隊戰績：${esc(formatTime(team.observedAt))}${recordOld?' · 舊資料':''} · ${link(team.source,'球隊數據來源')}</p>`:''}
   ${injuryObservations.map(o=>`<p>傷病：${esc(injuryNames[o.status]??'待核對')} · ${esc(formatTime(o.observedAt))}${o.stale||old(o.observedAt,now,8*3600000)?' · 舊資料':''} · ${link(o.reference,o.provider??'傷病來源')}</p>`).join('')}
   <p>${link(p.profile,'ESPN 球員頁')}</p></details>
 </article>`;
}
