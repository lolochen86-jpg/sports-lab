export function teamScores(standings){
 const rows=(standings??[]).flatMap(g=>g.rows??[]).filter(s=>[s.pct,s.pointsFor,s.pointsAgainst].every(Number.isFinite));
 if(rows.length<20)return {scores:{},sample:rows.length};const scores={};for(const x of rows){const values=[x.pct,x.pointsFor,x.pointsAgainst];const parts=values.map((value,i)=>{const all=rows.map(y=>[y.pct,y.pointsFor,y.pointsAgainst][i]),below=all.filter(v=>i===2?v>value:v<value).length,equal=all.filter(v=>v===value).length;return (below+(equal-1)/2)/(rows.length-1)*100;});scores[x.team]={score:parts.reduce((a,b)=>a+b,0)/parts.length,values};}return {scores,sample:rows.length};
}
export function rosterStatus(team,roster,injuries,generatedAt,now=Date.now()){
 const r=roster?.teams?.find(t=>t.team===team);if(!r||r.stale||!Number.isFinite(Date.parse(r.observedAt))||now-Date.parse(r.observedAt)>86400000||!Number.isFinite(Date.parse(generatedAt))||now-Date.parse(generatedAt)>8*3600000)return null;
 const ids=new Set(r.players.map(p=>String(p.id))),seen=new Set();let out=0,uncertain=0,reportedAvailable=0;
 for(const i of injuries??[]){if(i.team!==team)continue;const id=i.observations?.find(o=>o.provider==='espn'&&!o.stale&&ids.has(String(o.playerId)))?.playerId;if(!id||seen.has(String(id)))continue;seen.add(String(id));if(['OUT','SUSPENDED'].includes(i.status))out++;else if(['CONFLICT','QUESTIONABLE','DOUBTFUL','DAY_TO_DAY','PROBABLE'].includes(i.status))uncertain++;else if(i.status==='AVAILABLE')reportedAvailable++;}
 return {total:ids.size,out,uncertain,reportedAvailable,unknown:ids.size-out-uncertain-reportedAvailable,observedAt:r.observedAt,source:r.source};
}
