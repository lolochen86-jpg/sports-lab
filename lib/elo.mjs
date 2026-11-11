import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// NBA Elo-only, following Nicholas I. Dobson's MIT-licensed 538 reimplementation.
// Copyright (c) 2019 Nicholas I Dobson; full MIT license in LICENSE.
// Source: https://github.com/nicidob/nba_elo/blob/master/LR_as_Elo.ipynb
export const PROVENANCE={name:'NBA Elo（Dobson 重作的 FiveThirtyEight Elo-only 方法）',method:'https://github.com/nicidob/nba_elo',data:'https://www.boxscorelab.com/downloads/',license:'https://creativecommons.org/licenses/by/4.0/',caveat:'2022–23 最終 Elo 為 Paine 來源，之後只計例行賽，排除季後賽；不含球員、傷病、換隊及每節或全場預估得分。'};
const finite=n=>Number.isFinite(n);
export const winProb=(a,b,neutral=false)=>1/(1+10**(-((a-b+(neutral?0:100))/400)));
export function updateElo(ratingA,ratingB,scoreA,scoreB,neutral=false){
 if(![ratingA,ratingB,scoreA,scoreB].every(finite)||scoreA===scoreB||scoreA<0||scoreB<0) throw Error('invalid game inputs');
 const adjustedA=ratingA+(neutral?0:100), p=winProb(ratingA,ratingB,neutral);
 const delta=adjustedA-ratingB,winnerRatingAdvantage=scoreA>scoreB?delta:-delta;
 const denominator=7.5+0.006*winnerRatingAdvantage;if(denominator<=0)throw Error('invalid margin denominator');
 const multiplier=((Math.abs(scoreA-scoreB)+3)**0.8)/denominator;
 const change=20*((scoreA>scoreB?1:0)-p)*multiplier;
 return {probabilityA:p,ratingA:ratingA+change,ratingB:ratingB-change,change,multiplier};
}
export const resetSeason=rating=>rating*0.75+1505*0.25;
const aliases={BRK:'BKN',CHO:'CHA',PHO:'PHX'};
/** Parse two reciprocal rows per game, rejecting ambiguous duplicate matches. */
export function parseSeason(text,season){
 const lines=text.trim().split(/\r?\n/),head=lines.shift().split(',');
 const columns=['season','team','game_date','opponent','home','result','points','opponent_points'];
 if(columns.some(k=>!head.includes(k)))throw Error('missing required CSV columns');
 const groups=new Map();
 for(const line of lines){const values=line.split(',');if(values.length!==head.length)throw Error('unsupported quoted/malformed CSV');const r=Object.fromEntries(head.map((key,i)=>[key,values[i]]));
  if(r.season!==season||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.game_date))throw Error('invalid season or date');
  r.team=aliases[r.team]??r.team;r.opponent=aliases[r.opponent]??r.opponent;
  if(!/^[A-Z]{3}$/.test(r.team)||!/^[A-Z]{3}$/.test(r.opponent)||r.team===r.opponent||!['True','False'].includes(r.home)||!['W','L'].includes(r.result))throw Error('invalid game identity');
  r.points=Number(r.points);r.opponent_points=Number(r.opponent_points);if(!Number.isInteger(r.points)||!Number.isInteger(r.opponent_points)||r.points<=0||r.opponent_points<=0||r.points===r.opponent_points||(r.result==='W')!==(r.points>r.opponent_points))throw Error('invalid result');
  const key=[r.game_date,...[r.team,r.opponent].sort()].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 }
 const games=[];for(const [id,pair] of groups){if(pair.length!==2)throw Error(`missing or duplicate pair ${id}`);const [a,b]=pair;if(a.team!==b.opponent||a.opponent!==b.team||a.points!==b.opponent_points||a.opponent_points!==b.points||a.home==='True'&&b.home==='True')throw Error(`conflicting pair ${id}`);const home=a.home==='True'?a:b.home==='True'?b:a;const away=home===a?b:a;const neutral=a.home==='False'&&b.home==='False';games.push({id,date:a.game_date,season,home:home.team,away:away.team,homeScore:home.points,awayScore:away.points,neutral});}
 games.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const perDay=new Set();for(const g of games)for(const code of [g.home,g.away]){const key=g.date+'|'+code;if(perDay.has(key))throw Error('ambiguous same-day games: '+key);perDay.add(key);}
 return games;
}
/** No game on or after exclusive cutoff enters ratings; same-day scores never enter predictions. */
export function replay({seed,games,cutoff='9999-12-31',backtestFrom='0000-01-01'}){
 if(Object.keys(seed.ratings).length!==30)throw Error('need 30 verified seed ratings');
 const ratings=Object.fromEntries(Object.entries(seed.ratings).map(([k,v])=>[k,v.rating]));if(Object.values(ratings).some(v=>!finite(v)))throw Error('invalid seed');
 let seasonEnd=seed.seasonEnd,n=0,correct=0,brier=0,logLoss=0,lastDate=null;const perSeason={};
 for(const g of [...games].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){if(g.date>=cutoff)continue;const year=Number(g.season.slice(0,4))+1;if(!Number.isInteger(year)||year<seed.seasonEnd+1)throw Error('bad replay season');
  if(year!==seasonEnd){if(year!==seasonEnd+1)throw Error('season gap');for(const k in ratings)ratings[k]=resetSeason(ratings[k]);seasonEnd=year;}
  if(!finite(ratings[g.home])||!finite(ratings[g.away]))throw Error('unknown team');const u=updateElo(ratings[g.home],ratings[g.away],g.homeScore,g.awayScore,g.neutral);ratings[g.home]=u.ratingA;ratings[g.away]=u.ratingB;lastDate=g.date;
  if(g.date>=backtestFrom){const actual=g.homeScore>g.awayScore?1:0;n++;correct+=(u.probabilityA>=0.5)===(actual===1)?1:0;brier+=(u.probabilityA-actual)**2;logLoss-=actual*Math.log(u.probabilityA)+(1-actual)*Math.log(1-u.probabilityA);const s=perSeason[g.season]??={games:0,correct:0,brierSum:0};s.games++;s.correct+=(u.probabilityA>=0.5)===(actual===1)?1:0;s.brierSum+=(u.probabilityA-actual)**2;}
 }
 return {ratings,seasonEnd,lastDate,validation:{games:n,correct,accuracy:n?correct/n:null,brier:n?brier/n:null,logLoss:n?logLoss/n:null,perSeason}};
}
export async function loadSeason(file,season){const text=await readFile(file,'utf8');return {season,games:parseSeason(text,season),sha256:createHash('sha256').update(text).digest('hex')};}
