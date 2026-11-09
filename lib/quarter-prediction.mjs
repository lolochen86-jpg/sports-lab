import {team} from './providers.mjs';
import {sha} from './fetch.mjs';

const pending=reason=>({status:'pending',reason});
function scores(c){
 if(!Array.isArray(c?.linescores)||c.linescores.length<4)return null;
 const periods=new Map();
 for(const q of c.linescores){const n=Number(q.period),v=q.value;if(!Number.isInteger(n)||n<1||periods.has(n)||!Number.isInteger(v)||v<0)return null;periods.set(n,v);}
 if(![1,2,3,4].every(n=>periods.has(n)))return null;
 for(let n=1;n<=periods.size;n++)if(!periods.has(n))return null;
 const total=Number(c.score);
 if(!Number.isFinite(total)||[...periods.values()].reduce((a,b)=>a+b,0)!==total)return null;
 return [1,2,3,4].map(n=>periods.get(n));
}

// Full-time model includes overtime; this separate estimate is regulation only.
export function quarterPrediction(p,history){
 if(p?.status!=='experimental'||p.league!=='NBA')return pending('全場研究預測尚未成立');
 const at=Date.parse(p.generatedAt),start=Date.parse(p.startAt);
 if(!Number.isFinite(at)||!Number.isFinite(start)||at>=start)return pending('賽前時間無法確認');
 if(!history?.complete||!Array.isArray(history.events)||!Array.isArray(history.receipts)||history.receipts.length!==30||history.receipts.some(r=>r.error||!r.sha256||!r.url||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>at))return pending('分節來源時間或近 30 日資料不完整');
 const season=new Date(start).getUTCFullYear()+(new Date(start).getUTCMonth()>=6?1:0);
 const raw=new Map(),conflicts=new Set();
 for(const e of history.events){
  if(e?.season?.type!==2||e.season.year!==season||e.status?.type?.completed!==true||!e.id||!Number.isFinite(Date.parse(e.date))||Date.parse(e.date)>=at||Date.parse(e.date)>=start)continue;
  const competitors=e.competitions?.[0]?.competitors??[],away=competitors.find(x=>x.homeAway==='away'),home=competitors.find(x=>x.homeAway==='home');
  const a=scores(away),h=scores(home),ac=team(away?.team?.abbreviation??''),hc=team(home?.team?.abbreviation??'');
  if(!a||!h||!ac||!hc||ac===hc)continue;
  const row={id:String(e.id),date:e.date,away:ac,home:hc,a,h};const old=raw.get(row.id);
  if(old&&JSON.stringify(old)!==JSON.stringify(row))conflicts.add(row.id);else raw.set(row.id,row);
 }
 for(const id of conflicts)raw.delete(id);
 const rows=[...raw.values()];
 const samples=code=>rows.flatMap(r=>r.away===code?[{scored:r.a,allowed:r.h}]:r.home===code?[{scored:r.h,allowed:r.a}]:[]);
 const away=samples(p.away),home=samples(p.home);
 if(away.length<3||home.length<3)return pending(`可核對分節樣本不足：客隊 ${away.length} 場、主隊 ${home.length} 場，各需 3 場`);
 const league=Array.from({length:4},(_,i)=>rows.reduce((s,r)=>s+r.a[i]+r.h[i],0)/(rows.length*2));
 const shrink=(list,key,i)=>(list.reduce((s,r)=>s+r[key][i],0)+8*league[i])/(list.length+8);
 const quarters=league.map((_,i)=>({period:i+1,away:+Math.max(0,(shrink(away,'scored',i)+shrink(home,'allowed',i))/2-0.1875).toFixed(1),home:+Math.max(0,(shrink(home,'scored',i)+shrink(away,'allowed',i))/2+0.1875).toFixed(1)}));
 return {status:'experimental',model:'nba-quarter-regulation-baseline-v1',generatedAt:p.generatedAt,calibrated:false,quarters,regulationAway:+quarters.reduce((s,q)=>s+q.away,0).toFixed(1),regulationHome:+quarters.reduce((s,q)=>s+q.home,0).toFixed(1),awaySamples:away.length,homeSamples:home.length,leagueSamples:rows.length,historyHash:sha(JSON.stringify(rows)),sources:history.receipts.map(({day,url,observedAt,sha256})=>({day,url,observedAt,sha256})),limitations:['以 ESPN 近 30 日本季例行賽完賽分節計算；加時不計入四節','正常時間預估總分與可能包含延長賽的全場模型獨立計算','未納入傷病、先發或輪替，未經回測校準']};
}

