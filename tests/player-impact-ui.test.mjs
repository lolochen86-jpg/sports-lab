import test from 'node:test';
import assert from 'node:assert/strict';
import {playerImpactCard,selectPlayerImpactScenario} from '../public/player-impact.js';
const now=Date.parse('2026-11-11T12:00:00.000Z');
const game={id:'a',league:'NBA',away:'WAS',home:'IND',startAt:'2026-11-12T00:00:00.000Z',status:'scheduled',comparison:'matched_websites',conflicts:[]};
function team(code){const rotation=Array.from({length:8},(_,i)=>({id:String(i+1),name:`Player ${i+1}`,availabilityType:i===1?'conflict_assumption':'unreported_assumption',availability:1,minutesIfAvailable:30,rating:2,allocatedMinutes:30,contribution:1.25}));return {status:'scenario',team:code,ratingFamily:'adj-RAPM',asOf:'2026-11-11T11:00:00.000Z',rawTotal:240,teamStrength:10,rotation,outPlayers:[{name:'Out Person'}],coverage:{eligible:8,matchedMinutes:200,allMinutes:250,unmatchedPlayers:[{name:'Missed Player',reason:'未核對'}],rosterMissing:[{name:'New Player',reason:'當季資料不足'}]}};}
function forecast(){return {gameId:game.id,league:'NBA',away:game.away,home:game.home,startAt:game.startAt,status:'scenario',model:'sportsdataverse-rapm-minute-weighted-v1',generatedAt:'2026-11-11T11:00:00.000Z',awayTeam:team('WAS'),homeTeam:team('IND')};}
test('renders lineup weights, detailed assumptions and limitations',()=>{
 const html=playerImpactCard(game,[forecast()],now,{shortTeam:x=>x,playerName:x=>'中文'});
 assert.match(html,/球員陣容影響情境/);assert.match(html,/30\.00/);assert.match(html,/1\.25/);assert.match(html,/10\.00/);assert.match(html,/來源衝突，暫按可出賽試算/);assert.match(html,/未通報傷病不代表確認健康/);assert.match(html,/不提供勝率/);assert.match(html,/Out Person/);assert.match(html,/中文 \/ Player 1/);assert.match(html,/80.0%/);assert.match(html,/Missed Player/);assert.match(html,/New Player/);
});
test('rejects stale, wrong game, tampering, future or postgame situations',()=>{
 for(const mutate of [p=>p.home='BKN',p=>p.generatedAt='2026-11-10T11:00:00.000Z',p=>p.generatedAt='2026-11-11T13:00:00.000Z',p=>p.awayTeam.rotation[0].contribution=42,p=>p.homeTeam.teamStrength=99,p=>p.awayTeam.rotation[0].availabilityType='confirmed_out',p=>p.homeTeam.asOf='2026-11-11T12:00:00.000Z']){const p=forecast();mutate(p);assert.equal(selectPlayerImpactScenario(game,[p],now).scenario,null);}
 assert.equal(selectPlayerImpactScenario({...game,status:'final'},[forecast()],now).scenario,null);
 assert.equal(selectPlayerImpactScenario({...game,comparison:'conflict'},[forecast()],now).scenario,null);
 assert.equal(selectPlayerImpactScenario(game,[forecast(),forecast()],now).scenario,null);
});
test('escapes untrusted names and pending reasons',()=>{
 const p=forecast();p.homeTeam.rotation[0].name='<img src=x onerror=alert(1)>';assert.doesNotMatch(playerImpactCard(game,[p],now),/<img src=x/);
 assert.doesNotMatch(playerImpactCard(game,[{...p,status:'pending',reason:'<img src=x>'}],now),/<img src=x/);
});
function saved(){const p=forecast(), receipt={observedAt:'2026-11-11T10:59:00.000Z',sha256:'a'.repeat(64),stale:false};for(const t of [p.homeTeam,p.awayTeam]){t.ratingReceipt={...receipt};t.crosswalkReceipt={...receipt};t.rosterReceipt={...receipt};t.injurySources=[{...receipt},{...receipt}];t.rotation[0].injurySources=[{...receipt}];}return p;}
test('after tipoff renders only the original validated pregame archive',()=>{
 const p=saved(),post=Date.parse(game.startAt)+1000,g={...game,status:'live'};
 assert.equal(selectPlayerImpactScenario(g,[p],post).scenario,null);
 assert.equal(selectPlayerImpactScenario(g,[],post,[p]).archived,true);
 assert.match(playerImpactCard(g,[],post,{},[p]),/球員陣容賽前情境存檔/);
 assert.equal(selectPlayerImpactScenario({...g,status:'final'},[],post,[p]).archived,true);
 assert.equal(selectPlayerImpactScenario(game,[],now,[p]).scenario,null);
});
test('archive refuses after-game revisions, future source observations, wrong identity and stale receipts',()=>{
 const post=Date.parse(game.startAt)+1000,g={...game,status:'final'};
 for(const mutate of [p=>p.generatedAt=game.startAt,p=>p.homeTeam.asOf=game.startAt,p=>p.away='BKN',p=>p.homeTeam.ratingReceipt.observedAt='2026-11-11T11:30:00Z',p=>p.homeTeam.rotation[0].injurySources[0].observedAt=game.startAt,p=>p.homeTeam.rosterReceipt.stale=true,p=>p.homeTeam.crosswalkReceipt.sha256='bad',p=>p.homeTeam.injurySources=[]]){const p=saved();mutate(p);assert.equal(selectPlayerImpactScenario(g,[],post,[p]).scenario,null);}
 assert.equal(selectPlayerImpactScenario(g,[],post,[saved(),saved()]).scenario,null);
});
