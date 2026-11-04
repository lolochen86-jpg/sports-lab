import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNbaLeaders,parseMlbLeaders,parseMlbStandings,collectLeaderboards} from '../lib/leaderboards.mjs';
test('NBA statistics map category names to player values and reject truncated datasets',()=>{
 const d={requestedSeason:{year:2027,displayName:'2026-27',type:{id:'2'}},pagination:{count:1},categories:[{name:'general',names:['gamesPlayed']},{name:'offensive',names:['avgPoints']}],athletes:[{athlete:{id:'12',displayName:'Player',teamShortName:'BOS'},categories:[{name:'general',values:[3]},{name:'offensive',values:[21.4]}]}]};
 assert.equal(parseNbaLeaders(JSON.stringify(d)).players[0].stats.avgPoints,21.4);d.pagination.count=2;assert.throws(()=>parseNbaLeaders(JSON.stringify(d)));
});
test('MLB leaders require matching season and regular season',()=>{const data={leagueLeaders:[{leaderCategory:'homeRuns',season:'2026',gameType:{id:'R'},leaders:[{rank:1,value:'45',person:{id:1,fullName:'Player'}}]},{leaderCategory:'saves',season:'2025',gameType:{id:'R'},leaders:[]}]};assert.equal(parseMlbLeaders(JSON.stringify(data),2026).length,1);assert.throws(()=>parseMlbStandings('{}',2026));});
test('failure keeps old snapshot flagged stale rather than inventing fresh ranks',async()=>{const old={nba:{season:'old',players:[1]},hitting:{season:2025}};const client={get:async()=>({body:null,error:'offline'})};const r=await collectLeaderboards(client,old,2026);assert.equal(r.nba.stale,true);assert.equal(r.nba.season,'old');assert.equal(r.hitting.stale,true);assert.equal(r.pitching.stale,true);});
