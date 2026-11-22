import {selectNbaRating} from './nba-player-rating.js';
export const teamMetrics=[['fieldGoalPct','投籃 FG%',1,'核對出手分布與空間：需要的是終結效率，還是持球創造？'],['threePointFieldGoalPct','三分 3P%',1,'外線投射：先核對出手量與空檔品質，再評估射手需求。'],['avgAssists','場均助攻 AST',1,'第二持球點：先核對回合數、球權及主控休息時的進攻。'],['avgTurnovers','場均失誤 TOV',-1,'控球與決策：先核對失誤率及失誤來源，再評估組織者需求。']];
export const fresh=(x,now=Date.now())=>x&&!x.stale&&Number.isFinite(Date.parse(x.observedAt))&&Date.parse(x.observedAt)<=now&&now-Date.parse(x.observedAt)<86400000;
export function playerImpactRows(data,metric='impact',now=Date.now()){
 if(!['impact','offense','defense'].includes(metric))return [];
 const source=data.nbaPlayerRatings,season=data.improvement?.current?.seasonYear??data.leaderboards?.nba?.seasonYear;if(source?.season!==season)return [];
 const players=(data.rosterDatabase?.teams??[]).filter(t=>fresh(t,now)).flatMap(t=>(t.players??[]));const counts=new Map();players.forEach(p=>counts.set(p.id,(counts.get(p.id)??0)+1));
 return players.flatMap(p=>{if(counts.get(p.id)!==1)return [];const r=selectNbaRating(source,p.id,p.team,p.position,now).rating;return r?[{...p,rating:r}]:[];}).sort((a,b)=>b.rating[metric]-a.rating[metric]||a.name.localeCompare(b.name));
}
export function teamEvidence(data,code,now=Date.now()){
 const season=data.improvement?.current?.seasonYear??data.leaderboards?.nba?.seasonYear;
 const pool=(data.teamDashboard?.teams??[]).filter(t=>fresh(t,now)&&t.seasonYear===season&&t.seasonType==='Regular Season'&&t.stats?.gamesPlayed>=4);
 const own=pool.find(t=>t.team===code);if(!own)return null;
 const metrics=teamMetrics.flatMap(([key,label,direction,need])=>{if(!Number.isFinite(own.stats[key]))return [];const peers=pool.filter(t=>Number.isFinite(t.stats[key]));if(peers.length<20)return [];const value=own.stats[key],better=peers.filter(t=>direction*t.stats[key]>direction*value).length,equal=peers.filter(t=>t.stats[key]===value).length;return [{key,label,value,rank:better+1,count:peers.length,percentile:100*(peers.length-better-equal+(equal-1)/2)/(peers.length-1),need}];});
 const o=data.opponentAnalysis;const opponent=o?.status==='available'&&o.seasonYear===season&&fresh(o,now)?o.teams?.find(t=>t.team===code):null;
 return {team:own,metrics,strengths:metrics.filter(m=>m.percentile>=75),needs:metrics.filter(m=>m.percentile<=25),opponent};
}
