import test from 'node:test';
import assert from 'node:assert/strict';
import {lineupStrength,originalW0Reference} from '../lib/lineup-core.mjs';

const asOf='2026-11-11T10:00:00.000Z';
const receipt={url:'https://example.test/source',observedAt:'2026-11-11T09:00:00.000Z',stale:false};
const player=(i,team='AAA')=>({id:String(i),name:`P${i}`,team,ratingFamily:'OpenRAPM',rating:i,availabilityType:'season_estimate',availability:1,minutesIfAvailable:30,availabilityReceipt:receipt,minutesReceipt:receipt,ratingReceipt:receipt});
const input=()=>({team:'AAA',ratingFamily:'OpenRAPM',asOf,rosterReceipt:receipt,players:Array.from({length:8},(_,i)=>player(i+1))});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('reproduces published minute weighting with full 240-minute budget',()=>{
 const x=lineupStrength(input()); assert.equal(x.status,'scenario');
 near(x.rotation.reduce((s,p)=>s+p.allocatedMinutes,0),240);
 near(x.teamStrength,22.5); near(x.rotation[0].allocatedMinutes,30);
 assert.equal(x.rotation[0].availabilityType,'season_estimate');
});
test('confirmed out gets zero weight and freed minutes go to the rest',()=>{
 const a=input(),base=lineupStrength(a);a.players[7].availabilityType='confirmed_out';a.players[7].availability=0;
 const x=lineupStrength(a);assert.equal(x.status,'scenario');
 near(x.rotation.reduce((s,p)=>s+p.allocatedMinutes,0),240);
 near(x.rotation.find(p=>p.id==='8').allocatedMinutes,0);
 near(x.teamStrength,20);assert.ok(x.teamStrength<base.teamStrength);
});
test('unreported injury is visible as an assumption, not a confirmed active player',()=>{
 const a=input();a.players[0].availabilityType='unreported_assumption';const x=lineupStrength(a);
 assert.equal(x.status,'scenario');assert.equal(x.rotation.find(p=>p.id==='1').availabilityType,'unreported_assumption');
 assert.ok(x.limitations.some(s=>s.includes('並非確認健康')));
});
test('never treats a conflict, absent evidence or stale source as healthy',()=>{
 for(const amend of [p=>p.availability=null,p=>p.availabilityType='conflict',p=>p.availabilityReceipt=null,p=>p.minutesReceipt={...receipt,stale:true},p=>p.ratingReceipt={...receipt,observedAt:'2026-11-11T11:00:00.000Z'}]){
  const a=input();amend(a.players[0]);assert.equal(lineupStrength(a).status,'pending');
 }
});
test('rejects duplicates, wrong team, unavailable rating, and impossible minutes',()=>{
 for(const amend of [a=>a.players[1].id=a.players[0].id,a=>a.players[0].team='BBB',a=>a.players[0].rating=null,a=>a.players[0].minutesIfAvailable=49]){
  const a=input();amend(a);assert.equal(lineupStrength(a).status,'pending');
 }
});
test('rejects ambiguous active fifteen cutoff and improbable one-player minutes',()=>{
 let a=input();a.players=Array.from({length:16},(_,i)=>player(i+1));assert.equal(lineupStrength(a).status,'pending');
 a=input();a.players[0].minutesIfAvailable=48;for(let i=1;i<a.players.length;i++)a.players[i].minutesIfAvailable=1;assert.equal(lineupStrength(a).status,'pending');
});
test('never applies NAIL calibration to OpenRAPM or missing back-to-back information',()=>{
 const x=lineupStrength(input());assert.equal(originalW0Reference({home:x,away:x,homeBackToBack:0,awayBackToBack:0,inputProvenance:'original-published-frozen-preseason-NAIL-W0'}).status,'pending');
 const a={...x,ratingFamily:'NAIL'};assert.equal(originalW0Reference({home:a,away:a,homeBackToBack:null,awayBackToBack:0,inputProvenance:'original-published-frozen-preseason-NAIL-W0'}).status,'pending');
 const result=originalW0Reference({home:a,away:a,homeBackToBack:1,awayBackToBack:0,inputProvenance:'original-published-frozen-preseason-NAIL-W0'});assert.equal(result.status,'reference_only');near(result.edge,1.33);near(result.homeWinProbability,1/(1+Math.exp(-0.1053*1.33)));
});
