import {lineupStrength} from './lineup-core.mjs';
import {nameKey,team as normalTeam} from './providers.mjs';
const MODEL='sportsdataverse-rapm-minute-weighted-v1';
const MODEL_SOURCE='https://evanz.github.io/nba-lineup-model/rotation-models/win-projections/';
const IMPACT='https://github.com/sportsdataverse/sportsdataverse-data/releases/download/nba_player_impact/';
const CROSSWALK='https://github.com/sportsdataverse/sportsdataverse-data/releases/download/nba_crosswalk/';
const HOUR=3600000;
// CSV fields may contain quoted commas and escaped quotes.
export function parseCSV(text){
 const rows=[];let cells=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){cells.push(cell);cell='';}else if(c==='\n'){cells.push(cell.replace(/\r$/,''));rows.push(cells);cells=[];cell='';}else cell+=c;}
 if(quoted)throw Error('CSV 引號未結束');if(cell||cells.length){cells.push(cell.replace(/\r$/,''));rows.push(cells);}const header=rows.shift();if(!header||new Set(header).size!==header.length)throw Error('CSV 欄位無效');
 return rows.filter(row=>row.length>1).map(row=>{if(row.length!==header.length)throw Error('CSV 資料欄位數不符');return Object.fromEntries(header.map((h,i)=>[h,row[i]]));});
}
const same=(a,b)=>nameKey(a)===nameKey(b);
const time=x=>Date.parse(x);
const valid=(r,now)=>r?.body&&!r.stale&&['live','cached'].includes(r.status)&&Number.isFinite(time(r.observedAt))&&time(r.observedAt)<=now&&now-time(r.observedAt)<24*HOUR&&Number.isFinite(time(r.lastModified))&&time(r.lastModified)<=now&&now-time(r.lastModified)<3*24*HOUR;
const receipt=r=>({url:r.url,observedAt:r.observedAt,sha256:r.sha256,stale:!!r.stale});

function teamImpact({code,rosters,ratings,crosswalk,injuries,injurySources,ratingReceipt,crosswalkReceipt,asOf,season}){
 const roster=rosters?.teams?.find(r=>r.team===code);
 if(!roster||roster.stale||!roster.players?.length||!Number.isFinite(time(roster.observedAt))||time(asOf)-time(roster.observedAt)>24*HOUR||time(roster.observedAt)>time(asOf))return {status:'pending',reason:`${code} 最新球員名單不可用`};
 const teamRatings=ratings.filter(r=>normalTeam(r.team_abbreviation)===code && r.season===String(season) && r.season_type==='Regular Season');
 if(!teamRatings.length)return {status:'pending',reason:`${code} 當季球員數據不足`};
 const rosterReceipt={url:roster.source,observedAt:roster.observedAt,stale:!!roster.stale,sha256:roster.sha256};
 const players=[],unmatched=[],outPlayers=[],seenNBA=new Set(),seenESPN=new Set();
 for(const r of teamRatings){
  const min=Number(r.min),gp=Number(r.gp),rating=Number(r.adj_rapm);
  if(!r.player_id||!Number.isFinite(min)||min<=0||!Number.isInteger(gp)||gp<1||!Number.isFinite(rating)||r.adj_rapm===''){unmatched.push({name:r.player_name,reason:'當季分鐘或影響值不足'});continue;}
  const maps=crosswalk.filter(c=>c.season===String(season)&&c.nba_player_id===r.player_id&&normalTeam(c.team_abbreviation)===code&&c.match_method==='exact_name'&&Number(c.match_confidence)===1&&same(c.nba_player_name,r.player_name));
  if(maps.length!==1){unmatched.push({name:r.player_name,reason:'球員身分對照不唯一'});continue;}const m=maps[0];
  const rosterPlayers=roster.players.filter(p=>String(p.id)===String(m.espn_athlete_id)&&same(p.name,m.espn_full_name));
  if(rosterPlayers.length!==1||seenNBA.has(r.player_id)||seenESPN.has(m.espn_athlete_id)){unmatched.push({name:r.player_name,reason:'ESPN 名單或跨來源 ID 對照不唯一'});continue;}
  seenNBA.add(r.player_id);seenESPN.add(m.espn_athlete_id);
  const p=rosterPlayers[0],ii=injuries.filter(x=>x.team===code&&same(x.player,p.name));
  if(ii.length>1)return {status:'pending',reason:`${p.name} 傷病狀態重複`};const injury=ii[0],injuryStatus=injury?.status??'UNREPORTED';
  const reported=injury?.observations?.filter(o=>!o.stale&&o.status!=='UNKNOWN')??[];
  const injuryDetails=(injury?.observations??[]).filter(o=>!o.stale).map(o=>({provider:o.provider,status:o.status,rawStatus:o.rawStatus??null,url:o.sourceUrl??o.reference,observedAt:o.observedAt,sha256:o.sha256}));
  const availabilityType=injuryStatus==='OUT'&&reported.length?'reported_out':injuryStatus==='CONFLICT'?'conflict_assumption':injuryStatus==='QUESTIONABLE'?'questionable_assumption':injuryStatus==='UNKNOWN'?'unknown_assumption':'unreported_assumption';
  const availability=availabilityType==='reported_out'?0:1, minutesIfAvailable=min/gp;
  const player={id:p.id,nbaId:r.player_id,name:p.name,team:code,ratingFamily:'SportsDataverse adj-RAPM',rating,availability,availabilityType,injuryStatus,injurySources:injuryDetails,minutesIfAvailable,availabilityReceipt:injurySources[0],minutesReceipt:ratingReceipt,ratingReceipt};
  if(availability===0)outPlayers.push({id:p.id,name:p.name,injuryStatus,injurySources:injuryDetails});
  players.push(player);
 }
 if(players.length<5)return {status:'pending',reason:`${code} 可核對球員不足五人`,unmatched};
 const rosterMissing=roster.players.filter(p=>!seenESPN.has(String(p.id))).map(p=>({id:p.id,name:p.name,reason:'當季影響值、分鐘或跨來源身分尚未核對'}));
 for(const p of rosterMissing){const i=injuries.find(x=>x.team===code&&same(x.player,p.name));if(i?.status==='OUT')outPlayers.push({id:p.id,name:p.name,injuryStatus:'OUT',excludedFromCalculation:true,injurySources:(i.observations??[]).filter(o=>!o.stale&&o.status==='OUT').map(o=>({provider:o.provider,status:o.status,rawStatus:o.rawStatus??null,url:o.sourceUrl??o.reference,observedAt:o.observedAt,sha256:o.sha256}))});}
 const result=lineupStrength({team:code,players,ratingFamily:'SportsDataverse adj-RAPM',asOf,rosterReceipt});
 const matchedMinutes=players.reduce((s,p)=>s+p.minutesIfAvailable,0),allMinutes=teamRatings.reduce((s,r)=>s+(Number(r.gp)>0&&Number(r.min)>0?Number(r.min)/Number(r.gp):0),0);
 return {...result,outPlayers,completeness:unmatched.length||rosterMissing.length?'partial':'complete',coverage:{eligible:players.length,unmatched:unmatched.length,matchedMinutes,allMinutes,unmatchedPlayers:unmatched,rosterMissing},ratingReceipt,crosswalkReceipt,rosterReceipt,injurySources};
}

