import {team} from './providers.mjs';
export function parseConferenceStandings(body,year){
 const d=JSON.parse(body);if(d.season?.year!==year||!Array.isArray(d.children)||d.children.length!==2)throw Error('NBA 球季或分區格式不符');
 const groups=d.children.map(g=>{const name=g.name;if(!['Eastern Conference','Western Conference'].includes(name)||!Array.isArray(g.standings?.entries)||g.standings.entries.length!==15)throw Error('NBA 分區不完整');const rows=g.standings.entries.map(e=>{const stats=Object.fromEntries((e.stats??[]).map(s=>[s.name,s]));const wins=stats.wins?.value,losses=stats.losses?.value,pct=stats.winPercent?.value,code=team(e.team?.abbreviation??'');if(!code||!Number.isInteger(wins)||!Number.isInteger(losses)||!Number.isFinite(pct)||wins<0||losses<0)throw Error('NBA 戰績不完整');return {team:code,wins,losses,pct,streak:stats.streak?.displayValue??null,lastTen:stats['Last Ten Games']?.summary??null};});if(new Set(rows.map(r=>r.team)).size!==15)throw Error('NBA 分區球隊重複');return {name,rows};});
 if(new Set(groups.map(g=>g.name)).size!==2)throw Error('NBA 分區重複');return {season:d.season.displayName,seasonYear:year,groups};
}
export async function collectPlayoffRace(client,year,previous){
 if(!Number.isInteger(year))return previous?{...previous,stale:true,error:'無法確認球季'}:{stale:true,error:'無法確認球季'};
 const url=`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?region=us&lang=en&season=${year}&seasontype=2`;
 try{const r=await client.get({id:'nba-conference-standings',provider:'espn',url,ttlMs:3600000,maxStaleMs:0});if(!r.body||r.stale)throw Error(r.error??'戰績資料不可用');return {...parseConferenceStandings(r.body,year),source:url,observedAt:r.observedAt,sha256:r.sha256,stale:false};}catch(e){return previous?.seasonYear===year?{...previous,stale:true,error:e.message}:{stale:true,error:e.message};}
}
