// MLB rate-stat ratings: relative rank in the same season and role, not 2K ratings.
// OPS: https://www.mlb.com/glossary/standard-stats/on-base-plus-slugging
// ERA: https://www.mlb.com/glossary/standard-stats/earned-run-average
const number=x=>x===null||x===undefined||x===''?NaN:Number(x);
const isId=x=>/^\d+$/.test(String(x??''));
const grade=p=>p>=90?'S':p>=75?'A':p>=50?'B':p>=25?'C':'D';
const spec={hitting:{minimum:50,label:'打者：至少 50 打席'},pitching:{label:'先發至少 20 局；後援至少 10 局'}};

export function parseLeagueStats(body,season,group){
 const data=JSON.parse(body),sets=(data.stats??[]).filter(x=>x.type?.displayName==='season'&&x.group?.displayName===group);
 if(sets.length!==1||!Array.isArray(sets[0].splits)||!Number.isInteger(sets[0].totalSplits)||sets[0].totalSplits!==sets[0].splits.length)throw Error('官方統計資料結構或筆數不足');
 const seen=new Set(),out=[],seasonStats={};
 for(const x of sets[0].splits){const id=String(x.player?.id??''),stat=x.stat;
  if(!isId(id)||seen.has(id)||x.season!==String(season)||x.sport?.id!==1||!stat||typeof stat!=='object')throw Error('球員、球季或統計身分不符');
  seen.add(id);
  seasonStats[id]={team:x.team?.name??null,stat};
  if(group==='hitting'){
   const pa=number(stat.plateAppearances),obp=number(stat.obp),slg=number(stat.slg),ops=number(stat.ops);
   if(Number.isFinite(pa)&&pa>=50&&Number.isFinite(obp)&&Number.isFinite(slg)&&Number.isFinite(ops)&&obp>=0&&obp<=1&&slg>=0&&slg<=4&&ops>=0&&Math.abs(ops-obp-slg)<=0.0021)out.push({id,role:'hitting',metric:ops,obp,slg,sample:pa});
  }else if(group==='pitching'){
   const outs=number(stat.outs),er=number(stat.earnedRuns),gp=number(stat.gamesPitched??stat.gamesPlayed),gs=number(stat.gamesStarted),era=number(stat.era);
   if(!Number.isInteger(outs)||!Number.isInteger(er)||!Number.isInteger(gp)||!Number.isInteger(gs)||outs<1||er<0||gp<1||gs<0||gs>gp||!Number.isFinite(era)||era<0||Math.abs(era-27*er/outs)>0.015)continue;
   const role=gs/gp>=0.5?'starter':'reliever',minimum=role==='starter'?60:30;
   if(outs>=minimum)out.push({id,role,metric:era,earnedRuns:er,outs,appearances:gp,starts:gs,sample:outs});
  }else throw Error('不支援的統計類別');
 }
 return {rows:out,seasonStats,total:sets[0].totalSplits};
}

export function rateStats(rows){
 const groups=new Map(),records={};for(const row of rows){const a=groups.get(row.role)??[];a.push(row);groups.set(row.role,a);}
 for(const [role,list] of groups){if(list.length<10)continue;for(const row of list){
  const good=x=>role==='hitting'?x>row.metric:x<row.metric;
  const better=list.filter(x=>good(x.metric)).length,equal=list.filter(x=>x.metric===row.metric).length,worse=list.length-better-equal;
  const percentile=100*(worse+(equal-1)/2)/(list.length-1);
  const item={...row,rank:better+1,cohortSize:list.length,percentile,grade:grade(percentile)};
  const entry=records[row.id]??={};entry[role==='hitting'?'hitting':'pitching']=item;
 }}
 return records;
}

export async function collectMlbPerformance(client,previous,season){
 const results=await Promise.all(['hitting','pitching'].map(async group=>{
  const request=async year=>{const url=`https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&season=${year}&sportId=1&limit=2000&playerPool=ALL&gameType=R`;
   const response=await client.get({id:`mlb-performance-${group}-${year}`,provider:'mlb',url,ttlMs:3*3600000,maxStaleMs:0});
   const observed=Date.parse(response.observedAt),now=Date.now();if(!response.body||response.stale||!['live','cached'].includes(response.status)||!Number.isFinite(observed)||observed>now||now-observed>24*3600000||!/^[a-f0-9]{64}$/.test(response.sha256??''))throw Error(response.error??'來源不可用或來源時間／雜湊不足');
   return {season:year,source:url,observedAt:response.observedAt,sha256:response.sha256,...parseLeagueStats(response.body,year,group)};
  };
  try{let r=await request(season);if(r.total===0)r=await request(season-1);if(r.rows.length<10)throw Error('合格比較樣本不足');return [group,{...r,status:'ok',stale:false}];}
  catch(e){const old=previous?.groups?.[group];return [group,old?{...old,rows:[],seasonStats:previous?.seasonStats?.[group]??{},stale:true,status:'stale',error:String(e.message??e)}:{status:'unavailable',stale:true,error:String(e.message??e),rows:[],seasonStats:{}}];}
 }));
 const groups=Object.fromEntries(results),all=[...groups.hitting.rows,...groups.pitching.rows],ratings=rateStats(all);
 for(const [id,old] of Object.entries(previous?.ratings??{}))for(const group of ['hitting','pitching'])if(groups[group].stale&&old?.[group]){const dst=ratings[id]??={};dst[group]=old[group];}
 return {seasonStats:Object.fromEntries(Object.entries(groups).map(([group,x])=>[group,x.seasonStats??{}])),groups:Object.fromEntries(Object.entries(groups).map(([group,{rows,seasonStats,...rest}])=>[group,rest])),ratings,method:{title:'同季 OPS 與 ERA 百分位 / Percentile',sample:spec,description:'OPS 打者與 ERA 投手分開；投手依先發場次占出賽至少一半分為先發，其餘為後援。數值僅衡量打擊或失分，非全能實力。',grades:'S 前 10%；A 前 10–25%；B 前 25–50%；C 前 50–75%；D 其餘。同值平分百分位。',sources:['https://www.mlb.com/glossary/standard-stats/on-base-plus-slugging','https://www.mlb.com/glossary/standard-stats/earned-run-average']}};
}
