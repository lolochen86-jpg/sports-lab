import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRookieRoster, filterRookies } from '../public/rookie-filter.js';
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
