import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,collectPlayerImpact} from '../lib/player-impact-forecast.mjs';

test('parses quoted commas and rejects broken CSV',()=>{
 assert.deepEqual(parseCSV('id,name\n1,"Smith, Jr."\n'),[{id:'1',name:'Smith, Jr.'}]);
 assert.throws(()=>parseCSV('id,name\n1,"unclosed'));
});
function fixture(){
 const at=Date.parse('2026-11-11T12:00:00Z'),obs='2026-11-11T11:00:00Z',modified='2026-11-11T10:00:00Z';
 const impact=['player_id,player_name,team_abbreviation,season,season_type,min,gp,adj_rapm'];
 const cross=['season,team_abbreviation,espn_athlete_id,espn_full_name,nba_player_id,nba_player_name,match_method,match_confidence'];
 const rosters={teams:[]},injuries=[];
 for(const [team,offset] of [['BOS',0],['NYK',100]]){
  const players=[];for(let i=1;i<=6;i++){const id=String(offset+i),name=`Player ${team} ${i}`;impact.push(`${id},${name},${team},2027,Regular Season,150,5,${i}`);cross.push(`2027,${team},${id},${name},${id},${name},exact_name,1.0`);players.push({id,name,team});}
  players.push({id:String(offset+99),name:`Missing ${team}`,team});
  rosters.teams.push({team,players,source:'https://example.test/roster',observedAt:obs,stale:false});
 }
 for(let i=0;i<300;i++){impact.push(`${1000+i},Filler ${i},ZZZ,2027,Regular Season,1,1,0`);cross.push(`2027,ZZZ,${1000+i},Filler ${i},${1000+i},Filler ${i},exact_name,1.0`);}
 injuries.push({team:'BOS',player:'Player BOS 6',status:'OUT',observations:[{status:'OUT',provider:'espn',sourceUrl:'https://example.test/injuries',observedAt:obs,stale:false}]});
 injuries.push({team:'NYK',player:'Player NYK 1',status:'QUESTIONABLE',observations:[{status:'QUESTIONABLE',provider:'espn',sourceUrl:'https://example.test/injuries',observedAt:obs,stale:false}]});
 const receipts=['espn-injuries','cbs-injuries'].map(id=>({id,url:'https://example.test/injuries',parseStatus:'ok',observedAt:obs,stale:false}));
 const games=[{id:'game',league:'NBA',home:'BOS',away:'NYK',startAt:'2026-11-12T01:00:00Z',status:'scheduled',comparison:'matched_websites',conflicts:[]}];
 const client={get:async j=>({id:j.id,url:j.url,status:'live',body:(j.id.startsWith('player-impact-')?impact:cross).join('\n'),observedAt:obs,lastModified:modified,stale:false})};
 return {client,games,rosters,injuries,receipts,now:()=>at};
}
test('current-season source joins require exact verified IDs and disclose missing roster',async()=>{
 const r=await collectPlayerImpact(fixture());assert.equal(r.status.available,1);const x=r.scenarios[0];assert.equal(x.status,'scenario');assert.equal(x.completeness,'partial');
 assert.equal(x.homeTeam.coverage.rosterMissing[0].name,'Missing BOS');assert.equal(x.homeTeam.outPlayers[0].name,'Player BOS 6');
 assert.equal(x.awayTeam.rotation.find(p=>p.name==='Player NYK 1').availabilityType,'questionable_assumption');
 assert.equal(x.homeTeam.rotation.find(p=>p.name==='Player BOS 6').allocatedMinutes,0);
 assert.equal('homeWinProbability' in x,false);
});
test('missing injuries source or old rating file stays pending',async()=>{
 const a=fixture();a.receipts.pop();assert.equal((await collectPlayerImpact(a)).scenarios[0].status,'pending');
 const b=fixture(),get=b.client.get;b.client.get=async j=>({...await get(j),lastModified:'2026-10-01T00:00:00Z'});assert.equal((await collectPlayerImpact(b)).scenarios[0].status,'pending');
});
test('started or conflicting schedules cannot turn into a new scenario',async()=>{
 const a=fixture();a.games[0].comparison='conflict';assert.equal((await collectPlayerImpact(a)).scenarios[0].status,'pending');
 const b=fixture();b.games[0].startAt='2026-11-11T10:00:00Z';assert.equal((await collectPlayerImpact(b)).scenarios.length,0);
});