export async function collectPlayerImpact({client,games,rosters,injuries,receipts,now=()=>Date.now()}){
 let at=now();const season=new Date(at).getUTCFullYear()+(new Date(at).getUTCMonth()>=6?1:0),impactUrl=`${IMPACT}nba_player_impact_${season}.csv`,crossUrl=`${CROSSWALK}nba_player_crosswalk_${season}.csv`;
 const upcoming=games.filter(g=>g.league==='NBA'&&g.status==='scheduled'&&time(g.startAt)>at);
 if(!upcoming.length)return {scenarios:[],status:{status:'not_requested',available:0,total:0}};
 const base=g=>({gameId:g.id,league:'NBA',home:g.home,away:g.away,startAt:g.startAt,generatedAt:new Date(at).toISOString(),model:MODEL,modelSource:MODEL_SOURCE,ratingSource:impactUrl});
 const fail=reason=>({scenarios:upcoming.map(g=>({...base(g),status:'pending',reason})),status:{status:'unavailable',reason,available:0,total:upcoming.length}});
 try{
  const [r,c]=await Promise.all([client.get({id:'player-impact-'+season,provider:'sportsdataverse',url:impactUrl,ttlMs:HOUR,maxStaleMs:0}),client.get({id:'player-crosswalk-'+season,provider:'sportsdataverse',url:crossUrl,ttlMs:HOUR,maxStaleMs:0})]);at=now();
  if(!valid(r,at)||!valid(c,at))throw Error('當季球員評分或身分資料不可用、缺少更新時間或已逾期');
  const injurySources=receipts.filter(x=>['espn-injuries','cbs-injuries'].includes(x.id)&&x.parseStatus==='ok'&&!x.stale&&Number.isFinite(time(x.observedAt))&&time(x.observedAt)<=at&&at-time(x.observedAt)<6*HOUR).map(x=>({url:x.url,observedAt:x.observedAt,sha256:x.sha256,stale:false}));
  if(injurySources.length<2)throw Error('傷病來源不足或逾期');
  const ratings=parseCSV(r.body),crosswalk=parseCSV(c.body);if(ratings.length<300||crosswalk.length<300)throw Error('球員影響值或身分資料筆數不足');
  const args={rosters,ratings,crosswalk,injuries,injurySources,ratingReceipt:receipt(r),crosswalkReceipt:receipt(c),asOf:new Date(at).toISOString(),season};
  const ts=new Map([...new Set(upcoming.flatMap(g=>[g.home,g.away]))].map(code=>[code,teamImpact({...args,code})]));
  const scenarios=upcoming.map(g=>{const homeTeam=ts.get(g.home),awayTeam=ts.get(g.away);if(g.comparison==='conflict'||g.comparison==='stale_only'||g.conflicts?.length||time(g.startAt)<=at)return {...base(g),status:'pending',reason:'賽程或開賽時間待確認'};
   if(homeTeam.status!=='scenario'||awayTeam.status!=='scenario')return {...base(g),status:'pending',reason:[homeTeam.reason,awayTeam.reason].filter(Boolean).join('；'),homeTeam,awayTeam};
   return {...base(g),status:'scenario',completeness:homeTeam.completeness==='partial'||awayTeam.completeness==='partial'?'partial':'complete',homeTeam,awayTeam,limitations:['使用本季已發生比賽的 adj-RAPM，非 NAIL 原模型或未來影響力保證','用本季場均分鐘為參考，未通報或狀態不明依假設可出賽；衝突請核對來源','通報 OUT 依可取得來源設零，不代表官方最終名單','來源未涵蓋、球員身分未配對者不會計入，請查覆蓋率','僅供球員陣容影響情境，不是已校準的勝率或比分預測']};});
  const available=scenarios.filter(x=>x.status==='scenario').length;
  return {scenarios,status:{status:available===upcoming.length?'ok':available?'partial':'unavailable',available,total:upcoming.length,ratingsObservedAt:r.observedAt,ratingsLastModified:r.lastModified,crosswalkObservedAt:c.observedAt}};
 }catch(e){return fail(String(e.message??e));}
}
