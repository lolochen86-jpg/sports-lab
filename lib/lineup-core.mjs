// A deliberately small implementation of the published W0 rotation accounting.
// The source is https://evanz.github.io/nba-lineup-model/rotation-models/win-projections/.
// It does NOT reproduce the author's underlying NAIL, availability, or minutes models.
const MODEL_URL='https://evanz.github.io/nba-lineup-model/rotation-models/win-projections/';
const num=x=>typeof x==='number' && Number.isFinite(x);
const time=x=>Date.parse(x);
function validReceipt(receipt, asOf){
  const t=time(receipt?.observedAt), a=time(asOf);
  return Boolean(receipt?.url) && !receipt?.stale && Number.isFinite(t) && Number.isFinite(a) && t<=a;
}
const pending=reason=>({status:'pending',reason,model:'minute-weighted-player-impact',source:MODEL_URL});

/**
 * Rotation accounting, usable with labelled alternate per-100 ratings. It is a
 * strength/scenario calculation, NOT a calibrated game winner forecast.
 * All roster members must be supplied; missing injury information is not proof
 * that a player will play. season_estimate is explicitly a model assumption.
 */
export function lineupStrength({team,players,ratingFamily,asOf,rosterReceipt}){
  if(!team || !ratingFamily || !Array.isArray(players) || !players.length || !validReceipt(rosterReceipt,asOf)) return pending('球隊名單或來源時間未確認');
  const seen=new Set(), items=[];
  for(const p of players){
    if(!p?.id || seen.has(String(p.id)) || p.team!==team) return pending('球員身分重複或球隊不符');
    seen.add(String(p.id));
    if(!validReceipt(p.availabilityReceipt,asOf) || !validReceipt(p.minutesReceipt,asOf)) return pending(`球員 ${p.id} 的出賽或時間來源不足`);
    if(!['season_estimate','unreported_assumption','questionable_assumption','conflict_assumption','unknown_assumption','reported_out','confirmed_out','confirmed_in','manual_scenario'].includes(p.availabilityType) || !num(p.availability) || p.availability<0 || p.availability>1) return pending(`球員 ${p.id} 的出賽假設未確認`);
    if(['unreported_assumption','questionable_assumption','conflict_assumption','unknown_assumption'].includes(p.availabilityType) && p.availability!==1) return pending(`球員 ${p.id} 的出賽假設須明確標示`);
    if(['reported_out','confirmed_out'].includes(p.availabilityType) && p.availability!==0) return pending(`球員 ${p.id} 被通報缺陣但機率不是零`);
    if(p.availabilityType==='confirmed_in' && p.availability!==1) return pending(`球員 ${p.id} 已確定出賽但機率不是一`);
    if(!num(p.minutesIfAvailable) || p.minutesIfAvailable<0 || p.minutesIfAvailable>48) return pending(`球員 ${p.id} 預計上場時間無效`);
    const raw=82*p.availability*p.minutesIfAvailable;
    if(raw>0 && (!num(p.rating) || p.ratingFamily!==ratingFamily || !validReceipt(p.ratingReceipt,asOf))) return pending(`球員 ${p.id} 評分或來源不足`);
    items.push({...p,raw});
  }
  items.sort((a,b)=>b.raw-a.raw || String(a.id).localeCompare(String(b.id)));
  if(items.length>15 && items[14].raw>0 && items[14].raw===items[15].raw) return pending('第十五順位球員時間相同，需確認輪替');
  const selected=items.slice(0,15),total=selected.reduce((s,p)=>s+p.raw,0);
  if(selected.filter(p=>p.raw>0).length<5 || total<=0) return pending('可計算輪替不足五人');
  const rotation=selected.map(p=>({id:p.id,name:p.name,availability:p.availability,availabilityType:p.availabilityType,injuryStatus:p.injuryStatus,injurySources:p.injurySources??[],minutesIfAvailable:p.minutesIfAvailable,rating:p.rating??null,raw:p.raw,allocatedMinutes:240*p.raw/total,contribution:p.raw===0?0:(240*p.raw/total/48)*p.rating}));
  if(rotation.some(p=>p.allocatedMinutes>48+1e-9))return pending('按比例分配後有球員超過 48 分鐘，需確認輪替');
  return {status:'scenario',team,ratingFamily,asOf,source:MODEL_URL,rawTotal:total,teamStrength:rotation.reduce((s,p)=>s+p.contribution,0),rotation,
    limitations:['球員數值須標示來源與模型種類','未通報傷病者依場均時間設為假設，並非確認健康或保證出賽','球員出賽機率可為季前估計，非實際先發保證','僅陣容影響情境，非已校準勝率','本方法不推估單節或全場比分']};
}

/** Published W0 logistic, exposed ONLY as an explicitly labelled math reference.
 * Callers must supply provenance that establishes original frozen NAIL preseason
 * inputs and the actual W0 minute/availability model; alternate RAPM is rejected.
 */
export function originalW0Reference({home,away,homeBackToBack,awayBackToBack,inputProvenance}){
  if(inputProvenance!=='original-published-frozen-preseason-NAIL-W0' || home?.ratingFamily!=='NAIL' || away?.ratingFamily!=='NAIL' || home?.status!=='scenario' || away?.status!=='scenario' || ![0,1].includes(homeBackToBack) || ![0,1].includes(awayBackToBack)) return pending('欠缺原版 NAIL 季前資料或背靠背資訊，無法套用原研究勝率');
  const edge=home.teamStrength-away.teamStrength+2.84-1.51*(homeBackToBack-awayBackToBack);
  return {status:'reference_only',edge,homeWinProbability:1/(1+Math.exp(-0.1053*edge)),source:MODEL_URL,warning:'原作者季前模型的公式示範；非已驗證的即時傷病勝率'};
}
