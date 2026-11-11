import {team, taipeiDate} from './providers.mjs';

export const DROP_SOURCE='https://thedropcoverage.com/data/games.json';
const MAX_AGE=8*60*60*1000;
const MAX_SCHEDULE_AGE=3*60*1000;
const names={'Atlanta':'ATL','Boston':'BOS','Brooklyn':'BKN','Charlotte':'CHA','Chicago':'CHI','Cleveland':'CLE','Dallas':'DAL','Denver':'DEN','Detroit':'DET','Golden State':'GSW','Houston':'HOU','Indiana':'IND','LA Clippers':'LAC','Los Angeles Clippers':'LAC','LA Lakers':'LAL','Los Angeles Lakers':'LAL','Memphis':'MEM','Miami':'MIA','Milwaukee':'MIL','Minnesota':'MIN','New Orleans':'NOP','New York':'NYK','Oklahoma City':'OKC','Orlando':'ORL','Philadelphia':'PHI','Phoenix':'PHX','Portland':'POR','Sacramento':'SAC','San Antonio':'SAS','Toronto':'TOR','Utah':'UTA','Washington':'WAS'};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const ids=(g,now,scheduledOnly=true)=>(g.observations??[]).filter(o=>o&&o.provider==='espn'&&!o.stale&&Number.isFinite(Date.parse(o.observedAt))&&Date.parse(o.observedAt)<=now&&now-Date.parse(o.observedAt)<=MAX_SCHEDULE_AGE&&(!scheduledOnly||o.status==='scheduled')&&/^\d+$/.test(String(o.sourceId??''))&&o.away===g.away&&o.home===g.home&&Date.parse(o.startAt)===Date.parse(g.startAt)).map(o=>String(o.sourceId));
const sourceOut=value=>Array.isArray(value)&&value.every(x=>typeof x==='string'&&x.length>0&&x.length<120)?value:null;
const pending=(g,reason)=>({gameId:g.id,league:g.league,away:g.away,home:g.home,startAt:g.startAt,status:'pending',reason,sourceUrl:DROP_SOURCE});

