import {pool,sha} from './fetch.mjs';
import {team} from './providers.mjs';
const unresolved=new Set(['CONFLICT','QUESTIONABLE','DOUBTFUL','DAY_TO_DAY','PROBABLE','UNKNOWN']);
const uncertain=i=>unresolved.has(i.status)&&i.observations?.some(o=>!o.stale&&o.status!=='UNKNOWN');
function outId(i){if(i.status!=='OUT'||i.comparison==='conflict'||i.confirmedLineup)return null;const rows=i.observations.filter(o=>!o.stale&&o.status==='OUT');const espn=rows.find(o=>o.provider==='espn'&&/^\d+$/.test(o.playerId));return rows.length>=2&&new Set(rows.map(o=>o.provider)).size>=2?espn?.playerId??null:null;}
function minVal(x){if(typeof x==='string'&&/^\d+:\d\d$/.test(x)){const [a,b]=x.split(':').map(Number);return b<60?a+b/60:NaN;}return Number(x);}
export async function gatherInjuryEvidence(client,games,injuries,history,at){
 const relevant=new Set(games.filter(g=>g.status==='scheduled'&&Date.parse(g.startAt)>Date.parse(at)).flatMap(g=>[g.away,g.home]));
 const list=injuries.filter(i=>relevant.has(i.team)&&i.status==='OUT'&&outId(i));
 const ids=[...new Set(list.map(outId))];
 const rows=await pool(ids,async id=>{const url=`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/overview`;const r=await client.get({id:'player-log-'+id,provider:'espn',url,ttlMs:3600000,maxStaleMs:0});return {id,url,body:r.body,observedAt:r.observedAt,sha256:r.sha256,stale:r.stale,status:r.status};},6);
 const byId=new Map(rows.map(r=>[r.id,r]));
 const current=new Date(at),season=current.getUTCFullYear()+(current.getUTCMonth()>=6?1:0);
 const finals=new Map(history.events.filter(e=>e.season?.type===2&&e.season?.year===season&&e.status?.type?.completed===true&&Date.parse(e.date)<Date.parse(at)).map(e=>[String(e.id),e]));
 return Object.fromEntries(list.map(i=>{const id=outId(i),r=byId.get(id);let logs=[],error;try{if(!r?.body||r.stale)throw Error('球員紀錄取得失敗');const j=JSON.parse(r.body),stats=j.gameLog?.statistics?.find(s=>s.displayName==='totals');const mi=stats?.names?.indexOf('minutes'),pi=stats?.names?.indexOf('points');if(mi<0||pi<0||!Array.isArray(stats?.events))throw Error('球員紀錄欄位不足');for(const row of stats.events){const ev=finals.get(String(row.eventId));if(!ev)continue;const teams=ev.competitions?.[0]?.competitors??[];if(!teams.some(t=>team(t.team?.abbreviation)===i.team))continue;const minutes=minVal(row.stats?.[mi]),points=Number(row.stats?.[pi]);if(Number.isFinite(minutes)&&minutes>0&&Number.isFinite(points)&&points>=0)logs.push({eventId:String(row.eventId),minutes,points});}if(logs.length<3)throw Error(`可核對出賽僅 ${logs.length} 場，至少需 3 場`);}catch(e){error=e.message;}return [i.id,{player:i.player,team:i.team,espnId:id,source:r?.url??null,observedAt:r?.observedAt??null,sha256:r?.sha256??null,logs,error}];}));
}
export function compareInjuries(predictions,injuries,evidence,sourceOk,at){
 return predictions.map(p=>{
  const result={gameId:p.gameId,status:'pending',generatedAt:at,calibrated:false,model:'injury-scenario-v1'};
  if(p.status!=='experimental')return {...result,reason:'基準預測尚未成立'};
  if(!sourceOk)return {...result,reason:'傷病來源不完整或資料已過期'};
  const cases=injuries.filter(i=>[p.away,p.home].includes(i.team));
  const unknown=cases.filter(uncertain);const out=cases.filter(i=>i.status==='OUT');const missing=out.filter(i=>!outId(i)||!evidence[i.id]||evidence[i.id].error);const unresolvedPlayers=[...unknown.map(i=>({player:i.player,team:i.team,status:i.status})),...missing.map(i=>({player:i.player,team:i.team,status:i.status,detail:evidence[i.id]?.error??'未取得兩網站一致狀態或 ESPN 身分'}))];
  const matched=out.filter(i=>!missing.includes(i));
  if(unresolvedPlayers.length&&!matched.length)return {...result,reason:'球員狀態或近期紀錄不足，沒有可計算的缺陣資料',unresolved:unresolvedPlayers};
  const players=matched.map(i=>{const e=evidence[i.id],points=e.logs.reduce((n,x)=>n+x.points,0)/e.logs.length,minutes=e.logs.reduce((n,x)=>n+x.minutes,0)/e.logs.length;return {player:i.player,team:i.team,espnId:e.espnId,games:e.logs.length,minutes:+minutes.toFixed(1),points:+points.toFixed(1),adjustment:+(points*.25).toFixed(2),gameIds:e.logs.map(x=>x.eventId),source:e.source,observedAt:e.observedAt,sha256:e.sha256,injurySources:i.observations.filter(o=>!o.stale&&o.status==='OUT').map(o=>({provider:o.provider,observedAt:o.observedAt,reference:o.reference,sha256:o.sha256}))};});
  const lost=t=>Math.min(8,players.filter(x=>x.team===t).reduce((n,x)=>n+x.adjustment,0));const away=Math.max(0,p.expectedAway-lost(p.away)),home=Math.max(0,p.expectedHome-lost(p.home));let state=parseInt(sha(p.gameId).slice(0,8),16)>>>0,wins=0;const rnd=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return (state+.5)/4294967296;};for(let j=0;j<10000;j++){const z=Math.sqrt(-2*Math.log(rnd()))*Math.cos(2*Math.PI*rnd());if(home-away+12*Math.SQRT2*z>0)wins++;}
  return {...result,status:'experimental',coverage:unresolvedPlayers.length?'partial':'reported_out_only',unresolved:unresolvedPlayers,awayWinProbability:players.length?1-wins/10000:p.awayWinProbability,homeWinProbability:players.length?wins/10000:p.homeWinProbability,expectedAway:+away.toFixed(1),expectedHome:+home.toFixed(1),players,assumption:'將符合條件之缺陣球員近期場均得分的 25% 視為球隊得分損失，兩隊各上限 8 分；僅為未校準示範假設，未計防守及球員替代效應。',limitations:['舊比分可能已包含球員缺陣影響，有重複扣分風險','無傷病紀錄不等於確認出賽；沒有正式先發名單','傷病來源可能共用上游，並非獨立證實','未回測與校準，不能宣稱優於基準模型']};
 });
}
