import {selectNbaRating} from './nba-player-rating.js?v=20261111';

// Compare the same adj-RAPM measure across positions; grades use separate position cohorts.
export function rankNbaRoster(players,snapshot,seasonYear,now=Date.now()){
 const counts=new Map();
 for(const p of players)counts.set(String(p.id),(counts.get(String(p.id))??0)+1);
 const ordered=players.map(p=>{
  const observed=Date.parse(p.rosterSource?.observedAt);
  const stale=p.rosterSource?.stale||!Number.isFinite(observed)||observed>now||now-observed>86400000;
  const result=!snapshot||snapshot.season!==seasonYear?{reason:'評分球季待核對'}
    :stale?{reason:'名單資料已過期'}
    :counts.get(String(p.id))!==1?{reason:'球員名單重複，待核對'}
    :selectNbaRating(snapshot,p.id,p.team,p.position,now);
  return {...p,rosterRating:result.rating??null,rosterRatingReason:result.reason??null};
 });
 ordered.sort((a,b)=>{
  const x=a.rosterRating?.impact,y=b.rosterRating?.impact;
  if(Number.isFinite(x)&&Number.isFinite(y))return y-x||String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id));
  if(Number.isFinite(x))return -1;
  if(Number.isFinite(y))return 1;
  return String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id));
 });
 let last=null,rank=0;
 for(let i=0;i<ordered.length;i++){
  const impact=ordered[i].rosterRating?.impact;
  if(!Number.isFinite(impact)){ordered[i].rosterRank=null;continue;}
  if(last===null||impact!==last)rank=i+1;
  ordered[i].rosterRank=rank;last=impact;
 }
 return ordered;
}
