export function preserveUnavailable(dashboard,previous,receipts){
 if(!previous)return dashboard;
 for(const league of ['NBA','MLB']){
  const usable=receipts.filter(r=>r.kind==='games'&&r.league===league&&r.parseStatus==='ok'&&!r.stale);
  if(!usable.length){const old=(previous.games??[]).filter(g=>g.league===league&&dashboard.targetDates.includes(g.date));if(old.length){dashboard.games=dashboard.games.filter(g=>g.league!==league).concat(old.map(g=>({...g,comparison:'stale_only',sourceCount:0,forecastEligible:false,observations:g.observations.map(o=>({...o,stale:true}))})));dashboard.preservedPrevious=true;dashboard.previousGeneratedAt=previous.generatedAt;}}
 }
 if(!receipts.some(r=>r.kind==='injuries'&&r.parseStatus==='ok'&&!r.stale)&&(previous.injuries??[]).length){dashboard.injuries=previous.injuries.map(i=>({...i,comparison:'stale_only',sourceCount:0,observations:i.observations.map(o=>({...o,stale:true}))}));dashboard.preservedPrevious=true;dashboard.previousGeneratedAt=previous.generatedAt;}
 return dashboard;
}
