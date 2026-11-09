import test from 'node:test';
import assert from 'node:assert/strict';
import {quarterPrediction} from '../lib/quarter-prediction.mjs';

const at='2026-11-06T12:00:00Z';
const prediction={status:'experimental',league:'NBA',away:'BOS',home:'BKN',generatedAt:at,startAt:'2026-11-07T00:00:00Z'};
const receipts=Array.from({length:30},(_,i)=>({day:`day${i}`,url:`https://example.com/${i}`,observedAt:'2026-11-06T11:00:00Z',sha256:'abc'}));
function event(id,away,home,{ot=false}={}){
 const side=(code,homeAway,values)=>({homeAway,team:{abbreviation:code},score:String(values.reduce((a,b)=>a+b,0)),linescores:values.map((value,i)=>({period:i+1,value}))});
 return {id,date:'2026-11-05T00:00:00Z',season:{year:2027,type:2},status:{type:{completed:true}},competitions:[{competitors:[side(away,'away',ot?[20,21,22,23,8]:[20,21,22,23]),side(home,'home',ot?[24,25,26,27,9]:[24,25,26,27])]}]};
}
const fixture=()=>({complete:true,receipts,events:[event('1','BOS','LAL'),event('2','BOS','LAL',{ot:true}),event('3','BOS','LAL'),event('4','BKN','CHI'),event('5','BKN','CHI'),event('6','BKN','CHI')]});
test('有足夠可信賽前樣本時估計四節和正規時間總分，含加時場但只計前四節',()=>{
 const h=fixture(),q=quarterPrediction(prediction,h);
 assert.equal(q.status,'experimental');assert.equal(q.quarters.length,4);assert.equal(q.awaySamples,3);assert.equal(q.homeSamples,3);
 assert.equal(q.regulationAway,+q.quarters.reduce((s,x)=>s+x.away,0).toFixed(1));
 assert.equal(q.regulationHome,+q.quarters.reduce((s,x)=>s+x.home,0).toFixed(1));
 assert.equal(q.generatedAt,at);assert.equal(q.calibrated,false);
});
test('缺節、比分矛盾或未完賽不可計入樣本',()=>{
 const h=fixture();h.events[0].competitions[0].competitors[0].linescores.pop();
 assert.equal(quarterPrediction(prediction,h).status,'pending');
 const bad=fixture();bad.events[0].competitions[0].competitors[0].score='1';assert.equal(quarterPrediction(prediction,bad).status,'pending');
 const live=fixture();live.events[0].status.type.completed=false;assert.equal(quarterPrediction(prediction,live).status,'pending');
});
test('來源不齊、來源晚於預測或開賽後預測不得產生',()=>{
 assert.equal(quarterPrediction(prediction,{...fixture(),complete:false}).status,'pending');
 const h=fixture();h.receipts=h.receipts.map((r,i)=>i? r:{...r,observedAt:'2026-11-07T01:00:00Z'});
 assert.equal(quarterPrediction(prediction,h).status,'pending');
 assert.equal(quarterPrediction({...prediction,generatedAt:prediction.startAt},fixture()).status,'pending');
});
test('不同球季、賽前以後比賽和重複衝突均不納入',()=>{
 const h=fixture();h.events[0].season.year=2026;assert.equal(quarterPrediction(prediction,h).status,'pending');
 const future=fixture();future.events[0].date='2026-11-07T01:00:00Z';assert.equal(quarterPrediction(prediction,future).status,'pending');
 const conflict=fixture();const repeat=event('1','BOS','LAL');repeat.competitions[0].competitors[0].linescores[0].value++;repeat.competitions[0].competitors[0].score='87';conflict.events.push(repeat);assert.equal(quarterPrediction(prediction,conflict).status,'pending');
});

