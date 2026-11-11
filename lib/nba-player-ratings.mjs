import {parseCSV} from './player-impact-forecast.mjs';
import {nameKey,team as normalTeam} from './providers.mjs';

export const IMPACT_SOURCE='https://github.com/sportsdataverse/sportsdataverse-data/releases/download/nba_player_impact/';
export const CROSSWALK_SOURCE='https://github.com/sportsdataverse/sportsdataverse-data/releases/download/nba_crosswalk/';
export const METHOD_SOURCE='https://hoopr.sportsdataverse.org/articles/nba-player-impact-model.html';
const HOUR=3600000, day=24*HOUR;
const same=(a,b)=>nameKey(a)===nameKey(b);
const validNumber=x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x));
export const ratingLevel=p=>p>=90?'S':p>=75?'A':p>=50?'B':p>=25?'C':'D';

// The common-time sample compares like-for-like G/F/C groups; ties share a percentile.
// Percentile and S/A/B/C/D cutoffs are Sports Lab presentation, not an external metric.
export function rankPositionGroups(rows){
 const result=[];
 for(const pos of ['G','F','C']){
  const group=rows.filter(r=>r.position===pos&&r.games>=5&&r.minutes>=60&&Number.isFinite(r.impact));
  for(const r of group){
   if(group.length<10){result.push({...r,status:'pending',reason:'同位置可比較球員不足 10 人'});continue;}
   const less=group.filter(x=>x.impact<r.impact).length,equal=group.filter(x=>x.impact===r.impact).length;
   const percentile=(less+equal/2)/group.length*100;
   result.push({...r,status:'rated',percentile,grade:ratingLevel(percentile),peerCount:group.length});
  }
 }
 return result;
}

