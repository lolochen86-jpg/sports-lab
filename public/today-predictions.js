const taipeiDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
export function taipeiDay(time) { const d=new Date(time); return Number.isFinite(d.getTime()) ? taipeiDate.format(d) : null; }
export function nextTaipeiMidnight(now) { const day=86400000,offset=28800000; return (Math.floor((now+offset)/day)+1)*day-offset; }
export function todayPredictions(rows, league, now, retained=[], games=[]) {
  const today=taipeiDay(now),tomorrow=taipeiDay(nextTaipeiMidnight(now));
  if(!today)return [];
  const current=rows.filter(p=>{const start=Date.parse(p.startAt),d=taipeiDay(p.startAt);return p.league===league&&Number.isFinite(start)&&(d===today||(d===tomorrow&&start>now));});
  const ids=new Set(current.map(p=>p.gameId));
  // Never invent a pregame value: retained-only rows must be proven against a
  // distinct, uniquely matching game record and must already have started.
  const retainedOnly=retained.filter(p=>{
    const start=Date.parse(p.startAt), generated=Date.parse(p.generatedAt);
    if(ids.has(p.gameId)||p.league!==league||p.league!=='NBA'||!p.gameId||!p.away||!p.home||p.away===p.home||
       !Number.isFinite(start)||start>now||taipeiDay(start)!==today||!Number.isFinite(generated)||generated>=start||
       p.status!=='experimental'||p.calibrated!==false||!p.historyHash||!Number.isFinite(p.homeWinProbability)||
       !Number.isFinite(p.awayWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||
       p.awayWinProbability<0||p.awayWinProbability>1||Math.abs(p.homeWinProbability+p.awayWinProbability-1)>1e-8)return false;
    const matches=games.filter(g=>g.id===p.gameId);
    if(matches.length!==1)return false;
    const g=matches[0];return g.league===p.league&&g.away===p.away&&g.home===p.home&&Date.parse(g.startAt)===start&&
      ['scheduled','live','final'].includes(g.status)&&g.comparison!=='conflict'&&g.comparison!=='stale_only'&&!(g.conflicts??[]).length;
  });
  const unique=new Map();for(const p of retainedOnly){const old=unique.get(p.gameId);if(!old||Date.parse(old.generatedAt)<Date.parse(p.generatedAt))unique.set(p.gameId,p);}
  return [...current,...unique.values()].map(p=>{const start=Date.parse(p.startAt);if(start>now)return p;
      const found=retained.find(r=>r.gameId===p.gameId&&r.league===p.league&&r.home===p.home&&r.away===p.away&&Date.parse(r.startAt)===start&&r.status==='experimental'&&Date.parse(r.generatedAt)<start);
      const pregame=p.status==='experimental'&&Date.parse(p.generatedAt)<start?p:found;
      return pregame?{...pregame,archivedPregame:true}:{...p,status:'pending',reason:'沒有可核對的賽前預測存檔',archivedPregame:true};})
    .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
}

