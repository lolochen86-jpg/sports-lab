import test from 'node:test';import assert from 'node:assert/strict';import {calculatePredictions} from '../lib/prediction.mjs';
const at='2026-11-03T00:00:00Z';const game={id:'nba-example',league:'NBA',away:'BOS',home:'ORL',startAt:'2026-11-03T02:00:00Z',status:'scheduled',sourceCount:2,conflicts:[],comparison:'matched_websites',observations:[{provider:'espn',seasonType:2,seasonYear:2027}]};
const event=(id,season=2,date='2026-11-01T01:00:00Z')=>({id,season:{year:2027,type:season},date,status:{type:{completed:true}},competitions:[{competitors:[{homeAway:'away',team:{abbreviation:'BOS'},score:'110'},{homeAway:'home',team:{abbreviation:'ORL'},score:'100'}]}]});
const history={complete:true,events:[event('1'),event('2'),event('3')],receipts:[]};
test('只有符合條件的未開賽賽事產生可重現的研究預測',()=>{const [p]=calculatePredictions([game],history,at);assert.equal(p.status,'experimental');assert.equal(p.calibrated,false);assert.equal(p.awaySamples,3);assert.equal(p.homeSamples,3);assert.equal(p.homeWinProbability+p.awayWinProbability,1);assert.deepEqual(p,calculatePredictions([game],history,at)[0]);});
test('缺少歷史、來源、球隊樣本或已開賽時不發布',()=>{for(const [g,h] of [[game,{...history,complete:false}],[{...game,sourceCount:1},history],[{...game,status:'live'},history],[{...game,startAt:at},history],[{...game,league:'MLB'},history],[game,{...history,events:[event('1',1),event('2',1),event('3',1)]}]])assert.equal(calculatePredictions([g],h,at)[0].status,'pending');});
test('例行賽以外或在預測時間之後的比分不進模型',()=>{const h={...history,events:[...history.events,event('4',1),event('5',2,'2026-11-03T01:00:00Z')]};const p=calculatePredictions([game],h,at)[0];assert.equal(p.leagueSamples,3);assert.deepEqual(p.inputGameIds,['1','2','3']);});

test('季前賽或缺少賽季身分不可產生預測',()=>{for(const obs of [[],[{provider:'espn',seasonType:1,seasonYear:2027}],[{provider:'espn',seasonType:2,seasonYear:2027,stale:true}]])assert.equal(calculatePredictions([{...game,observations:obs}],history,at)[0].status,'pending');});

test('每場比分的計算紀錄保留原始樣本、平滑及確切預估，不改變模型結果',()=>{
 const [p]=calculatePredictions([game],history,at),t=p.calculationTrace;
 assert.equal(t.leagueAverage,105);assert.equal(t.priorGames,8);assert.equal(t.leagueSamples,3);
 assert.deepEqual(t.away.samples[0],{id:'1',date:'2026-11-01T01:00:00Z',opponent:'ORL',scored:110,allowed:100});
 assert.equal(t.away.rawScored,110);assert.equal(t.away.rawAllowed,100);
 assert.equal(t.away.adjustedScored,(330+8*105)/11);assert.equal(t.home.adjustedAllowed,(330+8*105)/11);
 assert.equal(t.away.expectedBeforeRounding,(t.away.adjustedScored+t.home.adjustedAllowed)/2-0.75);
 assert.equal(p.expectedAway,+t.away.expectedBeforeRounding.toFixed(1));
 assert.equal(t.simulations,10000);assert.equal(t.teamScoreStdDev,12);
 assert.equal(calculatePredictions([game],{...history,complete:false},at)[0].calculationTrace,undefined);
});

test('賽程來源快照只保存預測時間以前的新鮮觀測',()=>{
 const valid={...game.observations[0],provider:'espn',observedAt:'2026-11-02T23:59:00Z',sourceUrl:'https://example.com/scoreboard',sha256:'digest',status:'scheduled',startAt:game.startAt,away:game.away,home:game.home};
 const [p]=calculatePredictions([{...game,observations:[valid,{...valid,provider:'late',observedAt:'2026-11-03T00:01:00Z'},{...valid,provider:'stale',stale:true},{...valid,provider:'unknown-time',observedAt:null}]}],history,at);
 assert.deepEqual(p.calculationTrace.scheduleObservations,[{provider:'espn',sourceUrl:'https://example.com/scoreboard',observedAt:'2026-11-02T23:59:00Z',sha256:'digest',stale:false,status:'scheduled',startAt:game.startAt,away:'BOS',home:'ORL',seasonYear:2027,seasonType:2}]);
});