export function buildNbaPlayerRatings({ratings,crosswalk,rosters,season,asOf}){
 const now=Date.parse(asOf),eligible=[],pending=[],seenESPN=new Set(),seenNBA=new Set();
 if(!Number.isFinite(now)||!Number.isInteger(season)||!Array.isArray(ratings)||!Array.isArray(crosswalk)||!Array.isArray(rosters?.teams))throw Error('評分輸入格式不足');
 for(const t of rosters.teams){
  if(t.stale||!Number.isFinite(Date.parse(t.observedAt))||Date.parse(t.observedAt)>now||now-Date.parse(t.observedAt)>day)continue;
  for(const p of t.players??[]){
   const base={id:String(p.id),name:p.name,team:t.team,position:p.position};
   if(!/^\d+$/.test(base.id)||!p.name||!['G','F','C'].includes(p.position)){pending.push({...base,reason:'球員身分或位置待確認'});continue;}
   const matches=crosswalk.filter(c=>c.season===String(season)&&String(c.espn_athlete_id)===base.id&&normalTeam(c.team_abbreviation)===t.team&&c.match_method==='exact_name'&&Number(c.match_confidence)===1&&same(c.espn_full_name,p.name)&&/^\d+$/.test(String(c.nba_player_id)));
   if(matches.length!==1){pending.push({...base,reason:'跨來源球員身分未確認'});continue;}
   const m=matches[0];
   const hits=ratings.filter(r=>r.season===String(season)&&r.season_type==='Regular Season'&&String(r.player_id)===String(m.nba_player_id)&&normalTeam(r.team_abbreviation)===t.team&&same(r.player_name,m.nba_player_name));
   if(hits.length!==1||seenESPN.has(base.id)||seenNBA.has(String(m.nba_player_id))){pending.push({...base,reason:'球季、球隊或球員對照不唯一'});continue;}
   seenESPN.add(base.id);seenNBA.add(String(m.nba_player_id));const x=hits[0];
   if(!validNumber(x.gp)||!validNumber(x.min)||!validNumber(x.adj_rapm)||!validNumber(x.o_adj_rapm)||!validNumber(x.d_adj_rapm)){pending.push({...base,reason:'影響值或上場資料不足'});continue;}
   const games=Number(x.gp),minutes=Number(x.min),impact=Number(x.adj_rapm),offense=Number(x.o_adj_rapm),defense=Number(x.d_adj_rapm);
   if(!Number.isInteger(games)||games<0||minutes<0||Math.abs(impact-offense-defense)>0.00001){pending.push({...base,reason:'來源數據不一致'});continue;}
   const row={...base,nbaId:String(m.nba_player_id),games,minutes,impact,offense,defense};
   if(games<5||minutes<60){pending.push({...row,reason:'至少 5 場且 60 分鐘才列入分級'});continue;}eligible.push(row);
  }
 }
 const ranked=rankPositionGroups(eligible);return {rows:[...ranked,...pending.map(r=>({...r,status:'pending'}))],groupSizes:Object.fromEntries(['G','F','C'].map(p=>[p,eligible.filter(r=>r.position===p).length]))};
}
export async function collectNbaPlayerRatings({client,rosters,previous,now=()=>Date.now()}){
 let at=now();const d=new Date(at),season=d.getUTCFullYear()+(d.getUTCMonth()>=6?1:0),impactUrl=`${IMPACT_SOURCE}nba_player_impact_${season}.csv`,crossUrl=`${CROSSWALK_SOURCE}nba_player_crosswalk_${season}.csv`;
 try{
  const [i,c]=await Promise.all([client.get({id:`player-impact-${season}`,provider:'sportsdataverse',url:impactUrl,ttlMs:HOUR,maxStaleMs:0}),client.get({id:`player-crosswalk-${season}`,provider:'sportsdataverse',url:crossUrl,ttlMs:HOUR,maxStaleMs:0})]);at=now();
  for(const r of [i,c])if(!r.body||r.stale||!['live','cached'].includes(r.status)||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>at||at-Date.parse(r.observedAt)>day||!Number.isFinite(Date.parse(r.lastModified))||Date.parse(r.lastModified)>at||at-Date.parse(r.lastModified)>3*day||!/^[a-f0-9]{64}$/.test(r.sha256??''))throw Error('評分或 ID 對照來源不可用或過期');
  const ratings=parseCSV(i.body),crosswalk=parseCSV(c.body);if(ratings.length<300||crosswalk.length<300)throw Error('球員資料筆數不足');
  const result=buildNbaPlayerRatings({ratings,crosswalk,rosters,season,asOf:new Date(at).toISOString()});const rated=result.rows.filter(r=>r.status==='rated').length;
  if(!rated)throw Error('沒有可核對的同位置球員評分');
  const rosterTotal=rosters.teams.reduce((n,t)=>n+(t.players?.length??0),0),freshTeams=rosters.teams.filter(t=>!t.stale&&Number.isFinite(Date.parse(t.observedAt))&&Date.parse(t.observedAt)<=at&&at-Date.parse(t.observedAt)<=day).length;
  return {...result,status:rated===rosterTotal&&freshTeams===30?'ok':'partial',rosterTotal,freshTeams,season,source:impactUrl,crosswalkSource:crossUrl,method:METHOD_SOURCE,observedAt:i.observedAt,lastModified:i.lastModified,sha256:i.sha256,crosswalkObservedAt:c.observedAt,crosswalkSha256:c.sha256,generatedAt:new Date(at).toISOString(),stale:false,ratedCount:rated,minimumGames:5,minimumMinutes:60,positionBasis:'ESPN 現役名單的 G / F / C 主位置',levelBasis:'同位置合格樣本影響值中位次百分位：S ≥90、A ≥75、B ≥50、C ≥25、D <25；本站分級，非官方或 2K',limitations:['單季樣本少時波動大；adj-RAPM 為在場影響估計，非對球員全面能力或未來表現的保證','影響值受隊友、對手、輪替和模型假設影響','未符合場次、時間、名單或身分核對者不排名']};
 }catch(e){return previous?.rows?.length?{...previous,status:'stale',stale:true,error:String(e.message??e)}:{status:'unavailable',season,rows:[],stale:true,error:String(e.message??e),method:METHOD_SOURCE};}
}
