import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOpponentAnalysis} from '../lib/opponent-analysis.mjs';
import {shiftDate} from '../lib/providers.mjs';

const date='2026-11-07',at='2026-11-07T12:00:00Z';
const event=(id,away,home,as,hs,options={})=>({id,date:'2026-11-01T02:00:00Z',season:{year:2027,type:2},status:{type:{completed:true}},competitions:[{competitors:[{homeAway:'away',team:{abbreviation:away},score:String(as)},{homeAway:'home',team:{abbreviation:home},score:String(hs)}]}],...options});
const receipts=Array.from({length:30},(_,i)=>({day:shiftDate(date,i-30),url:'https://example.com',observedAt:at,sha256:'abc',error:null}));
const history={complete:true,receipts,events:[event('1','BOS','NY',100,90),event('2','NY','BOS',90,100),event('3','NY','CHI',110,90),event('4','CHI','BOS',95,110)]};
test('排除雙方全部交手，以同期其他賽事計算對手勝率並保留逐場紀錄',()=>{
 const result=buildOpponentAnalysis(history,2027,date,at);
 assert.equal(result.status,'available');assert.equal(result.games.length,4);assert.equal(result.sources.length,30);
 const bos=result.teams.find(t=>t.team==='BOS');assert.equal(bos.wins,3);assert.equal(bos.losses,0);assert.equal(bos.results[0].opponentWinPct,1);assert.equal(bos.results[2].opponentWinPct,0);assert.equal(bos.opponentsCovered,3);assert.equal(bos.opponentWinPct,2/3);assert.equal(bos.opponentWinPctInWins,2/3);assert.equal(bos.opponentWinPctInLosses,null);assert.equal(bos.winsCovered,3);assert.equal(bos.lossesCovered,0);
 assert.deepEqual(result.window,{startDate:'2026-10-08',endDate:'2026-11-06',days:30});
});
test('對手沒有其他比賽時不假裝勝率為零',()=>{const r=buildOpponentAnalysis({...history,events:[history.events[0]]},2027,date,at);const b=r.teams.find(x=>x.team==='BOS');assert.equal(b.opponentWinPct,null);assert.equal(b.opponentsCovered,0);});
test('不完整或矛盾資料不可當成可靠分析，保留舊資料並標示過期',()=>{
 const old=buildOpponentAnalysis(history,2027,date,at);
 assert.equal(buildOpponentAnalysis({...history,complete:false},2027,date,at).status,'unavailable');
 const stale=buildOpponentAnalysis({...history,receipts:receipts.slice(1)},2027,date,at,old);assert.equal(stale.status,'stale');assert.deepEqual(stale.games,old.games);
 assert.equal(buildOpponentAnalysis({...history,events:[history.events[0],event('1','BOS','NY',101,90)]},2027,date,at).status,'unavailable');
});
test('季前賽、其他球季、未完賽不計入',()=>{const r=buildOpponentAnalysis({...history,events:[history.events[0],event('8','NY','CHI',99,90,{season:{year:2027,type:1}}),event('9','NY','CHI',99,90,{season:{year:2026,type:2}}),event('10','NY','CHI',99,90,{status:{type:{completed:false}}})]},2027,date,at);assert.deepEqual(r.games.map(g=>g.id),['1']);});

