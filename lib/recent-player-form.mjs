import {pool} from './fetch.mjs';
import {compositeBoard,classifyExperience} from '../public/composite.js';
export function parseRecentPlayer(body,finals,at){
 const d=JSON.parse(body),stat=d.gameLog?.statistics?.find(x=>x.displayName==='totals');
 const fields=['points','totalRebounds','assists','steals','blocks','turnovers'];const idx=fields.map(n=>stat?.names?.indexOf(n)??-1),mi=stat?.names?.indexOf('minutes')??-1;if(mi<0||idx.some(i=>i<0)||!Array.isArray(stat.events))throw Error('近期球員紀錄欄位不足');
 const games=stat.events.flatMap(x=>{const e=finals.get(String(x.eventId)),v=idx.map(i=>Number(x.stats?.[i])),minutes=Number(String(x.stats?.[mi]??'').split(':')[0]);if(!e||Date.parse(e.date)>=Date.parse(at)||!Number.isFinite(minutes)||minutes<=0||v.some(n=>!Number.isFinite(n)||n<0))return [];return [{id:String(x.eventId),date:e.date,score:v[0]+1.2*v[1]+1.5*v[2]+2*v[3]+2*v[4]-v[5]}];}).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
 if(games.length<3)throw Error('少於三場可核對的當季例行賽');return {games:games.length,score:games.reduce((n,x)=>n+x.score,0)/games.length,gameIds:games.map(x=>x.id)};
}
export async function collectRecentForm(client,leaders,rosters,history,at){
 if(!leaders?.players?.length||leaders.stale||!history?.complete)return {status:'unavailable',reason:'當季比賽紀錄不足，無法驗證近期表現',rows:[]};
 const all=compositeBoard(classifyExperience(leaders.players,rosters));const selected=[...new Map([...all.slice(0,30),...all.filter(p=>p.yearClass==='rookie').slice(0,30),...all.filter(p=>p.yearClass==='sophomore').slice(0,30)].map(p=>[p.id,p])).values()];
 const finals=new Map(history.events.filter(e=>e.season?.year===leaders.seasonYear&&e.season?.type===2&&e.status?.type?.completed===true&&Date.parse(e.date)<Date.parse(at)).map(e=>[String(e.id),e]));
 const results=await pool(selected,async p=>{const url=`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${p.id}/overview`;try{const r=await client.get({id:'form-'+p.id,provider:'espn',url,ttlMs:3600000,maxStaleMs:0});if(!r.body||r.stale)throw Error(r.error||'來源不可用');return {id:p.id,...parseRecentPlayer(r.body,finals,at),source:url,observedAt:r.observedAt,sha256:r.sha256};}catch{return {id:p.id,error:'近期紀錄不足或來源不可用'};}},8);
 return {status:'available',scope:'綜合前30及合格一年級、二年級球員',requested:selected.length,rows:results.filter(x=>!x.error),missing:results.filter(x=>x.error).map(x=>x.id),observedAt:at};
}
