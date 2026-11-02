import {team,shiftDate} from './providers.mjs';
import {pool,sha} from './fetch.mjs';
export const MODEL='nba-recent-scores-baseline-v1';
// Collect a bounded 30-day window. Every day must be available; a partial history is not silently accepted.
export async function gatherHistory(client,date){
 const dates=Array.from({length:30},(_,i)=>shiftDate(date,i-30));
 const jobs=dates.map(day=>({id:`nba-history-${day}`,provider:'espn',date:day,url:`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${day.replaceAll('-','')}&limit=100`,ttlMs:86400000,maxStaleMs:0}));
 const results=await pool(jobs,async job=>{const r=await client.get(job);let events=[];let error=null;try{if(!r.body||r.stale)throw new Error(r.error||r.status);const body=JSON.parse(r.body);if(!Array.isArray(body.events)||body.events.length>=100)throw new Error('歷史資料缺少或可能截斷');events=body.events;}catch(e){error=e.message;}return {day:job.date,url:job.url,observedAt:r.observedAt??null,sha256:r.sha256??null,status:r.status,error,events};},6);
 const failures=results.filter(r=>r.error);return {complete:failures.length===0,failures:failures.map(r=>({day:r.day,status:r.status,error:r.error})),receipts:results.map(({events,...r})=>r),events:results.flatMap(r=>r.events)};
}
export function calculatePredictions(games,history,at=new Date().toISOString()){
 const cutoff=Date.parse(at);if(!Number.isFinite(cutoff))throw new Error('預測時間無效');
 const regular=history.events.filter(e=>e.season?.type===2&&e.status?.type?.completed===true&&Date.parse(e.date)<cutoff).flatMap(e=>{const c=e.competitions?.[0],a=c?.competitors?.find(x=>x.homeAway==='away'),h=c?.competitors?.find(x=>x.homeAway==='home'),as=Number(a?.score),hs=Number(h?.score);if(!a?.team?.abbreviation||!h?.team?.abbreviation||!Number.isFinite(as)||!Number.isFinite(hs)||as<=0||hs<=0)return [];return [{id:String(e.id),season:e.season.year,date:e.date,away:team(a.team.abbreviation),home:team(h.team.abbreviation),awayScore:as,homeScore:hs}];});
 const dedup=[...new Map(regular.map(x=>[x.id,x])).values()];
 return games.map(g=>{
  const basic={gameId:g.id,league:g.league,away:g.away,home:g.home,startAt:g.startAt,generatedAt:at,model:MODEL,calibrated:false};
  const pending=reason=>({...basic,status:'pending',reason});
  if(g.league!=='NBA')return pending('MLB 模型尚未完成驗證');
  if(g.status!=='scheduled'||Date.parse(g.startAt)<=cutoff)return pending('已開賽、已結束或賽事狀態待確認');
  if(g.sourceCount<2||g.conflicts?.length||g.comparison==='stale_only')return pending('賽程來源不足或有衝突');
  if(!history.complete)return pending('近期比分資料蒐集不完整');
  const d=new Date(g.startAt),season=d.getUTCFullYear()+(d.getUTCMonth()>=6?1:0);
  if(!g.observations?.some(o=>o.provider==='espn'&&!o.stale&&o.seasonType===2&&o.seasonYear===season))return pending('尚未確認當季例行賽身分');
  const rows=dedup.filter(x=>x.season===season&&Date.parse(x.date)<cutoff&&Date.parse(x.date)<Date.parse(g.startAt));
  const samples=t=>rows.flatMap(x=>x.away===t?[{for:x.awayScore,against:x.homeScore}]:x.home===t?[{for:x.homeScore,against:x.awayScore}]:[]);
  const a=samples(g.away),h=samples(g.home);if(a.length<3||h.length<3)return pending(`近期例行賽樣本不足：客隊 ${a.length} 場、主隊 ${h.length} 場（各需 3 場）`);
  const avg=rows.reduce((sum,x)=>sum+x.awayScore+x.homeScore,0)/(2*rows.length), shrink=(xs,k)=>(xs.reduce((sum,x)=>sum+x[k],0)+8*avg)/(xs.length+8);
  const away=(shrink(a,'for')+shrink(h,'against'))/2-.75,home=(shrink(h,'for')+shrink(a,'against'))/2+.75;
  // Deterministic Monte Carlo makes the stored result reproducible.
  let state=parseInt(sha(g.id).slice(0,8),16)>>>0,wins=0;const rnd=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return (state+.5)/4294967296;};
  for(let i=0;i<10000;i++){const z=Math.sqrt(-2*Math.log(rnd()))*Math.cos(2*Math.PI*rnd());if(home-away+12*Math.SQRT2*z>0)wins++;}
  return {...basic,status:'experimental',homeWinProbability:wins/10000,awayWinProbability:1-wins/10000,expectedHome:+home.toFixed(1),expectedAway:+away.toFixed(1),homeSamples:h.length,awaySamples:a.length,leagueSamples:rows.length,historyHash:sha(JSON.stringify(rows)),historySources:history.receipts.map(({day,url,observedAt,sha256})=>({day,url,observedAt,sha256})),limitations:['僅使用近 30 日本季例行賽完賽比分','未納入傷病、先發、輪替與上場時間','主場加分與波動假設尚未經獨立回測及校準'],inputGameIds:rows.map(x=>x.id)};
 });
}
