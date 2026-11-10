import test from 'node:test';import assert from 'node:assert/strict';import {compareInjuries,gatherInjuryEvidence} from '../lib/injury-scenario.mjs';
const at='2026-11-03T00:00:00Z',p={gameId:'g',status:'experimental',away:'BOS',home:'ORL',expectedAway:110,expectedHome:112,awayWinProbability:.45,homeWinProbability:.55};
const o=(provider,status='OUT')=>({provider,status,playerId:provider==='espn'?'123':undefined,stale:false,observedAt:at,sha256:'a'.repeat(64),reference:'https://example.com'});
const injury={id:'BOS:player',team:'BOS',player:'Player',status:'OUT',comparison:'reported_agreement',confirmedLineup:false,observations:[o('espn'),o('cbs')]};
const ev={[injury.id]:{espnId:'123',logs:[{eventId:'1',minutes:30,points:20},{eventId:'2',minutes:30,points:20},{eventId:'3',minutes:30,points:20}],source:'https://example.com',observedAt:at,sha256:'a'.repeat(64)}};
test('雙來源缺陣與足夠紀錄才計算情境，並保留依據',()=>{let [s]=compareInjuries([p],[injury],ev,true,at);assert.equal(s.status,'experimental');assert.equal(s.expectedAway,105);assert.equal(s.players[0].games,3);assert.equal(s.players[0].adjustment,5);assert.equal(s.calibrated,false);});
test('來源衝突、不明狀態、缺球員紀錄或來源失敗均待確認',()=>{for(const [i,e,ok] of [[{...injury,status:'CONFLICT'},ev,true],[{...injury,status:'QUESTIONABLE'},ev,true],[injury,{},true],[{...injury,observations:[o('espn')]},ev,true],[injury,ev,false]])assert.equal(compareInjuries([p],[i],e,ok,at)[0].status,'pending');});
test('無符合條件缺陣者的情境和基準相同',()=>{const [s]=compareInjuries([p],[],{},true,at);assert.equal(s.homeWinProbability,p.homeWinProbability);assert.equal(s.awayWinProbability,p.awayWinProbability);});
test('球員紀錄只計匹配的當季例行賽與球隊',async()=>{const events=['1','2','3','4'].map((id,i)=>({id,season:{year:2027,type:i===3?1:2},date:'2026-11-01T00:00:00Z',status:{type:{completed:true}},competitions:[{competitors:[{team:{abbreviation:'BOS'}},{team:{abbreviation:'ORL'}}]}]}));const body=JSON.stringify({gameLog:{statistics:[{displayName:'totals',names:['minutes','points'],events:events.map(e=>({eventId:e.id,stats:['20','10']}))}]}});const client={get:async()=>({body,observedAt:at,sha256:'a'.repeat(64)})};const g={status:'scheduled',startAt:'2026-11-04T00:00:00Z',away:'BOS',home:'ORL'};const result=await gatherInjuryEvidence(client,[g],[injury],{events},at);assert.equal(result[injury.id].logs.length,3);assert.deepEqual(result[injury.id].logs.map(x=>x.eventId),['1','2','3']);});
test('部分資料可用時明示不足，且只調整有證據的缺陣球員',()=>{const other={...injury,id:'ORL:other',team:'ORL',player:'Other',status:'QUESTIONABLE',observations:[o('espn','QUESTIONABLE')]};const [s]=compareInjuries([p],[injury,other],ev,true,at);assert.equal(s.status,'experimental');assert.equal(s.coverage,'partial');assert.equal(s.players.length,1);assert.equal(s.unresolved[0].player,'Other');});

test('傷病調整留存基準、各球員逐場數據與扣分假設',()=>{
 const [s]=compareInjuries([p],[injury],ev,true,at),t=s.calculationTrace;
 assert.equal(t.baselineAway,110);assert.equal(t.awayDeduction,5);assert.equal(t.capPerTeam,8);assert.equal(t.playerScoringFraction,.25);
 assert.equal(s.players[0].rawPoints,20);assert.deepEqual(s.players[0].gameLog,ev[injury.id].logs);
 assert.equal(t.awayBeforeRounding,105);assert.equal(s.expectedAway,+t.awayBeforeRounding.toFixed(1));
});
