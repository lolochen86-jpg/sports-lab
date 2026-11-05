import {parseNbaLeaders} from './leaderboards.mjs';
const base='https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=1000&seasontype=2';
async function fetchSeason(client,url,id,expected){
 const r=await client.get({id,provider:'espn',url,ttlMs:id==='improvement-current'?3600000:7*86400000,maxStaleMs:0});
 if(!r.body||r.stale)throw Error(r.error||'來源不可用或已過期');
 const result=parseNbaLeaders(r.body);if(expected&&result.seasonYear!==expected)throw Error('球季不符');
 if(new Set(result.players.map(p=>p.id)).size!==result.players.length)throw Error('球員身分重複');
 return {...result,qualified:false,source:url,observedAt:r.observedAt,sha256:r.sha256,stale:false};
}
export async function collectImprovement(client,previous){
 try{
  const current=await fetchSeason(client,base,'improvement-current');
  const prior=await fetchSeason(client,`${base}&season=${current.seasonYear-1}`,'improvement-previous',current.seasonYear-1);
  return {status:'available',current,previous:prior};
 }catch(e){return previous?.current&&previous?.previous?{...previous,status:'stale',error:e.message}:{status:'unavailable',error:e.message};}
}
