import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLeagueStats,rateStats,collectMlbPerformance} from '../lib/mlb-performance.mjs';
import {mlbRatingSummary,mlbRatingDetails} from '../public/mlb-rating.js';

function data(group,rows){return JSON.stringify({stats:[{type:{displayName:'season'},group:{displayName:group},totalSplits:rows.length,splits:rows.map((stat,i)=>({season:'2026',sport:{id:1},player:{id:i+1},stat}))}]});}
const hitters=Array.from({length:12},(_,i)=>({plateAppearances:100,obp:.3,slg:.3+i*.01,ops:.6+i*.01}));
const pitchers=Array.from({length:12},(_,i)=>({outs:90,earnedRuns:i,era:27*i/90,gamesPitched:20,gamesStarted:20}));
test('OPS sample, cohort percentiles, equal scores, and missing values',()=>{
 const rows=parseLeagueStats(data('hitting',hitters),2026,'hitting').rows;
 const rating=rateStats(rows);assert.equal(rating['12'].hitting.grade,'S');assert.equal(rating['1'].hitting.grade,'D');
 const tied=rateStats([{id:'a',role:'hitting',metric:.7},{id:'b',role:'hitting',metric:.7},...Array.from({length:8},(_,i)=>({id:`x${i}`,role:'hitting',metric:.6}))]);
 assert.equal(tied.a.hitting.percentile,tied.b.hitting.percentile);assert.equal(tied.a.hitting.rank,tied.b.hitting.rank);
 const invalid=structuredClone(hitters);invalid[0].plateAppearances=49;invalid[1].ops=null;
 assert.equal(parseLeagueStats(data('hitting',invalid),2026,'hitting').rows.length,10);
});
test('pitching uses outs, correctly separates roles, excludes small samples and bad figures',()=>{
 const input=pitchers.map((p,i)=>({...p,outs:257,earnedRuns:30+i,era:Number((27*(30+i)/257).toFixed(2)),gamesStarted:i<6?20:0}));
 let rows=parseLeagueStats(data('pitching',input),2026,'pitching').rows;assert.equal(rows[0].outs,257);assert.equal(rows[0].role,'starter');assert.equal(rows[11].role,'reliever');
 input[0].era=99;input[1].outs=29;rows=parseLeagueStats(data('pitching',input),2026,'pitching').rows;assert.equal(rows.length,10);
});
test('two-way players retain two separate ratings and show calculations with season',async()=>{
 const observedAt=new Date(Date.now()-1000).toISOString(),h=data('hitting',hitters),p=data('pitching',pitchers);const client={get:async j=>({body:j.id.includes('hitting')?h:p,status:'live',stale:false,observedAt,sha256:'a'.repeat(64)})};
 const db=await collectMlbPerformance(client,null,2026);assert.ok(db.ratings['1'].hitting);assert.ok(db.ratings['1'].pitching);assert.equal(db.seasonStats.hitting['1'].stat.plateAppearances,100);assert.equal(db.seasonStats.pitching['1'].stat.outs,90);
 const html=mlbRatingDetails(db,'1');assert.match(html,/2026/);assert.match(html,/打擊 OPS/);assert.match(html,/先發投手 ERA/);assert.match(html,/出局數/);assert.match(mlbRatingSummary(db,'1'),/OPS/);
 db.groups.hitting.observedAt=new Date(Date.now()-25*3600000).toISOString();assert.match(mlbRatingSummary(db,'1'),/舊資料/);
});
test('source failure keeps prior data clearly stale, never relabels new season',async()=>{
 const observedAt=new Date(Date.now()-1000).toISOString(),h=data('hitting',hitters),p=data('pitching',pitchers),success={get:async j=>({body:j.id.includes('hitting')?h:p,status:'live',observedAt,sha256:'a'.repeat(64)})};
 const first=await collectMlbPerformance(success,null,2026),bad={get:async()=>({status:'failed'})};const next=await collectMlbPerformance(bad,first,2027);
 assert.equal(next.groups.hitting.season,2026);assert.equal(next.groups.hitting.status,'stale');assert.ok(next.ratings['1'].hitting);assert.equal(next.seasonStats.hitting['1'].stat.plateAppearances,100);assert.match(mlbRatingSummary(next,'1'),/舊資料/);
});
test('invalid source and mismatched season never rank',()=>{
 assert.throws(()=>parseLeagueStats(data('hitting',hitters),2025,'hitting'));assert.throws(()=>parseLeagueStats('{"stats":[]}',2026,'hitting'));
 assert.match(mlbRatingSummary(null,'1'),/資料不足/);
});
