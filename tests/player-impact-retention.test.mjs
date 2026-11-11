import test from 'node:test';
import assert from 'node:assert/strict';
import {retainPlayerImpactScenarios,validPregamePlayerImpact} from '../lib/player-impact-retention.mjs';
const receipt={url:'https://example.test/source',observedAt:'2026-11-11T08:00:00Z',stale:false};
const team=code=>({status:'scenario',team:code,teamStrength:5,asOf:'2026-11-11T09:00:00Z',ratingReceipt:receipt,crosswalkReceipt:receipt,rosterReceipt:receipt,injurySources:[receipt,receipt],outPlayers:[],rotation:Array.from({length:5},(_,i)=>({id:String(i),allocatedMinutes:48,rating:1,contribution:1,injurySources:[]}))});
const prediction=generatedAt=>({gameId:'G1',league:'NBA',home:'BOS',away:'NYK',startAt:'2026-11-12T01:00:00Z',generatedAt,status:'scenario',model:'sportsdataverse-rapm-minute-weighted-v1',homeTeam:team('BOS'),awayTeam:team('NYK')});
const game=()=>({id:'G1',league:'NBA',home:'BOS',away:'NYK',startAt:'2026-11-12T01:00:00Z',status:'scheduled',comparison:'matched_websites',conflicts:[],observations:[{home:'BOS',away:'NYK',startAt:'2026-11-12T01:00:00Z',status:'scheduled',observedAt:'2026-11-11T08:30:00Z'}]});
const before=Date.parse('2026-11-11T12:00:00Z'),after=Date.parse('2026-11-12T02:00:00Z');
test('previous current scenario is archived after tipoff and survives outages',()=>{
 const p=prediction('2026-11-11T10:00:00Z');const x=retainPlayerImpactScenarios({games:[]},{games:[game()],playerImpactScenarios:[p]},after);
 assert.equal(x.length,1);assert.equal(x[0].archivedPregame,true);assert.equal(x[0].generatedAt,p.generatedAt);
 assert.equal(retainPlayerImpactScenarios({games:[]},{retainedPlayerImpactScenarios:x},after+1000).length,1);
});
test('newer pregame observation replaces earlier pregame one only for the same matchup',()=>{
 const old=prediction('2026-11-11T09:30:00Z'),newer=prediction('2026-11-11T10:00:00Z');
 const x=retainPlayerImpactScenarios({games:[game()],playerImpactScenarios:[newer]},{retainedPlayerImpactScenarios:[old]},before);
 assert.equal(x.length,1);assert.equal(x[0].generatedAt,newer.generatedAt);assert.equal(x[0].archivedPregame,false);
});
test('no current source is used to backfill an already started matchup',()=>{
 const original=prediction('2026-11-11T09:30:00Z'),newer=prediction('2026-11-11T10:00:00Z');
 assert.equal(retainPlayerImpactScenarios({games:[game()],playerImpactScenarios:[newer]},{},after).length,0);
 const x=retainPlayerImpactScenarios({games:[game()],playerImpactScenarios:[newer]},{retainedPlayerImpactScenarios:[original]},after);
 assert.equal(x.length,1);assert.equal(x[0].generatedAt,original.generatedAt);
});
test('rejects data observed later than generated time, wrong game identity and post-tip generated time',()=>{
 for(const mutate of [p=>p.homeTeam.ratingReceipt={...receipt,observedAt:'2026-11-11T11:00:00Z'},p=>p.awayTeam.rotation[0].injurySources=[{...receipt,observedAt:'2026-11-11T11:00:00Z'}],p=>p.homeTeam.team='LAL',p=>p.generatedAt='2026-11-12T01:00:00Z',p=>p.homeTeam.rotation[0].contribution=99]){
  const p=prediction('2026-11-11T10:00:00Z');mutate(p);assert.equal(validPregamePlayerImpact(p,after),false);
 }
});
test('source snapshot must have a matching pregame scheduled observation',()=>{
 const p=prediction('2026-11-11T10:00:00Z'),g=game();g.observations[0].observedAt='2026-11-11T11:00:00Z';
 assert.equal(retainPlayerImpactScenarios({games:[g],playerImpactScenarios:[p]},null,before).length,0);
});
