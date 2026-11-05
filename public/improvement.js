const keys=['avgPoints','avgRebounds','avgAssists','avgSteals','avgBlocks'];
export const improvementSpecs=[['avgPoints','得分 / Points'],['avgRebounds','籃板 / Rebounds'],['avgAssists','助攻 / Assists'],['avgSteals','抄截 / Steals'],['avgBlocks','阻攻 / Blocks']];
export function improvementRanking(current,previous,key){
 if(!keys.includes(key)||current?.seasonYear!==previous?.seasonYear+1)return [];
 const old=new Map((previous.players??[]).map(p=>[p.id,p]));
 const eligible=(current.players??[]).filter(p=>p.stats?.gamesPlayed>=4&&Number.isFinite(p.stats[key])).sort((a,b)=>b.stats[key]-a.stats[key]||a.id.localeCompare(b.id));
 return eligible.map((p,i)=>({...p,currentRank:i>0&&p.stats[key]===eligible[i-1].stats[key]?null:i+1})).map((p,i,all)=>{if(p.currentRank===null){let j=i;while(j>0&&all[j].currentRank===null)j--;p.currentRank=all[j].currentRank;}return p;}).filter(p=>p.currentRank<=100&&old.has(p.id)&&old.get(p.id).stats.gamesPlayed>0&&Number.isFinite(old.get(p.id).stats[key])).map(p=>({...p,previous:old.get(p.id),change:p.stats[key]-old.get(p.id).stats[key]})).filter(p=>p.change>0).sort((a,b)=>b.change-a.change||a.currentRank-b.currentRank||a.name.localeCompare(b.name));
}
