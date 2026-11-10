import test from 'node:test';
import assert from 'node:assert/strict';
import {predictionWalkthrough} from '../public/prediction-walkthrough.js';
const p = {gameId:'test', league:'NBA', status:'experimental', generatedAt:'2026-11-10T00:00:00Z',expectedAway:100,expectedHome:101};
const scenario = {status:'experimental',players:[{player:'<script>alert(1)</script>',points:20,adjustment:5,games:3,minutes:30,source:'javascript:alert(1)',injurySources:[{provider:'<img>',reference:'javascript:alert(1)'}]}],expectedAway:95,expectedHome:101};
test('legacy archive never reconstructs missing raw points and explains missing trace',()=>{
 const html=predictionWalkthrough(p,scenario);
 assert.match(html,/原始場均未保存；已存扣分 5\.00/);
 assert.doesNotMatch(html,/20\.0000 × 25%/);
 assert.match(html,/未保存當時的賽程來源明細/);
 assert.match(html,/沒有保存完整計算明細/);
});
test('untrusted player names and source URLs cannot inject markup',()=>{
 const html=predictionWalkthrough(p,scenario);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>|href="javascript:/);
});
test('saved pregame source snapshot shows provider and observation timing',()=>{
 const forecast={...p,calculationTrace:{scheduleObservations:[{provider:'espn',sourceUrl:'https://example.com/schedule?key=1',observedAt:'2026-11-09T23:00:00Z',startAt:'2026-11-10T01:00:00Z',status:'scheduled'}]}};
 const html=predictionWalkthrough(forecast,null,{providerNames:{espn:'ESPN'}});
 assert.match(html,/預測當時保存的賽程觀測/);
 assert.match(html,/href="https:\/\/example\.com\/schedule\?key=1"/);
 assert.match(html,/未開賽/);
 assert.match(html,/歷史比分來源/);
});
test('partial and pending data produce explicit pending text, not made-up numbers',()=>{
 assert.equal(predictionWalkthrough({...p,status:'pending'},null),'');
 assert.equal(predictionWalkthrough({...p,league:'MLB'},null),'');
 const html=predictionWalkthrough({...p,quarterPrediction:{status:'pending',reason:'資料不足'}},{status:'pending',reason:'來源衝突',unresolved:[{player:'球員',team:'ABC',status:'CONFLICT'}]});
 assert.match(html,/資料不足/);assert.match(html,/來源衝突/);assert.match(html,/球員/);
});
test('injury uses stored raw points and detailed game log only when preserved',()=>{
 const row={player:'球員',points:19.5,rawPoints:19.5234,adjustment:4.88,games:3,minutes:30,gameLog:[{eventId:'123',points:20,minutes:30}]};
 const html=predictionWalkthrough(p,{...scenario,players:[row]});
 assert.match(html,/19\.5234 × 25% ＝ 4\.88/);assert.match(html,/比賽 123/);
});
