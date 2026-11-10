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

test('new predictions display substituted equations for all periods before the closed source details',()=>{
 const side=(name)=>({team:name,samples:[{date:'2026-11-01',scored:100,allowed:101}],rawScored:100,rawAllowed:101,adjustedScored:110,adjustedAllowed:111,expectedBeforeRounding:110.5});
 const per=Array.from({length:4},(_,i)=>({period:i+1,leagueAverage:28,away:{rawScored:25,rawAllowed:26,adjustedScored:27,adjustedAllowed:28},home:{rawScored:26,rawAllowed:27,adjustedScored:28,adjustedAllowed:29}}));
 const prediction={...p,away:'AAA',home:'BBB',homeWinProbability:.6,calculationTrace:{away:side('AAA'),home:side('BBB'),leagueAverage:110,priorGames:8,leagueSamples:10,homeAdjustment:.75,teamScoreStdDev:12,simulations:10000},quarterPrediction:{status:'experimental',quarters:per.map((_,i)=>({period:i+1,away:27.8,home:28.2})),regulationAway:111.2,regulationHome:112.8,calculationTrace:{away:side('AAA'),home:side('BBB'),periods:per,priorGames:8,homeAdjustmentPerQuarter:.1875}}};
 const inj={status:'experimental',players:[{player:'X',team:'AAA',rawPoints:20,adjustment:5}],expectedAway:95,expectedHome:101,calculationTrace:{awayDeduction:5,homeDeduction:0}};
 const html=predictionWalkthrough(prediction,inj);const before=html.split('<details class="formula-sources">')[0];
 assert.match(before,/6000|6,000/);assert.match(before,/10000/);assert.match(before,/2200 ÷ \(2 × 10\) ≈ 110\.0000/);assert.match(before,/1 − 0\.6000 ≈/);assert.match(before,/分差 &gt; 0 為主勝/);assert.match(before,/20\.0000 × 25% ≈ 5\.00/);assert.match(before,/min\(8, 5\.00\)/);assert.match(before,/max\(0, 100\.0 − 5\.00\)/);for(let i=1;i<=4;i++)assert.match(before,new RegExp(`第 ${i} 節`));assert.match(before,/max\(0, \(27\.0000 \+ 29\.0000\) ÷ 2 − 0\.1875\)/);assert.doesNotMatch(before,/NaN/);
});
test('recognized old model gives general formulas without inventing historical input values',()=>{
 const html=predictionWalkthrough({...p,model:'nba-recent-scores-baseline-v1',quarterPrediction:{status:'experimental',model:'nba-quarter-regulation-baseline-v1'}},{status:'experimental',model:'injury-scenario-v1'});
 const before=html.split('<details class="formula-sources">')[0];assert.match(before,/主隊模擬獲勝次數 ÷ 10,000/);assert.match(before,/0\.1875/);assert.match(before,/原始場均|沒有保存完整計算明細/);
});
