export function validateDashboard(d){
 if(d?.schemaVersion!==1||!Number.isFinite(Date.parse(d.generatedAt))||!Array.isArray(d.targetDates)||d.targetDates.length!==2||d.timeZone!=='Asia/Taipei')throw new Error('快照契約或日期錯誤');
 if(!d.collection||!['success','partial_success'].includes(d.collection.status))throw new Error('缺少蒐集狀態');
 if(!Array.isArray(d.sources)||!Array.isArray(d.games)||!Array.isArray(d.injuries)||!Array.isArray(d.forecasts))throw new Error('缺少資料集合');
 const ids=new Set();for(const g of d.games){if(ids.has(g.id)||!['NBA','MLB'].includes(g.league)||!g.home||!g.away||g.home===g.away||!Number.isFinite(Date.parse(g.startAt))||!d.targetDates.includes(g.date)||!Array.isArray(g.observations)||!g.observations.length)throw new Error('賽事身分或時間不符');ids.add(g.id);if(g.conflicts.length&&(g.homeScore!==null||g.awayScore!==null||g.forecastEligible))throw new Error('衝突資料不可發出新共識');for(const o of g.observations)if(!/^[a-f0-9]{64}$/.test(o.sha256)||!Number.isFinite(Date.parse(o.observedAt)))throw new Error('賽事缺來源指紋或原觀測時間');}
 for(const i of d.injuries)if(i.availabilityProbability!==null||i.independentConfirmed!==false)throw new Error('V1 不允許未校準出賽機率或獨立共識聲明');
 for(const p of d.forecasts)if(p.eligibleForLiveUse!==false||!p.generatedAt||!p.sourceHash)throw new Error('原站研究存檔不得自動轉為新正式預測');
 return d;
}