/** External forecast is retrieved from the provider's published public feed, not recalculated. */
export function parseDropForecasts(games, response, now=Date.now()){
 const sourceUpdated=Date.parse(response?.lastModified),observed=Date.parse(response?.observedAt);
 let data;try{data=JSON.parse(response?.body??'');}catch{return games.filter(g=>g.league==='NBA').map(g=>pending(g,'來源資料無法讀取'));}
 if(!Array.isArray(data?.games)||data.games.some(r=>!r||typeof r!=='object'||Array.isArray(r))||!/^\d{4}-\d\d-\d\d$/.test(data.slate_date??''))return games.filter(g=>g.league==='NBA').map(g=>pending(g,'來源賽程資料結構不完整'));
 const okTime=Number.isFinite(now)&&Number.isFinite(sourceUpdated)&&Number.isFinite(observed)&&sourceUpdated<=observed&&observed<=now&&now-sourceUpdated<=MAX_AGE&&observed-sourceUpdated<=MAX_AGE;
 const goodResponse=!!response?.body&&!response?.stale&&['live','cached'].includes(response?.status)&&response?.url===DROP_SOURCE&&/^[a-f0-9]{64}$/.test(response?.sha256??'');
 return games.filter(g=>g.league==='NBA').map(g=>{
  const start=Date.parse(g.startAt); if(g.status!=='scheduled'||!Number.isFinite(start)||start<=now)return pending(g,'比賽已開始或賽程狀態待確認');
  if(g.comparison==='stale_only'||g.comparison==='conflict'||(g.conflicts??[]).length)return pending(g,'賽程來源過期或衝突');
  if(!goodResponse||!okTime)return pending(g,'來源時間或資料不可確認，等待更新');
  if(sourceUpdated>=start||observed>=start)return pending(g,'來源時間不是賽前');
  const candidates=[...new Set(ids(g,now))]; if(candidates.length!==1)return pending(g,'賽程來源過期、缺少或無法核對賽事編號');
  const rows=data.games.filter(r=>String(r.event_id??'')===candidates[0]);if(rows.length!==1)return pending(g,'來源未提供唯一對應預測');
  const r=rows[0]; if(!names[r.home]||!names[r.away]||team(names[r.home])!==g.home||team(names[r.away])!==g.away||Date.parse(r.start)!==start)return pending(g,'來源對戰或開賽時間不符');
  if(!finite(r.p_home)||r.p_home<0||r.p_home>1||((r.pred_home!==null&&r.pred_home!==undefined)&&(!finite(r.pred_home)||r.pred_home<0))||((r.pred_away!==null&&r.pred_away!==undefined)&&(!finite(r.pred_away)||r.pred_away<0)))return pending(g,'來源預測數值無效或缺少勝率');
  const homeOut=sourceOut(r.out?.home),awayOut=sourceOut(r.out?.away);
  const referenceUrl=typeof r.url==='string'&&/^\/nba\/games\/[a-z0-9-]+\/$/.test(r.url)?`https://thedropcoverage.com${r.url}`:DROP_SOURCE;
  return {gameId:g.id,sourceEventId:candidates[0],league:'NBA',away:g.away,home:g.home,startAt:g.startAt,status:'available',provider:'The Drop Coverage',sourceUrl:DROP_SOURCE,referenceUrl,sourceUpdatedAt:new Date(sourceUpdated).toISOString(),observedAt:new Date(observed).toISOString(),sourceHash:response.sha256,slateDate:data.slate_date,homeWinProbability:r.p_home,awayWinProbability:1-r.p_home,expectedHome:r.pred_home??null,expectedAway:r.pred_away??null,homeOut,awayOut,archivedPregame:false};
 });
}
export async function collectDropForecasts(client,games,now=()=>Date.now()){
 const relevant=games.filter(g=>g.league==='NBA');if(!relevant.length)return [];
 if(!relevant.some(g=>g.status==='scheduled'&&Date.parse(g.startAt)>now()))return relevant.map(g=>pending(g,'比賽已開始或賽程狀態待確認'));
 let response;try{response=await client.get({id:'drop-coverage-games',provider:'dropcoverage',url:DROP_SOURCE,ttlMs:180000,maxStaleMs:0});}catch{return relevant.map(g=>pending(g,'來源取得失敗'));}
 return parseDropForecasts(relevant,response,now());
}
function validSaved(p){const updated=Date.parse(p?.sourceUpdatedAt),observed=Date.parse(p?.observedAt),start=Date.parse(p?.startAt);return p?.status==='available'&&p.league==='NBA'&&p.gameId&&p.home&&p.away&&p.home!==p.away&&/^\d+$/.test(String(p.sourceEventId??''))&&Number.isFinite(start)&&Number.isFinite(updated)&&Number.isFinite(observed)&&updated<=observed&&observed<start&&observed-updated<=MAX_AGE&&p.sourceUrl===DROP_SOURCE&&/^[a-f0-9]{64}$/.test(p.sourceHash??'')&&finite(p.homeWinProbability)&&p.homeWinProbability>=0&&p.homeWinProbability<=1&&finite(p.awayWinProbability)&&Math.abs(p.homeWinProbability+p.awayWinProbability-1)<1e-9&&(p.expectedHome===null||finite(p.expectedHome)&&p.expectedHome>=0)&&(p.expectedAway===null||finite(p.expectedAway)&&p.expectedAway>=0);}
function matchesCurrent(p,g,now){return g&&['scheduled','live','final'].includes(g.status)&&g.comparison!=='conflict'&&g.comparison!=='stale_only'&&!(g.conflicts??[]).length&&p.gameId===g.id&&p.league===g.league&&p.home===g.home&&p.away===g.away&&Date.parse(p.startAt)===Date.parse(g.startAt)&&ids(g,now,false).includes(String(p.sourceEventId));}
/** Keep verified past and future pregame source snapshots even during provider or schedule outages. */
export function retainExternalPredictions(current,previous,now=Date.now()){
 const saved=new Map(),games=new Map((current.games??[]).map(g=>[g.id,g]));
 // Previously verified snapshots are independently retained even if this run has missing or bad schedule data.
 for(const p of previous?.retainedExternalPredictions??[]){if(!validSaved(p))continue;const prior=saved.get(p.gameId);if(!prior||Date.parse(prior.observedAt)<Date.parse(p.observedAt))saved.set(p.gameId,p);}
 // New snapshots require a unique identity match to the current schedule. Never create a postgame snapshot.
 for(const p of [...(previous?.externalPredictions??[]),...(current?.externalPredictions??[])]){const g=games.get(p?.gameId);if(!validSaved(p)||!matchesCurrent(p,g,now))continue;const prior=saved.get(p.gameId);if(!prior||Date.parse(prior.observedAt)<Date.parse(p.observedAt))saved.set(p.gameId,p);}
 return [...saved.values()].map(p=>Date.parse(p.startAt)<=now?{...p,archivedPregame:true}:p);
}

