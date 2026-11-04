import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveGameHistory} from '../lib/game-history.mjs';
test('歷史日期與賽事跨日保留，使用最近快照並排除新預測',()=>{
 const old={generatedAt:'2026-11-04T13:00:00Z',targetDates:['2026-11-04','2026-11-05'],historicalDates:['2026-11-03'],historicalGames:[{id:'older',date:'2026-11-03'}],games:[{id:'one',date:'2026-11-04',forecastEligible:true},{id:'future',date:'2026-11-05'}]};
 const next={targetDates:['2026-11-05','2026-11-06']};preserveGameHistory(next,old);
 assert.deepEqual(next.historicalDates,['2026-11-03','2026-11-04']);
 assert.deepEqual(next.historicalGames.map(g=>g.id),['older','one']);
 assert.equal(next.historicalGames[1].forecastEligible,false);assert.equal(next.historicalGames[1].archiveObservedAt,old.generatedAt);
 const later={targetDates:['2026-11-06','2026-11-07']};preserveGameHistory(later,{...next,generatedAt:'2026-11-05T13:00:00Z',games:[{id:'two',date:'2026-11-05'}]});assert.equal(later.historicalGames.length,3);
});
