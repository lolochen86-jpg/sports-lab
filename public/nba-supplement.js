export function parseNbaSupplement(d,id,season,games){
 const ar=d?.athlete?.$ref??'',sr=d?.season?.$ref??'',tr=d?.seasonType?.$ref??'';
 if(!new RegExp(`/athletes/${id}(?:[/?]|$)`).test(ar)||!new RegExp(`/seasons/${season}(?:[/?]|$)`).test(sr)||!new RegExp(`/seasons/${season}/types/2(?:[/?]|$)`).test(tr)||!Array.isArray(d.splits?.categories))throw Error('身分或球季不符');
 const stats=Object.fromEntries(d.splits.categories.flatMap(c=>c.stats??[]).map(x=>[x.name,x.value]));
 if(!Number.isInteger(stats.gamesPlayed)||stats.gamesPlayed!==games)throw Error('出賽場次不同，無法合併');
 const keys=['gamesStarted','avgOffensiveRebounds','avgDefensiveRebounds'];const result={};for(const key of keys)if(Number.isFinite(stats[key])&&stats[key]>=0)result[key]=stats[key];if(Number.isFinite(stats.plusMinus))result.plusMinus=stats.plusMinus;return result;
}
