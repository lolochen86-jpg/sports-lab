// Independent refit of Tyler Nordberg's MIT-licensed last-10 logistic model.
// Features and order follow https://github.com/tylernordberg0/nba-game-predictor.
// Team game histories use CC BY 4.0 BoxScore Lab; no injuries or rotations.
import {parseCSV} from './player-impact-forecast.mjs';
import {safeHistoryCutoff} from './elo-forecast.mjs';
import {team as normalTeam} from './providers.mjs';
import {pool} from './fetch.mjs';
const HOUR=3600000, DAY=24*HOUR;
export const SOURCE='https://github.com/tylernordberg0/nba-game-predictor';
export const DATA_SOURCE='https://www.boxscorelab.com/downloads/';
export const MODEL='nordberg-last10-logit-refit-v1';
const COLS=['point_diff','efg','ast_to','ftr','offensive_rebounds','defensive_rebounds'];
const num=(s)=>s!==''&&s!=null&&Number.isFinite(Number(s))?Number(s):NaN;
const time=(s)=>Date.parse(s);
const seasonEnd=t=>{const d=new Date(t);return d.getUTCFullYear()+(d.getUTCMonth()>=6?1:0);};
const seasonName=y=>`${y-1}-${String(y).slice(-2)}`;
export function parseTeamResults(text,season){
 const rows=parseCSV(text);if(!rows.length)throw Error('賽果資料為空');
 const byKey=new Map(),counts={};
 for(const r of rows){
  const team=normalTeam(r.team),opp=normalTeam(r.opponent),date=r.game_date;
  if(r.season!==season||!r.team||!r.opponent||!/^[A-Z]{2,3}$/.test(team)||!/^[A-Z]{2,3}$/.test(opp)||team===opp||!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(time(date)))throw Error('賽果隊伍或日期錯誤');
  const n=['points','opponent_points','point_diff','field_goals_made','field_goal_attempts','three_point_makes','free_throw_attempts','offensive_rebounds','defensive_rebounds','assists','turnovers'].map(k=>num(r[k]));
  if(n.some(v=>!Number.isFinite(v))||n[0]<0||n[1]<0||n[2]!==n[0]-n[1]||n[4]<=0||n[3]<0||n[3]>n[4]||n.slice(5).some(v=>v<0))throw Error('賽果數據不完整或矛盾');
  const [points,against,diff,fgm,fga,fg3m,fta,oreb,dreb,ast,tov]=n;
  const key=`${date}:${team}`, rkey=`${date}:${opp}`;
  if(byKey.has(key))throw Error('球隊在同日出現重複賽果');
  const stats={point_diff:diff,efg:(fgm+0.5*fg3m)/fga,ast_to:ast/(tov||1),ftr:fta/fga,offensive_rebounds:oreb,defensive_rebounds:dreb};
  const home=r.home==='True'?true:r.home==='False'?false:null;
  if(home===null)throw Error('賽果場地欄位錯誤');
  byKey.set(key,{date,team,opp,points,against,home,stats,rkey});counts[team]=(counts[team]??0)+1;
 }
 for(const r of byKey.values()){const mate=byKey.get(r.rkey);if(!mate||mate.opp!==r.team||mate.points!==r.against||mate.against!==r.points||r.home&&mate.home)throw Error('雙方賽果無法核對');}
 return {rows:[...byKey.values()].sort((a,b)=>a.date.localeCompare(b.date)),counts};
}
export function predictNordberg(artifact,homeForm,awayForm,home,away){
 if(!artifact||artifact.schemaVersion!==1||artifact.method!=='Nordberg last-ten logistic, independently refitted'||!Array.isArray(artifact.coef)||artifact.coef.length!==12||!Number.isFinite(artifact.intercept))throw Error('模型參數不存在');
 const terms=[];for(let i=0;i<COLS.length;i++)for(let j=0;j<2;j++){const name=COLS[i],side=j?'away':'home',val=(j?awayForm:homeForm)?.[name],coefficient=artifact.coef[2*i+j];if(!Number.isFinite(val)||!Number.isFinite(coefficient)||artifact.featureOrder[2*i+j]!==`${side}_${name}`)throw Error('球隊近況數據不足');terms.push({name:`${side}_${name}`,team:j?away:home,featureValue:val,coefficient,product:val*coefficient});}
 const linearScore=artifact.intercept+terms.reduce((sum,t)=>sum+t.product,0);
 return {homeWinProbability:1/(1+Math.exp(-linearScore)),trace:{intercept:artifact.intercept,terms,linearScore}};
}
export async function collectNordberg(client,games,artifact,now=()=>Date.now()){
 let at=now(),atIso=new Date(at).toISOString();const eligible=games.filter(g=>g.league==='NBA');
 const pending=(g,reason)=>({gameId:g.id,league:'NBA',home:g.home,away:g.away,startAt:g.startAt,generatedAt:atIso,status:'pending',reason,model:MODEL});
 const scheduled=eligible.filter(g=>g.status==='scheduled'&&time(g.startAt)>at);
 if(!scheduled.length)return {forecasts:[],status:{status:'not_requested',available:0,total:0}};
 const end=seasonEnd(scheduled[0].startAt);
 if(end<2027||end>2035)return {forecasts:scheduled.map(g=>pending(g,'球季不適用本次訓練參數')),status:{status:'unavailable',available:0,total:scheduled.length}};
 try{
  const specs=[end-1,end].map(y=>({id:`elo-scores-${y}`,provider:'boxscorelab',season:seasonName(y),url:`${DATA_SOURCE}${seasonName(y)}-team-game-results.csv`,ttlMs:y===end?HOUR:DAY,maxStaleMs:0}));
  const res=await pool(specs,async job=>({job,result:await client.get(job)}),2);at=now();atIso=new Date(at).toISOString();let all=[],sourceReceipts=[];
  for(const {job,result:r} of res){
   if(!r.body||r.stale||!['live','cached'].includes(r.status)||!/^[a-f0-9]{64}$/.test(r.sha256??'')||!Number.isFinite(time(r.observedAt))||time(r.observedAt)>at||at-time(r.observedAt)>36*HOUR)throw Error(`${job.season} 球賽資料不可用或過期`);
   const parsed=parseTeamResults(r.body,job.season);
   if(job.season===seasonName(end-1)&&(parsed.rows.length!==2460||Object.keys(parsed.counts).length!==30||Object.values(parsed.counts).some(n=>n!==82)))throw Error('前一球季賽果不完整');
   all.push(...parsed.rows);sourceReceipts.push({season:job.season,url:job.url,observedAt:r.observedAt,sha256:r.sha256,rows:parsed.rows.length});
  }
  const cutoff=safeHistoryCutoff(at);all=all.filter(r=>r.date<cutoff).sort((a,b)=>a.date.localeCompare(b.date));
  const currentRows=all.filter(r=>r.date>=`${end-1}-07-01`),through=currentRows.at(-1)?.date;if(!through||time(cutoff)-time(through)>3*DAY)throw Error('近期賽果尚未更新');
  const forms=new Map(),history=new Map();for(const r of all){if(!history.has(r.team))history.set(r.team,[]);history.get(r.team).push(r);}
  for(const [code,rows] of history){const last=rows.slice(-10);if(last.length>=3){let out={};for(const c of COLS)out[c]=last.reduce((s,x)=>s+x.stats[c],0)/last.length;forms.set(code,{form:out,dates:last.map(x=>x.date)});}}
  const currentReceipt=sourceReceipts.find(x=>x.season===seasonName(end));
  const forecasts=scheduled.map(g=>{
   const start=time(g.startAt);if(start<=at||seasonEnd(start)!==end||g.comparison==='stale_only'||g.comparison==='conflict'||g.conflicts?.length)return pending(g,'賽程未確認或已開賽');
   const obs=(g.observations??[]).filter(o=>o.provider==='espn'&&!o.stale&&o.status==='scheduled'&&o.home===g.home&&o.away===g.away&&time(o.startAt)===start&&o.seasonType===2&&o.seasonYear===end&&typeof o.neutralSite==='boolean'&&Number.isFinite(time(o.observedAt))&&time(o.observedAt)<=at&&at-time(o.observedAt)<3*60*1000);
   if(obs.length!==1||obs[0].neutralSite)return pending(g,'賽程或主場未確認；中立場不套用主場模型');
   const home=forms.get(g.home),away=forms.get(g.away);if(!home||!away)return pending(g,'其中一隊不足 3 場過往數據');
   const {homeWinProbability,trace}=predictNordberg(artifact,home.form,away.form,g.home,g.away);
   return {gameId:g.id,league:'NBA',home:g.home,away:g.away,startAt:g.startAt,generatedAt:atIso,status:'experimental',model:MODEL,source:SOURCE,dataSource:DATA_SOURCE,trainingCutoff:artifact.trainingCutoff,historyThrough:through,historyCutoff:cutoff,observedAt:obs[0].observedAt,dataObservedAt:currentReceipt.observedAt,sourceReceipts,homeWinProbability,awayWinProbability:1-homeWinProbability,trace,homeSampleDates:home.dates,awaySampleDates:away.dates,limitations:['採 Nordberg 方法依 2022–26 球賽重新訓練；非作者的原權重','2025–26 留出測試使用前一版權重；不代表目前版本日後準確率','只計兩隊近期表現，未直接納入傷病、球員變動及輪替','比賽資料來源本身可能缺漏，需逐步核對','僅供參考']};
  });
  return {forecasts,status:{status:forecasts.every(x=>x.status==='experimental')?'ok':'partial',available:forecasts.filter(x=>x.status==='experimental').length,total:scheduled.length,historyThrough:through,observedAt:currentReceipt.observedAt,sources:sourceReceipts}};
 }catch(e){return {forecasts:scheduled.map(g=>pending(g,String(e.message??e))),status:{status:'unavailable',reason:String(e.message??e),available:0,total:scheduled.length}};}
}
export function retainNordberg(previous,current,now=Date.now()){
 const saved=new Map();
 const valid=p=>{
  if(p?.model!==MODEL||p.source!==SOURCE||p.dataSource!==DATA_SOURCE||p.status!=='experimental'||p.league!=='NBA'||!p.gameId||!p.home||!p.away||p.home===p.away||!Number.isFinite(p.homeWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||!Number.isFinite(p.awayWinProbability)||Math.abs(p.awayWinProbability+p.homeWinProbability-1)>1e-8||!Number.isFinite(time(p.generatedAt))||time(p.generatedAt)>=time(p.startAt)||time(p.generatedAt)>now||!Number.isFinite(time(p.observedAt))||time(p.observedAt)>time(p.generatedAt)||!Number.isFinite(time(p.dataObservedAt))||time(p.dataObservedAt)>time(p.generatedAt))return false;
  const t=p.trace;if(!Number.isFinite(t?.intercept)||!Number.isFinite(t?.linearScore)||!Array.isArray(t.terms)||t.terms.length!==12||t.terms.some(x=>!Number.isFinite(x.featureValue)||!Number.isFinite(x.coefficient)||!Number.isFinite(x.product)||Math.abs(x.product-x.featureValue*x.coefficient)>1e-8))return false;
  const s=t.intercept+t.terms.reduce((a,x)=>a+x.product,0);return Math.abs(s-t.linearScore)<1e-8&&Math.abs(p.homeWinProbability-1/(1+Math.exp(-s)))<1e-8;
 };
 const consider=p=>{if(!valid(p))return;const old=saved.get(p.gameId);if(!old||time(p.generatedAt)>time(old.generatedAt))saved.set(p.gameId,p);};
 const matches=(p,g)=>g?.id===p.gameId&&g.league==='NBA'&&g.home===p.home&&g.away===p.away&&time(g.startAt)===time(p.startAt)&&g.status==='scheduled'&&!g.conflicts?.length&&g.comparison!=='conflict'&&g.comparison!=='stale_only';
 for(const p of previous?.retainedNordbergForecasts??[])consider(p);
 const oldGames=new Map((previous?.games??[]).map(g=>[g.id,g]));
 for(const p of previous?.nordbergForecasts??[])if(matches(p,oldGames.get(p.gameId)))consider(p);
 const newGames=new Map((current?.games??[]).map(g=>[g.id,g]));
 for(const p of current?.nordbergForecasts??[])if(now<time(p.startAt)&&matches(p,newGames.get(p.gameId)))consider(p);
 return [...saved.values()];
}
