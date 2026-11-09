import test from 'node:test';
import assert from 'node:assert/strict';
import {quarterPredictionCard} from '../public/quarter-prediction.js';
test('shows four quarter values and independent regulation totals',()=>{
 const p={quarterPrediction:{status:'experimental',quarters:[1,2,3,4].map(period=>({period,away:25.2,home:26.3})),regulationAway:100.8,regulationHome:105.2,awaySamples:4,homeSamples:5,sources:[],limitations:[]}};
 const text=quarterPredictionCard(p,'籃網','湖人');assert.match(text,/第 4 節/);assert.match(text,/100\.8/);assert.match(text,/正常時間/);assert.match(text,/未含延長賽/);
});
test('old archives are not given reconstructed quarter forecasts',()=>{
 const text=quarterPredictionCard({archivedPregame:true},'籃網','湖人');assert.match(text,/不事後補算/);assert.doesNotMatch(text,/四節合計/);
});

