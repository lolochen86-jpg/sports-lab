const taipeiDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
export function taipeiDay(time) { const d=new Date(time); return Number.isFinite(d.getTime()) ? taipeiDate.format(d) : null; }
export function nextTaipeiMidnight(now) { const day=86400000,offset=28800000; return (Math.floor((now+offset)/day)+1)*day-offset; }
export function todayPredictions(rows, league, now, retained=[]) {
  const today=taipeiDay(now),tomorrow=taipeiDay(nextTaipeiMidnight(now));
  if(!today)return [];
  return rows.filter(p=>{const start=Date.parse(p.startAt),d=taipeiDay(p.startAt);return p.league===league&&Number.isFinite(start)&&(d===today||(d===tomorrow&&start>now));})
    .map(p=>{const start=Date.parse(p.startAt);if(start>now)return p;
      const found=retained.find(r=>r.gameId===p.gameId&&r.league===p.league&&r.home===p.home&&r.away===p.away&&Date.parse(r.startAt)===start&&r.status==='experimental'&&Date.parse(r.generatedAt)<start);
      const pregame=p.status==='experimental'&&Date.parse(p.generatedAt)<start?p:found;
      return pregame?{...pregame,archivedPregame:true}:{...p,status:'pending',reason:'沒有可核對的賽前預測存檔',archivedPregame:true};})
    .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
}
