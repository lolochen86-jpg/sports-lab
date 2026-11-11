import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNordberg,nordbergCard} from '../public/nordberg-prediction.js';
const names=['point_diff','efg','ast_to','ftr','offensive_rebounds','defensive_rebounds'];
const at=Date.parse('2026-11-11T12:00:00Z');
function make(){
 const game={id:'game',league:'NBA',home:'IND',away:'WAS',startAt:'2026-11-12T00:00:00Z',status:'scheduled',comparison:'matched_websites',conflicts:[]};
 const terms=names.flatMap((n,i)=>['home','away'].map((s,j)=>{const value=(i+1)*.1+j,coefficient=.1*(i+1)*(j?-1:1);return {name:s+'_'+n,team:s==='home'?'IND':'WAS',featureValue:value,coefficient,product:value*coefficient};}));
 const intercept=.25,linearScore=intercept+terms.reduce((s,x)=>s+x.product,0),h=1/(1+Math.exp(-linearScore));
 const p={gameId:'game',league:'NBA',home:'IND',away:'WAS',startAt:game.startAt,generatedAt:'2026-11-11T11:30:00Z',observedAt:'2026-11-11T11:25:00Z',dataObservedAt:'2026-11-11T11:20:00Z',status:'experimental',model:'nordberg-last10-logit-refit-v1',source:'https://github.com/tylernordberg0/nba-game-predictor',dataSource:'https://www.boxscorelab.com/downloads/',historyThrough:'2026-11-09',trainingCutoff:'2026-04-12',homeWinProbability:h,awayWinProbability:1-h,trace:{intercept,linearScore,terms}};
 return {game,p};
}
test('shows sourced 12-term model with numerical calculations and limitations',()=>{
 const {game,p}=make(),html=nordbergCard(game,[p],[],at);assert.match(html,/近 10 場球隊數據模型/);assert.match(html,/展開公式與 12 個數據/);assert.match(html,/未直接納入球員、傷病/);assert.match(html,/BoxScore Lab/);assert.equal((html.match(/<tr><th scope="row">/g)||[]).length,12);
});
test('rejects manipulated values, data leakage, stale timestamps, wrong matches or missing source',()=>{
 const mutations=[x=>x.trace.terms[0].coefficient++,x=>x.trace.terms.pop(),x=>x.trace.terms[0].team='WAS',x=>x.homeWinProbability=.99,x=>x.observedAt='2026-11-11T11:45:00Z',x=>x.dataObservedAt='2026-11-11T11:45:00Z',x=>x.historyThrough='2026-11-11',x=>x.source='https://example.org',x=>x.home='BOS'];
 for(const mutate of mutations){const {game,p}=make();mutate(p);assert.equal(selectNordberg(game,[p],[],at).prediction,null);}
 const {game,p}=make();assert.equal(selectNordberg(game,[p],[],at+73*3600000).prediction,null);
});
test('after tipoff reads only a verified original pregame archive',()=>{
 const {game,p}=make(),after=time(game.startAt)+1000;game.status='live';assert.equal(selectNordberg(game,[p],[],after).prediction,null);const archive=selectNordberg(game,[],[p],after);assert.equal(archive.prediction,p);assert.equal(archive.archived,true);assert.match(nordbergCard(game,[],[p],after),/賽前存檔/);p.generatedAt='2026-11-12T00:01:00Z';assert.equal(selectNordberg(game,[],[p],after).prediction,null);
});
function time(s){return Date.parse(s);}
test('pending and malicious reason remain non-executable and never show a probability',()=>{
 const {game,p}=make();p.status='pending';p.reason='<img src=x onerror=alert(1)>';const html=nordbergCard(game,[p],[],at);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.doesNotMatch(html,/勝率/);
});
