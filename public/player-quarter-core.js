const invalid=(reason,eventId)=>({status:'unavailable',...(eventId?{eventId:String(eventId)}:{}),reason});
const integer=x=>(typeof x==='number'||(typeof x==='string'&&/^\d+$/.test(x)))&&Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):null;
function minutesNumber(x){if(x===null||x===undefined)return null;if(typeof x==='string'&&/^\d+:\d\d$/.test(x)){const [m,s]=x.split(':').map(Number);return s<60?m+s/60:null;}if(typeof x==='string'&&x.trim()==='')return null;const n=Number(x);return Number.isFinite(n)&&n>=0?n:null;}

// The overview contains no reliable season identifier. Season and final status are validated from each summary.
export function latestGameCandidates(overview,{now=Date.now(),limit=20}={}){
 const log=overview?.gameLog,table=log?.statistics?.find(x=>x.displayName==='totals');
 if(!Array.isArray(table?.names)||!Array.isArray(table.events)||!log?.events||typeof log.events!=='object')return invalid('沒有可核對的球員賽事紀錄');
 const i=table.names.indexOf('minutes');if(i<0)return invalid('球員上場時間欄位不足');
 const games=[],seen=new Set();
 for(const row of table.events){const id=String(row.eventId??''),event=log.events[id],date=event?.gameDate,ts=Date.parse(date),minutes=minutesNumber(row.stats?.[i]);
  if(!/^\d+$/.test(id)||seen.has(id)||!event||String(event.id)!==id||!Number.isFinite(ts)||ts>=now||minutes===null||minutes<=0)continue;
  seen.add(id);games.push({id,date,teamId:String(event.team?.id??'')});
 }
 games.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 return {status:'available',games:games.slice(0,Math.max(0,Math.min(Number.isInteger(limit)?limit:20,50)))};
}

// ESPN season gamelog provides season identity and separate regular/preseason lists.
export function seasonGameCandidates(gamelog,{seasonYear,now=Date.now()}={}){
 if(!Number.isInteger(seasonYear)||!Array.isArray(gamelog?.filters)||!Array.isArray(gamelog?.seasonTypes)||!Array.isArray(gamelog?.names)||!gamelog?.events||typeof gamelog.events!=='object')return invalid('本季逐場資料不完整');
 const selected=gamelog.filters.filter(x=>x.name==='season');if(selected.length!==1||String(selected[0].value)!==String(seasonYear))return invalid('球季無法核對');
 const label=`${seasonYear-1}-${String(seasonYear).slice(-2)} Regular Season`,seasons=gamelog.seasonTypes.filter(s=>s.displayName===label);
 if(seasons.length!==1||!Array.isArray(seasons[0].categories))return invalid('本季例行賽清單無法核對');
 const mi=gamelog.names.indexOf('minutes');if(mi<0)return invalid('球員上場時間欄位不足');
 const games=[],seen=new Set();for(const category of seasons[0].categories){if(!Array.isArray(category.events))return invalid('例行賽資料不完整');for(const row of category.events){const id=String(row.eventId??''),event=gamelog.events[id],date=event?.gameDate,ts=Date.parse(date),minutes=minutesNumber(row.stats?.[mi]);
  if(!/^\d+$/.test(id)||!event||String(event.id)!==id||!Number.isFinite(ts)||ts>=now||minutes===null||minutes<=0)continue;
  if(seen.has(id))return invalid('球員賽事紀錄重複');seen.add(id);games.push({id,date,teamId:String(event.team?.id??'')});
 }}games.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));return {status:'available',games};
}

