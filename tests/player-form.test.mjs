import test from 'node:test';import assert from 'node:assert/strict';
import {parseRecentPlayer} from '../lib/recent-player-form.mjs';
test('recent form requires three verified finished games and ignores unverified games',()=>{
 const names=['minutes','points','totalRebounds','assists','steals','blocks','turnovers'];const event=id=>({eventId:id,stats:['30','20','5','4','1','1','2']});const body=JSON.stringify({gameLog:{statistics:[{displayName:'totals',names,events:['1','2','3','4'].map(event)}]}});const at='2026-11-04T12:00:00Z';const finals=new Map(['1','2','3'].map((id,i)=>[id,{date:`2026-11-0${i+1}T00:00:00Z`} ]));const r=parseRecentPlayer(body,finals,at);assert.equal(r.games,3);assert.equal(r.score,34);assert.ok(!r.gameIds.includes('4'));finals.delete('1');assert.throws(()=>parseRecentPlayer(body,finals,at));
});
