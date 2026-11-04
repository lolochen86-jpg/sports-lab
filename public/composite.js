export const dimensions=[['avgPoints','得分 / Points'],['avgRebounds','籃板 / Rebounds'],['avgAssists','助攻 / Assists'],['avgSteals','抄截 / Steals'],['avgBlocks','阻攻 / Blocks']];
// Scores are descriptive percentiles, not predictions or measures of popularity.
export function compositeBoard(players,minGames=3){
 const eligible=(players??[]).filter(p=>p?.stats?.gamesPlayed>=minGames&&dimensions.every(([key])=>Number.isFinite(p.stats[key])));
 return eligible.map(p=>{const radar=dimensions.map(([key])=>{const below=eligible.filter(q=>q.stats[key]<p.stats[key]).length;const tied=eligible.filter(q=>q.stats[key]===p.stats[key]).length;return eligible.length>1?(below+(tied-1)/2)/(eligible.length-1)*100:50;});return {...p,radar,score:radar.reduce((a,b)=>a+b,0)/5};}).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}
export function classifyExperience(players,roster,now=Date.now()){
 const matches=new Map();for(const t of roster?.teams??[]){if(t.stale||now-Date.parse(t.observedAt)>24*3600000)continue;for(const p of t.players??[]){const list=matches.get(p.id)??[];list.push(p);matches.set(p.id,list);}}
 return players.map(p=>{const rows=matches.get(p.id)??[];const entry=rows.length===1?rows[0]:null;return {...p,yearClass:entry?.experience===0?'rookie':entry?.experience===2?'sophomore':null};});
}
