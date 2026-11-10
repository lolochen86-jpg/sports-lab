import test from 'node:test';
import assert from 'node:assert/strict';
import {retainPregamePredictions} from '../lib/prediction-retention.mjs';
import {todayPredictions,nextTaipeiMidnight,taipeiDay} from '../public/today-predictions.js';
const now=Date.parse('2026-11-06T05:00:00Z');
const game={id:'game',league:'NBA',away:'BKN',home:'LAL',startAt:'2026-11-06T02:00:00Z'};
const prediction={gameId:'game',league:'NBA',away:'BKN',home:'LAL',startAt:game.startAt,generatedAt:'2026-11-06T01:00:00Z',status:'experimental',calibrated:false,homeWinProbability:.6,awayWinProbability:.4,historyHash:'abc'};
test('save only matching pregame predictions and retain across updates',()=>{
 const scenario={gameId:'game',status:'pending',calibrated:false,generatedAt:'2026-11-06T01:10:00Z',reason:'待確認'};
 const a=retainPregamePredictions({games:[game]},{researchPredictions:[prediction],injuryScenarios:[scenario]},now);assert.equal(a.length,1);assert.equal(a[0].archivedScenario.reason,'待確認');
 const afterStart={...scenario,generatedAt:'2026-11-06T02:10:00Z'};
 assert.equal(retainPregamePredictions({games:[game]},{researchPredictions:[prediction],injuryScenarios:[afterStart]},now)[0].archivedScenario,null);
 assert.equal(retainPregamePredictions({games:[game]},{retainedPredictions:a},now).length,1);
 assert.equal(retainPregamePredictions({games:[game]},{researchPredictions:[{...prediction,generatedAt:'2026-11-06T02:01:00Z'}]},now).length,0);
 assert.equal(retainPregamePredictions({games:[{...game,home:'BOS'}]},{researchPredictions:[prediction]},now).length,0);
});
test('today stays above tomorrow and unknown past prediction is not invented',()=>{
 const pending={...prediction,status:'pending',generatedAt:'2026-11-06T04:00:00Z'};
 const tomorrow={...prediction,gameId:'tomorrow',startAt:'2026-11-07T02:00:00Z'};
 const list=todayPredictions([tomorrow,pending],'NBA',now,[prediction]);
 assert.deepEqual(list.map(x=>x.gameId),['game','tomorrow']);assert.equal(list[0].archivedPregame,true);assert.equal(list[0].generatedAt,prediction.generatedAt);
 assert.equal(todayPredictions([pending],'NBA',now)[0].reason,'沒有可核對的賽前預測存檔');
 const midnight=Date.parse('2026-11-06T16:00:00Z');assert.equal(nextTaipeiMidnight(midnight-1),midnight);assert.equal(taipeiDay(midnight),'2026-11-07');
});
test('retained-only predictions appear only with a unique matching game and verified pregame identity',()=>{
 const past={...game,status:'final',conflicts:[]};
 const list=todayPredictions([],'NBA',now,[prediction],[past]);
 assert.equal(list.length,1);assert.equal(list[0].gameId,'game');assert.equal(list[0].archivedPregame,true);
 assert.equal(todayPredictions([],'NBA',now,[prediction],[]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[prediction],[{...past,home:'BOS'}]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[prediction],[{...past,startAt:'2026-11-06T02:01:00Z'}]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[prediction],[past,past]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[prediction],[{...past,conflicts:['score conflict']}]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[prediction],[{...past,status:'postponed'}]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[{...prediction,generatedAt:game.startAt}],[past]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[{...prediction,homeWinProbability:1.1,awayWinProbability:-.1}],[past]).length,0);
 assert.equal(todayPredictions([],'NBA',now,[{...prediction,historyHash:null}],[past]).length,0);
});
test('retained-only cannot fabricate future or prior-day forecasts; existing current rows remain single and sorted',()=>{
 const past={...game,status:'final',conflicts:[]};
 const other={...prediction,gameId:'other',startAt:'2026-11-06T04:00:00Z',generatedAt:'2026-11-06T03:00:00Z'};
 const otherGame={...past,id:'other',startAt:other.startAt};
 const tomorrow={...prediction,gameId:'tomorrow',startAt:'2026-11-07T02:00:00Z'};
 const beforeToday={...prediction,gameId:'yesterday',startAt:'2026-11-05T02:00:00Z',generatedAt:'2026-11-05T01:00:00Z'};
 assert.deepEqual(todayPredictions([tomorrow],'NBA',now,[other,prediction,beforeToday],[past,otherGame,{...past,id:'yesterday',startAt:beforeToday.startAt}]).map(x=>x.gameId),['game','other','tomorrow']);
 assert.equal(todayPredictions([prediction],'NBA',now,[prediction],[past]).length,1);
 assert.equal(todayPredictions([],'NBA',now,[tomorrow],[{...past,id:'tomorrow',startAt:tomorrow.startAt}]).length,0);
});