// Only verified final box-score records with a complete and reconciled scoring ledger are returned.
export function parsePlayerQuarterGame(summary,{eventId,playerId,seasonYear,now=Date.now()}={}){
 eventId=String(eventId??'');playerId=String(playerId??'');const fail=reason=>invalid(reason,eventId);
 if(!/^\d+$/.test(eventId)||!/^\d+$/.test(playerId)||!Number.isInteger(seasonYear))return fail('球員、賽事或球季身分不完整');
 const header=summary?.header,competitions=header?.competitions;
 if(String(header?.id)!==eventId||!Array.isArray(competitions)||competitions.length!==1)return fail('賽事身分無法核對');
 if(header?.season?.year!==seasonYear||header?.season?.type!==2)return fail('非指定球季例行賽');
 const c=competitions[0],ts=Date.parse(c.date);if(c.status?.type?.completed!==true||!Number.isFinite(ts)||ts>=now)return fail('比賽尚未完賽或時間不符');
 if(!Array.isArray(c.competitors)||c.competitors.length!==2||!Array.isArray(summary.plays)||!summary.plays.length||!Array.isArray(summary.boxscore?.players))return fail('賽事資料不完整');
 const teams=new Map();
 for(const side of c.competitors){const id=String(side.team?.id??''),code=side.team?.abbreviation,score=integer(side.score),qs=side.linescores;if(!/^\d+$/.test(id)||!code||score===null||teams.has(id)||!Array.isArray(qs)||qs.length<4)return fail('球隊比分或分節不完整');const periods=qs.map(q=>integer(q.value??q.displayValue));if(periods.some(x=>x===null)||periods.reduce((a,b)=>a+b,0)!==score)return fail('球隊分節與總分不一致');teams.set(id,{id,code,score,periods});}
 const teamRows=summary.boxscore.players;if(teamRows.length!==2)return fail('球隊球員明細不完整');
 const athletes=new Map();
 for(const box of teamRows){const tid=String(box.team?.id??'');if(!teams.has(tid)||!Array.isArray(box.statistics))return fail('球員明細球隊身分不符');
  for(const group of box.statistics){const keys=group.keys??group.names,pi=keys?.findIndex(x=>x==='points'||x==='PTS'),mi=keys?.findIndex(x=>x==='minutes'||x==='MIN');if(pi<0||mi<0||!Array.isArray(group.athletes))return fail('球員得分欄位不完整');
   for(const a of group.athletes){if(a.didNotPlay===true)continue;const id=String(a.athlete?.id??''),pts=integer(a.stats?.[pi]),mins=minutesNumber(a.stats?.[mi]);if(!/^\d+$/.test(id)||pts===null||mins===null||athletes.has(id))return fail('球員明細異常或重複');athletes.set(id,{id,tid,pts,mins,periods:Array(teams.get(tid).periods.length).fill(0)});}
  }
 }
 const target=athletes.get(playerId);if(!target||target.mins<=0)return fail('球員未出賽或無法核對');
 const seen=new Set();let scoring=0;
 for(const p of summary.plays){const id=String(p.id??'');if(!id||seen.has(id))return fail('比賽事件缺少編號或重複');seen.add(id);if(p.scoringPlay!==true)continue;scoring++;
  const tid=String(p.team?.id??''),pid=String(p.participants?.[0]?.athlete?.id??''),n=integer(p.period?.number),value=integer(p.scoreValue),a=athletes.get(pid),team=teams.get(tid);
  if(!team||!a||a.tid!==tid||n===null||n<1||n>team.periods.length||![1,2,3].includes(value))return fail('得分事件缺少球員或有異常');a.periods[n-1]+=value;
 }
 if(!scoring)return fail('沒有可核對的得分事件');
 for(const a of athletes.values())if(a.periods.reduce((x,y)=>x+y,0)!==a.pts)return fail('球員分節加總與全場得分不一致');
 for(const team of teams.values())for(let i=0;i<team.periods.length;i++){const calculated=[...athletes.values()].filter(a=>a.tid===team.id).reduce((s,a)=>s+(a.periods[i]??0),0);if(calculated!==team.periods[i])return fail('得分事件與球隊各節比分不一致');}
 const other=[...teams.values()].find(t=>t.id!==target.tid);return {status:'available',eventId,date:c.date,team:teams.get(target.tid).code,opponent:other.code,quarters:target.periods.slice(0,4),overtime:target.periods.length>4?target.periods.slice(4).reduce((a,b)=>a+b,0):null,total:target.pts,minutes:target.mins};
}

