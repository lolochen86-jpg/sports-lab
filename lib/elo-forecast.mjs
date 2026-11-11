import {parseSeason,replay,winProb,PROVENANCE} from './elo.mjs';
import {pool} from './fetch.mjs';
const HOUR=3600000,DAY=86400000;
const isoDate=ms=>new Date(ms).toISOString().slice(0,10);
/** Before 07:00 Eastern do not assume prior US calendar-day games have finished. */
export function safeHistoryCutoff(now){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));const today=`${parts.year}-${parts.month}-${parts.day}`;return isoDate(Date.parse(today+'T00:00:00Z')-(Number(parts.hour)<7?DAY:0));}
const seasonLabel=end=>`${end-1}-${String(end).slice(-2)}`;
const shaOk=v=>/^[a-f0-9]{64}$/.test(v??'');
const seasonFor=timestamp=>{const d=new Date(timestamp);return d.getUTCFullYear()+(d.getUTCMonth()>=6?1:0);};
export async function collectElo(client,games,seed,now=()=>Date.now()){
 let at=now(),atIso=new Date(at).toISOString();const eligible=games.filter(g=>g.league==='NBA'),pending=(g,reason)=>({gameId:g.id,league:g.league,home:g.home,away:g.away,startAt:g.startAt,generatedAt:atIso,status:'pending',reason,model:'nba-elo-dobson-v1'});
 const scheduled=eligible.filter(g=>g.status==='scheduled'&&Date.parse(g.startAt)>at);if(!scheduled.length)return {forecasts:eligible.map(g=>pending(g,'比賽已開始或尚未確認')),status:{status:'not_requested',available:0,total:0}};
 const seasonEnd=seasonFor(scheduled[0].startAt);if(seasonEnd<2024||seasonEnd>2035)return {forecasts:eligible.map(g=>pending(g,'球季尚未支援')),status:{status:'unavailable',reason:'球季尚未支援'}};
 const needed=Array.from({length:seasonEnd-2023},(_,i)=>2024+i);
 try{
  const sources=await pool(needed.map(end=>({id:`elo-scores-${end}`,provider:'boxscorelab',season:seasonLabel(end),url:`https://www.boxscorelab.com/downloads/${seasonLabel(end)}-team-game-results.csv`,ttlMs:end===seasonEnd?HOUR:DAY,maxStaleMs:0})),async job=>({job,response:await client.get(job)}),4);at=now();atIso=new Date(at).toISOString();
  if(seed?.seasonEnd!==2023||Object.keys(seed?.ratings??{}).length!==30)throw Error('初始評分資料不完整');const sets=[];
  for(const {job,response:r} of sources){if(!r.body||r.stale||!['live','cached'].includes(r.status)||!shaOk(r.sha256)||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>at||at-Date.parse(r.observedAt)>36*HOUR)throw Error(`${job.season} 來源不可用或逾期`);const entries=parseSeason(r.body,job.season);if(job.season!==seasonLabel(seasonEnd)){const counts={};for(const g of entries){counts[g.home]=(counts[g.home]??0)+1;counts[g.away]=(counts[g.away]??0)+1;}if(entries.length!==1230||Object.keys(counts).length!==30||Object.values(counts).some(n=>n!==82))throw Error(`${job.season} 賽果不完整`);}sets.push({season:job.season,games:entries,sha256:r.sha256,url:job.url,observedAt:r.observedAt});}
  sets.sort((a,b)=>a.season.localeCompare(b.season));const cutoff=safeHistoryCutoff(at),all=sets.flatMap(s=>s.games),snapshot=replay({seed,games:all,cutoff,backtestFrom:'2023-10-01'});
  const current=sets.find(x=>x.season===seasonLabel(seasonEnd));const through=current?.games.filter(g=>g.date<cutoff).at(-1)?.date;if(!through||snapshot.lastDate!==through||Date.parse(cutoff)-Date.parse(through)>3*DAY)throw Error('近期賽果尚未完整更新');
  const sourceReceipts=sets.map(s=>({season:s.season,url:s.url,observedAt:s.observedAt,sha256:s.sha256,games:s.games.length}));
  const out=eligible.map(g=>{
   const start=Date.parse(g.startAt);if(g.status!=='scheduled'||!Number.isFinite(start)||start<=at)return pending(g,'比賽已開賽或賽程待確認');
   if(g.comparison==='stale_only'||g.comparison==='conflict'||(g.conflicts??[]).length)return pending(g,'賽程有衝突或已過期');
   if(seasonFor(g.startAt)!==seasonEnd||snapshot.seasonEnd!==seasonEnd)return pending(g,'尚無本季有效評分');
   const obs=(g.observations??[]).filter(o=>o.provider==='espn'&&!o.stale&&o.status==='scheduled'&&o.away===g.away&&o.home===g.home&&Date.parse(o.startAt)===start&&o.seasonType===2&&o.seasonYear===seasonEnd&&typeof o.neutralSite==='boolean'&&Number.isFinite(Date.parse(o.observedAt))&&Date.parse(o.observedAt)<=at&&at-Date.parse(o.observedAt)<3*60*1000);
   if(!obs.length||new Set(obs.map(o=>o.neutralSite)).size!==1)return pending(g,'賽程身分或中立場地尚未確認');
   const neutral=obs[0].neutralSite,home=snapshot.ratings[g.home],away=snapshot.ratings[g.away];if(!Number.isFinite(home)||!Number.isFinite(away))return pending(g,'球隊評分缺少');const p=winProb(home,away,neutral);
   return {gameId:g.id,league:'NBA',home:g.home,away:g.away,startAt:g.startAt,generatedAt:atIso,status:'experimental',calibrated:false,homeWinProbability:p,awayWinProbability:1-p,eloHome:home,eloAway:away,homeAdvantage:neutral?0:100,neutral,historyThrough:through,historyCutoff:cutoff,observedAt:obs[0].observedAt,scoreDataObservedAt:current.observedAt,sourceReceipts,model:'nba-elo-dobson-v1',modelSource:PROVENANCE.method,historicalDataSource:PROVENANCE.data,limitations:PROVENANCE.caveat};
  });
  return {forecasts:out,status:{status:'ok',available:out.filter(p=>p.status==='experimental').length,total:scheduled.length,historyThrough:through,scoreDataObservedAt:current.observedAt,sources:sourceReceipts}};
 }catch(e){return {forecasts:eligible.map(g=>pending(g,String(e.message??e))),status:{status:'unavailable',reason:String(e.message??e),available:0,total:scheduled.length}};}
}
/** Preserve only previously generated pregame forecasts, including during outages. */
export function retainElo(previous,current,now=Date.now()){
 const saved=new Map();for(const p of [...(previous?.retainedEloForecasts??[]),...(previous?.eloForecasts??[]),...(current?.eloForecasts??[])]){
  if(p?.model!=='nba-elo-dobson-v1'||p.status!=='experimental'||p.league!=='NBA'||!p.gameId||!p.home||!p.away||p.home===p.away||!Number.isFinite(p.homeWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||!Number.isFinite(Date.parse(p.generatedAt))||Date.parse(p.generatedAt)>=Date.parse(p.startAt))continue;
  const old=saved.get(p.gameId);if(!old||Date.parse(p.generatedAt)>Date.parse(old.generatedAt))saved.set(p.gameId,p);
 }return [...saved.values()];
}
