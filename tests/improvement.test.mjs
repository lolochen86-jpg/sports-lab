import test from 'node:test';
import assert from 'node:assert/strict';
import {improvementRanking} from '../public/improvement.js';
import {collectImprovement} from '../lib/improvement.mjs';
const p=(id,g,pts)=>({id,name:id,stats:{gamesPlayed:g,avgPoints:pts}});
test('今年至少四場、排名前100、比較前季且只顯示進步',()=>{
 const current={seasonYear:2027,players:[p('leader',4,20),p('better',5,19),p('three',3,100),p('new',4,18),p('worse',6,17),...Array.from({length:101},(_,i)=>p('extra'+i,4,16-i/100))]};
 const previous={seasonYear:2026,players:[p('leader',20,19),p('better',5,14),p('three',30,1),p('worse',20,18),...Array.from({length:101},(_,i)=>p('extra'+i,30,15))]};
 const rows=improvementRanking(current,previous,'avgPoints');assert.equal(rows[0].id,'better');assert.equal(rows[0].change,5);assert.ok(!rows.some(x=>['three','new','worse','extra100'].includes(x.id)));assert.ok(rows.every(x=>x.currentRank<=100&&x.stats.gamesPlayed>=4));
 assert.deepEqual(improvementRanking(current,{...previous,seasonYear:2025},'avgPoints'),[]);
});
test('並列第100名可入榜',()=>{const a=Array.from({length:99},(_,i)=>p('p'+i,4,200-i));const c={seasonYear:2027,players:[...a,p('tie1',4,100),p('tie2',4,100),p('over',4,99)]};const prev={seasonYear:2026,players:c.players.map(x=>p(x.id,10,x.stats.avgPoints-1))};const rows=improvementRanking(c,prev,'avgPoints');assert.equal(rows.find(x=>x.id==='tie2').currentRank,100);assert.ok(!rows.some(x=>x.id==='over'));});
test('來源失敗時標示舊資料不假裝即時',async()=>{const old={current:{seasonYear:2027},previous:{seasonYear:2026}};const result=await collectImprovement({get:async()=>{throw Error('offline')}},old);assert.equal(result.status,'stale');});
test('前季來源失敗時保留新鮮當季球員數據，但不啟用進步比較',async()=>{const body=JSON.stringify({requestedSeason:{year:2027,type:{id:'2'},displayName:'2026-27'},pagination:{count:1},categories:[{name:'general',names:['gamesPlayed']}],athletes:[{athlete:{id:'1',displayName:'Player',teamShortName:'BOS'},categories:[{name:'general',values:[5]}]}]});const client={get:async j=>{if(j.id==='improvement-previous')throw Error('old season unavailable');return {body,stale:false,observedAt:'2026-11-11T11:00:00Z',sha256:'abc'};}};const r=await collectImprovement(client,{previous:{seasonYear:2026,players:[]}});assert.equal(r.status,'stale');assert.equal(r.currentStatus,'available');assert.equal(r.current.players.length,1);assert.equal(r.current.stale,false);assert.equal(r.previous.stale,true);});

