const DROP_URL='https://thedropcoverage.com/data/games.json';
const MAX_SOURCE_AGE=8*60*60*1000;
const validScore=x=>x===null||typeof x==='number'&&Number.isFinite(x)&&x>=0;
const validProbability=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const timestamp=x=>Date.parse(x);
const validExternal=p=>{
 const updated=timestamp(p?.sourceUpdatedAt),observed=timestamp(p?.observedAt),start=timestamp(p?.startAt);
 return p?.status==='available'&&p.league==='NBA'&&typeof p.gameId==='string'&&!!p.gameId&&typeof p.home==='string'&&!!p.home&&typeof p.away==='string'&&!!p.away&&p.home!==p.away&&/^\d+$/.test(String(p.sourceEventId??''))&&p.sourceUrl===DROP_URL&&/^[a-f0-9]{64}$/.test(p.sourceHash??'')&&Number.isFinite(start)&&Number.isFinite(updated)&&Number.isFinite(observed)&&updated<=observed&&observed<start&&observed-updated<=MAX_SOURCE_AGE&&validProbability(p.homeWinProbability)&&validProbability(p.awayWinProbability)&&Math.abs(p.homeWinProbability+p.awayWinProbability-1)<1e-8&&validScore(p.expectedHome)&&validScore(p.expectedAway);
};
function validateExternal(d){
 if(d.externalPredictions!==undefined&&!Array.isArray(d.externalPredictions))throw new Error('外部預測格式錯誤');
 const seen=new Set();
 for(const p of d.externalPredictions??[]){
  if(!p||typeof p.gameId!=='string'||seen.has(p.gameId)||!['available','pending'].includes(p.status))throw new Error('外部預測重複或狀態錯誤');seen.add(p.gameId);
  const matches=d.games.filter(g=>g.id===p.gameId),g=matches[0];
  if(matches.length!==1||p.league!=='NBA'||g.league!==p.league||g.home!==p.home||g.away!==p.away||timestamp(g.startAt)!==timestamp(p.startAt)||p.sourceUrl!==DROP_URL)throw new Error('外部預測賽事身分不符');
  if(p.status==='pending')continue;
  const observed=timestamp(p.observedAt),built=timestamp(d.generatedAt);
  if(!validExternal(p)||g.status!=='scheduled'||g.comparison==='conflict'||g.comparison==='stale_only'||(g.conflicts??[]).length||observed>built)throw new Error('外部預測未符合賽前來源條件');
  const matching=(g.observations??[]).filter(o=>o?.provider==='espn'&&!o.stale&&o.status==='scheduled'&&o.home===g.home&&o.away===g.away&&timestamp(o.startAt)===timestamp(g.startAt)&&Number.isFinite(timestamp(o.observedAt))&&timestamp(o.observedAt)<=built&&/^\d+$/.test(String(o.sourceId??'')));
  const eventIds=new Set(matching.map(o=>String(o.sourceId)));
  if(eventIds.size!==1||!eventIds.has(String(p.sourceEventId)))throw new Error('外部預測來源賽事編號不符');
 }
 if(d.retainedExternalPredictions!==undefined&&!Array.isArray(d.retainedExternalPredictions))throw new Error('外部預測存檔格式錯誤');
 const saved=new Set();for(const p of d.retainedExternalPredictions??[]){if(!validExternal(p)||saved.has(p.gameId))throw new Error('外部預測存檔資料錯誤');saved.add(p.gameId);}
 if(d.legacyResearchPredictions!==undefined&&!Array.isArray(d.legacyResearchPredictions))throw new Error('舊預測存檔格式錯誤');
}
export function validateDashboard(d){
 if(d?.schemaVersion!==1||!Number.isFinite(Date.parse(d.generatedAt))||!Array.isArray(d.targetDates)||d.targetDates.length!==2||d.timeZone!=='Asia/Taipei')throw new Error('快照契約或日期錯誤');
 if(!d.collection||!['success','partial_success'].includes(d.collection.status))throw new Error('缺少蒐集狀態');
 if(!Array.isArray(d.sources)||!Array.isArray(d.games)||!Array.isArray(d.injuries)||!Array.isArray(d.forecasts))throw new Error('缺少資料集合');
 const ids=new Set();for(const g of d.games){if(ids.has(g.id)||!['NBA','MLB'].includes(g.league)||!g.home||!g.away||g.home===g.away||!Number.isFinite(Date.parse(g.startAt))||!d.targetDates.includes(g.date)||!Array.isArray(g.observations)||!g.observations.length)throw new Error('賽事身分或時間不符');ids.add(g.id);if(g.conflicts.length&&(g.homeScore!==null||g.awayScore!==null||g.forecastEligible))throw new Error('衝突資料不可發出新共識');for(const o of g.observations)if(!/^[a-f0-9]{64}$/.test(o.sha256)||!Number.isFinite(Date.parse(o.observedAt)))throw new Error('賽事缺來源指紋或原觀測時間');}
 validateExternal(d);
 if(d.historicalDates&&!Array.isArray(d.historicalDates))throw new Error('歷史日期格式錯誤');
 if(d.historicalGames){if(!Array.isArray(d.historicalGames)||d.historicalGames.some(g=>!d.historicalDates?.includes(g.date)||d.targetDates.includes(g.date)||!g.id||!Array.isArray(g.observations)||!g.observations.length||!Number.isFinite(Date.parse(g.archiveObservedAt))))throw new Error('歷史賽事缺少日期或觀測資料');}
 for(const i of d.injuries)if(i.availabilityProbability!==null||i.independentConfirmed!==false)throw new Error('V1 不允許未校準出賽機率或獨立共識聲明');
 for(const p of d.forecasts)if(p.eligibleForLiveUse!==false||!p.generatedAt||!p.sourceHash)throw new Error('原站研究存檔不得自動轉為新正式預測');
 for(const p of d.researchPredictions??[]){const g=d.games.find(x=>x.id===p.gameId);if(!g||p.calibrated!==false)throw new Error('研究預測缺賽事或錯誤宣稱校準');if(p.status==='experimental'&&(p.league!=='NBA'||g.status!=='scheduled'||g.sourceCount<2||g.conflicts.length||Date.parse(p.generatedAt)>=Date.parse(g.startAt)||!Number.isFinite(p.homeWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||Math.abs(p.homeWinProbability+p.awayWinProbability-1)>1e-8||!p.historyHash))throw new Error('研究預測未符合賽前條件');}
 for(const p of d.retainedPredictions??[]){const g=d.games.find(x=>x.id===p.gameId);if(!g||p.status!=='experimental'||p.calibrated!==false||p.league!=='NBA'||p.league!==g.league||p.away!==g.away||p.home!==g.home||Date.parse(p.startAt)!==Date.parse(g.startAt)||!Number.isFinite(Date.parse(p.generatedAt))||Date.parse(p.generatedAt)>=Date.parse(p.startAt)||!p.historyHash||!Number.isFinite(p.homeWinProbability)||!Number.isFinite(p.awayWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||Math.abs(p.homeWinProbability+p.awayWinProbability-1)>1e-8)throw new Error('賽前存檔時間或身分不符');}
 for(const s of d.injuryScenarios??[]){const p=(d.researchPredictions??[]).find(x=>x.gameId===s.gameId);if(!p||s.calibrated!==false)throw new Error('傷病情境缺少基準');if(s.status==='experimental'&&(p.status!=='experimental'||Date.parse(s.generatedAt)>=Date.parse(p.startAt)||!Number.isFinite(s.homeWinProbability)||Math.abs(s.homeWinProbability+s.awayWinProbability-1)>1e-8||!Array.isArray(s.players)))throw new Error('傷病情境未符合條件');}
 if(d.rosterDatabase){const r=d.rosterDatabase;if(r.league!=='NBA'||!Array.isArray(r.teams)||r.teams.length!==30||new Set(r.teams.map(x=>x.team)).size!==30)throw new Error('名單資料庫球隊不完整');for(const t of r.teams){if(!Array.isArray(t.players)||t.players.some(p=>!/^\d+$/.test(p.id)||p.team!==t.team))throw new Error('名單球員身分不符');}}
 if(d.teamDashboard){const t=d.teamDashboard;if(t.league!=='NBA'||!Array.isArray(t.teams)||t.teams.length!==30||new Set(t.teams.map(x=>x.team)).size!==30)throw new Error('球隊現況資料不完整');for(const x of t.teams)if(x.stats&&(!x.seasonYear||!Number.isFinite(Date.parse(x.observedAt))))throw new Error('球隊現況缺少球季或觀測時間');}
 return d;
}
