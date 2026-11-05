import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRookieRoster, filterRookies, partitionAppearances } from '../public/rookie-filter.js';
test('full roster, missing experience, duplicates and stale sources are handled honestly', () => {
 const now=Date.now(), team={observedAt:new Date(now).toISOString(), source:'source', players:[
  {id:'1',name:'One',experience:0},{id:'2',name:'Two',experience:2},{id:'3',name:'Unknown',experience:null},
  {id:'4',name:'Ambiguous',experience:1},{id:'5',name:'Veteran',experience:3},{id:'6',name:'Duplicate',experience:0}]};
 const result=buildRookieRoster({teams:[team,{stale:true,players:[{id:'6',name:'Duplicate',experience:0},{id:'7',name:'Stale',experience:2}]}]},now);
 assert.deepEqual(result.rows.map(p=>p.id),['1','7','2']);
 assert.equal(result.rows.find(p=>p.id==='7').rosterStale,true);
 assert.deepEqual(result.unresolved.map(p=>p.id).sort(),['3','4','6']);
 assert.deepEqual(filterRookies(result.rows,'rookie').map(p=>p.id),['1']);
 assert.deepEqual(filterRookies(result.rows,'sophomore').map(p=>p.id),['7','2']);
 assert.equal(filterRookies(result.rows).length,3);
});
test('only fresh roster players with a verified positive NBA season games count are included', () => {
 const rows=[{id:'1'},{id:'2'},{id:'3'},{id:'4',rosterStale:true},{id:'5'}];
 const stats=[{id:'1',stats:{gamesPlayed:3}},{id:'2',stats:{gamesPlayed:0}},{id:'4',stats:{gamesPlayed:2}},{id:'5',stats:{gamesPlayed:null}}];
 const p=partitionAppearances(rows,stats);
 assert.deepEqual(p.played.map(x=>x.id),['1']);
 assert.deepEqual(p.noGames.map(x=>x.id),['2']);
 assert.deepEqual(p.pending.map(x=>x.id),['3','4','5']);
 assert.equal(partitionAppearances(rows,null).played.length,0);
});
