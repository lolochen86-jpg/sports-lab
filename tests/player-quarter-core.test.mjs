import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlayerQuarterGame,seasonGameCandidates} from '../public/player-quarter-core.js';
const opts={eventId:'123',playerId:'10',seasonYear:2027,now:Date.parse('2026-11-10T12:00:00Z')};
function sample(ot=false){
 const a=ot?[2,1,0,3,0]:[2,1,0,3],b=ot?[1,2,1,2,1]:[1,2,1,2];
 const team=(id,code,periods)=>({team:{id,abbreviation:code},score:String(periods.reduce((n,v)=>n+v,0)),linescores:periods.map(x=>({displayValue:String(x)}))});
 const player=(teamId,id,points)=>({team:{id:teamId},statistics:[{names:['MIN','PTS'],athletes:[{athlete:{id},didNotPlay:false,stats:['36',String(points)]}]}]});
 const plays=[];for(const [teamId,playerId,periods] of [['1','10',a],['2','20',b]])for(let i=0;i<periods.length;i++)if(periods[i])plays.push({id:teamId+'-'+i,scoringPlay:true,scoreValue:periods[i],period:{number:i+1},team:{id:teamId},participants:[{athlete:{id:playerId}},{athlete:{id:teamId==='1'?'20':'10'}}]});
 return {header:{id:'123',season:{year:2027,type:2},competitions:[{id:'123',date:'2026-11-09T00:00:00Z',status:{type:{completed:true}},competitors:[team('1','LAL',a),team('2','BOS',b)]}]},boxscore:{players:[player('1','10',a.reduce((n,v)=>n+v,0)),player('2','20',b.reduce((n,v)=>n+v,0))]},plays};
}
test('counts scorer only, verifies the full ledger and preserves real zeros',()=>{const r=parsePlayerQuarterGame(sample(),opts);assert.equal(r.status,'available');assert.deepEqual(r.quarters,[2,1,0,3]);assert.equal(r.total,6);assert.equal(r.overtime,null);});
test('overtime is separate and zero remains zero',()=>{const r=parsePlayerQuarterGame(sample(true),opts);assert.equal(r.status,'available');assert.deepEqual(r.quarters,[2,1,0,3]);assert.equal(r.overtime,0);});
test('truncated, duplicated, unidentified or inconsistent scoring is rejected',()=>{for(const mutate of [d=>d.plays.pop(),d=>d.plays.push(d.plays[0]),d=>d.plays[0].participants=[],d=>d.plays[0].scoreValue=3,d=>d.header.competitions[0].competitors[0].linescores[0].displayValue='5']){const d=sample();mutate(d);assert.equal(parsePlayerQuarterGame(d,opts).status,'unavailable');}});
test('only the requested player, completed game and correct season may be used',()=>{assert.equal(parsePlayerQuarterGame(sample(),{...opts,playerId:'99'}).status,'unavailable');assert.equal(parsePlayerQuarterGame(sample(),{...opts,seasonYear:2026}).status,'unavailable');const d=sample();d.header.competitions[0].status.type.completed=false;assert.equal(parsePlayerQuarterGame(d,opts).status,'unavailable');});
test('season log returns played regular season games, newest first',()=>{const d={filters:[{name:'season',value:'2027'}],names:['minutes'],events:{'1':{id:'1',gameDate:'2026-10-10T00:00:00Z'},'2':{id:'2',gameDate:'2026-11-01T00:00:00Z'},'3':{id:'3',gameDate:'2026-10-01T00:00:00Z'}},seasonTypes:[{displayName:'2026-27 Regular Season',categories:[{events:[{eventId:'1',stats:['12']},{eventId:'2',stats:['15']}]}]},{displayName:'2026-27 Preseason',categories:[{events:[{eventId:'3',stats:['5']}]}]}]};assert.deepEqual(seasonGameCandidates(d,{seasonYear:2027,now:opts.now}).games.map(x=>x.id),['2','1']);assert.equal(seasonGameCandidates(d,{seasonYear:2026}).status,'unavailable');});

