const parse=v=>Date.parse(v);
const validTime=(v,generated)=>Number.isFinite(parse(v))&&parse(v)<=generated;
const validSource=(r,generated)=>Boolean(r?.url)&&!r.stale&&validTime(r.observedAt,generated);
const validIdentity=(p,g)=>g&&p.gameId===g.id&&p.league===g.league&&p.home===g.home&&p.away===g.away&&parse(p.startAt)===parse(g.startAt);
function validTeam(t,code,generated){
 if(t?.status!=='scenario'||t.team!==code||!Number.isFinite(t.teamStrength)||!validTime(t.asOf,generated)||!validSource(t.ratingReceipt,generated)||!validSource(t.crosswalkReceipt,generated)||!validSource(t.rosterReceipt,generated)||!Array.isArray(t.injurySources)||t.injurySources.length<2||!t.injurySources.every(s=>validSource(s,generated))||!Array.isArray(t.rotation)||t.rotation.length<5)return false;
 const ids=new Set();let total=0,strength=0;
 for(const player of t.rotation){
  if(!player?.id||ids.has(String(player.id))||!Number.isFinite(player.allocatedMinutes)||player.allocatedMinutes<0||player.allocatedMinutes>48+1e-9||!Number.isFinite(player.contribution)||!Array.isArray(player.injurySources)||!player.injurySources.every(s=>validSource(s,generated)))return false;
  if(player.allocatedMinutes>0&&(!Number.isFinite(player.rating)||Math.abs(player.contribution-player.allocatedMinutes*player.rating/48)>1e-8))return false;
  if(player.allocatedMinutes===0&&player.contribution!==0)return false;
  ids.add(String(player.id));total+=player.allocatedMinutes;strength+=player.contribution;
 }
 if(Math.abs(total-240)>1e-6||Math.abs(strength-t.teamStrength)>1e-6)return false;
 for(const p of t.outPlayers??[]){if(!Array.isArray(p.injurySources)||!p.injurySources.length||!p.injurySources.every(s=>validSource(s,generated)))return false;}
 return true;
}
export function validPregamePlayerImpact(p,now=Date.now()){
 const generated=parse(p?.generatedAt),start=parse(p?.startAt);
 return p?.model==='sportsdataverse-rapm-minute-weighted-v1'&&p.status==='scenario'&&p.league==='NBA'&&!!p.gameId&&!!p.home&&!!p.away&&p.home!==p.away&&Number.isFinite(generated)&&Number.isFinite(start)&&generated<start&&generated<=now&&validTeam(p.homeTeam,p.home,generated)&&validTeam(p.awayTeam,p.away,generated);
}
function validSchedule(p,g,generated){
 return validIdentity(p,g)&&g.status==='scheduled'&&g.comparison!=='conflict'&&g.comparison!=='stale_only'&&!(g.conflicts??[]).length&&Array.isArray(g.observations)&&g.observations.some(o=>!o.stale&&o.status==='scheduled'&&o.home===p.home&&o.away===p.away&&parse(o.startAt)===parse(p.startAt)&&validTime(o.observedAt,generated));
}
/** Keep the latest genuinely pregame scenario. Never fabricate historical inputs. */
export function retainPlayerImpactScenarios(current,previous,now=Date.now()){
 const saved=new Map(),consider=p=>{if(!validPregamePlayerImpact(p,now))return;const old=saved.get(p.gameId);if(!old||parse(p.generatedAt)>parse(old.generatedAt))saved.set(p.gameId,structuredClone(p));};
 // Previously validated stored scenarios stay readable even during source outages.
 for(const p of previous?.retainedPlayerImpactScenarios??[])consider(p);
 const priorGames=new Map((previous?.games??[]).map(g=>[g.id,g]));
 // A prior run's current list was recorded while the game was still scheduled.
 for(const p of previous?.playerImpactScenarios??[]){if(validSchedule(p,priorGames.get(p?.gameId),parse(p.generatedAt)))consider(p);}
 const currentGames=new Map((current?.games??[]).map(g=>[g.id,g]));
 // Never reconstruct or accept a newly-produced record once the game starts.
 for(const p of current?.playerImpactScenarios??[]){if(now<parse(p?.startAt)&&validSchedule(p,currentGames.get(p?.gameId),parse(p.generatedAt)))consider(p);}
 return [...saved.values()].map(p=>({...p,archivedPregame:now>=parse(p.startAt)}));
}
