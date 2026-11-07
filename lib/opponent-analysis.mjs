import {team,shiftDate} from './providers.mjs';

const LIMITATIONS=['僅為 ESPN 所提供的近 30 個美國比賽日期內、本季例行賽完賽紀錄，並非整季戰績。','對手勝率排除雙方所有交手，以同一樣本期間回顧計算；不是比賽當時的對手實力，也未調整傷病與賽程。','僅供描述對手組成，並非已回測戰力分數或勝負預測。'];
export function buildOpponentAnalysis(history,seasonYear,date,observedAt,previous){
 const unavailable=reason=>previous?.status==='available'||previous?.status==='stale'?{...previous,status:'stale',reason}:{status:'unavailable',league:'NBA',reason,teams:[],games:[],limitations:LIMITATIONS};
 const dates=Array.from({length:30},(_,i)=>shiftDate(date,i-30));
 if(!Number.isInteger(seasonYear))return unavailable('球季尚未確認');
 if(!history?.complete||!Array.isArray(history.events)||!Array.isArray(history.receipts)||history.receipts.length!==30||dates.some(day=>!history.receipts.some(r=>r.day===day&&!r.error&&r.url&&r.observedAt&&r.sha256)))return unavailable('近 30 日資料不完整或尚未蒐集');
 const byId=new Map();
 for(const e of history.events){
  if(e.season?.year!==seasonYear||e.season?.type!==2||e.status?.type?.completed!==true)continue;
  const a=e.competitions?.[0]?.competitors?.find(x=>x.homeAway==='away'),h=e.competitions?.[0]?.competitors?.find(x=>x.homeAway==='home');
  const as=Number(a?.score),hs=Number(h?.score),away=team(a?.team?.abbreviation??''),home=team(h?.team?.abbreviation??''),ts=Date.parse(e.date);
  if(!e.id||!away||!home||away===home||!Number.isFinite(ts)||ts>=Date.parse(observedAt)||!Number.isInteger(as)||!Number.isInteger(hs)||as<=0||hs<=0||as===hs)return unavailable('完賽資料欄位不足或有衝突');
  const game={id:String(e.id),date:e.date,away,home,awayScore:as,homeScore:hs};
  const old=byId.get(game.id);if(old&&JSON.stringify(old)!==JSON.stringify(game))return unavailable('同一場比賽有衝突紀錄');byId.set(game.id,game);
 }
 const games=[...byId.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 if(!games.length)return unavailable('近 30 日沒有可核對的當季例行賽');
 const codes=[...new Set(games.flatMap(g=>[g.away,g.home]))].sort();
 const teamGames=code=>games.filter(g=>g.away===code||g.home===code);
 const teams=codes.map(code=>{
  const rows=teamGames(code);let wins=0,pointsFor=0,pointsAgainst=0;
  const results=rows.map(g=>{
   const isHome=g.home===code,opponent=isHome?g.away:g.home,forScore=isHome?g.homeScore:g.awayScore,against=isHome?g.awayScore:g.homeScore,win=forScore>against;
   wins+=Number(win);pointsFor+=forScore;pointsAgainst+=against;
   const opponentGames=teamGames(opponent).filter(x=>x.away!==code&&x.home!==code);
   const opponentWins=opponentGames.filter(x=>(x.home===opponent?x.homeScore>x.awayScore:x.awayScore>x.homeScore)).length;
   return {gameId:g.id,opponent,win,margin:forScore-against,opponentWins,opponentLosses:opponentGames.length-opponentWins,opponentWinPct:opponentGames.length?opponentWins/opponentGames.length:null};
  });
  const covered=results.filter(r=>r.opponentWinPct!==null);
  const mean=rs=>rs.length?rs.reduce((s,r)=>s+r.opponentWinPct,0)/rs.length:null;
  const winOpponents=covered.filter(r=>r.win),lossOpponents=covered.filter(r=>!r.win);
  return {team:code,games:rows.length,wins,losses:rows.length-wins,pointsFor,pointsAgainst,opponentWinPct:mean(covered),opponentWinPctInWins:mean(winOpponents),opponentWinPctInLosses:mean(lossOpponents),winsCovered:winOpponents.length,lossesCovered:lossOpponents.length,opponentSampleGames:covered.reduce((s,r)=>s+r.opponentWins+r.opponentLosses,0),opponentsCovered:covered.length,results};
 });
 return {status:'available',league:'NBA',seasonYear,window:{startDate:dates[0],endDate:dates.at(-1),days:30},observedAt,sources:history.receipts.map(({day,url,observedAt,sha256})=>({day,url,observedAt,sha256})),games,teams,limitations:LIMITATIONS};
}

