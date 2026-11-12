import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMlbTeams,parseMlbRoster,collectMlbRosters} from '../lib/mlb-rosters.mjs';
import {parseMlbProfile,rosterPlayer,fetchMlbProfile,mlbSeasonSummary,parseMlbGameLog,fetchMlbGameLog,renderMlbGameLog,mlbRosterRating,sortMlbRoster,mlbCompactStats,renderMlbRoster} from '../public/mlb-rosters.js';

const teamRows=Array.from({length:30},(_,i)=>({id:i+100,name:`Team ${i}`,abbreviation:`T${i}`,season:2026,sport:{id:1},active:true}));
const roster=(id)=>JSON.stringify({teamId:id,rosterType:'40Man',roster:Array.from({length:5},(_,i)=>({parentTeamId:id,person:{id:id*100+i,fullName:`Player ${id} ${i}`},jerseyNumber:String(i),position:{abbreviation:'P',name:'Pitcher'}}))});
test('validates team season, roster team, player IDs and duplicate entries',()=>{assert.equal(parseMlbTeams(JSON.stringify({teams:teamRows}),2026).length,30);assert.throws(()=>parseMlbTeams(JSON.stringify({teams:teamRows}),2025));const x=parseMlbRoster(roster(100),{teamId:100,team:'T0'});assert.equal(x.length,5);assert.equal(x[0].jersey,'0');assert.throws(()=>parseMlbRoster(roster(101),{teamId:100}));let b=JSON.parse(roster(100));b.roster[1].person.id=b.roster[0].person.id;assert.throws(()=>parseMlbRoster(JSON.stringify(b),{teamId:100}));});
test('collects all 30 clubs, and retains failed team only as stale',async()=>{const client={get:async j=>j.id==='mlb-roster-teams'?{body:JSON.stringify({teams:teamRows}),status:'live',observedAt:'2026-11-11T00:00:00Z',sha256:'x'}:j.id==='mlb-roster-100'?{body:null,status:'timeout',error:'timeout'}:{body:roster(Number(j.id.split('-').at(-1))),status:'live',observedAt:'2026-11-11T00:00:00Z',sha256:'x'}};let result=await collectMlbRosters(client,{season:2026,teams:[{teamId:100,team:'T0',players:[{id:'1'}],observedAt:'2026-11-01T00:00:00Z'}]},2026);assert.equal(result.availableTeams,29);assert.equal(result.teams.find(x=>x.teamId===100).stale,true);assert.equal(result.teams.find(x=>x.teamId===100).observedAt,'2026-11-01T00:00:00Z');assert.equal(result.teams.find(x=>x.teamId===101).players.length,5);});
test('profile rejects wrong identity, preserves absent values and season boundaries',()=>{const body={people:[{id:42,fullName:'Test Player',stats:[{type:{displayName:'season'},group:{displayName:'hitting'},splits:[{season:'2025',stat:{avg:'.200'}},{season:'2026',team:{name:'New York Mets'},stat:{avg:'.300',homeRuns:0}}]}]}]};const p=parseMlbProfile(body,'42',2026);assert.equal(p.stats.length,1);assert.equal(p.stats[0].stat.homeRuns,0);assert.equal(p.stats[0].team,'New York Mets');assert.throws(()=>parseMlbProfile(body,'99',2026));assert.equal(rosterPlayer({teams:[{players:[{id:'42'}]},{players:[{id:'42'}]}]},'42'),null);});
test('only fall back to prior season after a successful empty current season',async()=>{const calls=[],fetcher=async url=>{calls.push(url);const season=url.includes('season=2027')?'2027':'2026';return {ok:true,json:async()=>({people:[{id:42,fullName:'Player',stats:season==='2027'?[]:[{type:{displayName:'season'},group:{displayName:'hitting'},splits:[{season:'2026',stat:{avg:'.300'}}]}]}]})};};const r=await fetchMlbProfile('42',2027,fetcher);assert.equal(r.fallback,true);assert.equal(r.season,2026);assert.equal(calls.length,2);await assert.rejects(()=>fetchMlbProfile('42',2027,async()=>({ok:false})));});

test('roster season summaries show both hitting and pitching, preserving zero and missing values',()=>{
 const observedAt=new Date().toISOString(),source={season:2026,status:'ok',observedAt,source:'https://statsapi.mlb.com/api/v1/stats'};
 const db={groups:{hitting:source,pitching:source},seasonStats:{hitting:{'42':{stat:{gamesPlayed:10,avg:'.300',homeRuns:0,rbi:5,ops:'.800'}}},pitching:{'42':{stat:{gamesPlayed:2,wins:1,losses:0,era:'2.00'}}}}};
 const html=mlbSeasonSummary(db,'42',()=> '11/12 12:00');assert.match(html,/打擊/);assert.match(html,/投球/);assert.match(html,/<dd>0<\/dd>/);assert.match(html,/<dd>—<\/dd>/);assert.match(html,/2026/);
 assert.match(mlbSeasonSummary(db,'99',()=>''),/暫無資料/);db.groups.hitting={...source,status:'stale',stale:true};assert.match(mlbSeasonSummary(db,'42',()=>''),/舊資料/);
});
test('MLB game log validates season, displays both roles and all supplied records',async()=>{
 const body={stats:[{type:{displayName:'gameLog'},group:{displayName:'hitting'},splits:[{season:'2026',date:'2026-04-01',team:{name:'Dodgers'},opponent:{name:'Mets'},game:{gamePk:1},stat:{atBats:4,hits:0}},{season:'2026',date:'2026-04-03',stat:{homeRuns:1}}]},{type:{displayName:'gameLog'},group:{displayName:'pitching'},splits:[{season:'2026',date:'2026-04-02',stat:{inningsPitched:'5.1',earnedRuns:0}}]}]};
 const rows=parseMlbGameLog(body,2026);assert.equal(rows.length,3);assert.equal(rows[0].date,'2026-04-03');assert.equal(rows[1].stat.inningsPitched,'5.1');assert.throws(()=>parseMlbGameLog(body,2025));assert.throws(()=>parseMlbGameLog({},2026));
 const fetched=await fetchMlbGameLog('42',2026,async url=>({ok:true,json:async()=>body}));const html=renderMlbGameLog(fetched,()=> '11/12');assert.match(html,/2026/);assert.match(html,/打擊/);assert.match(html,/投球/);assert.match(html,/5.1/);assert.match(html,/<td>0<\/td>/);assert.match(html,/<td>—<\/td>/);assert.match(fetched.url,/gameType=R/);await assert.rejects(()=>fetchMlbGameLog('42',2026,async()=>({ok:false})));
});

test('roster uses primary role, preserves both two-way ratings, and excludes stale or wrong-season data from sorting',()=>{
 const now=Date.parse('2026-11-12T12:00:00Z'),fresh={season:2026,status:'ok',observedAt:'2026-11-12T11:59:00Z'};
 const hitter=(id,percentile)=>({id,role:'hitting',grade:'A',percentile,metric:.8,obp:.35,slg:.45,sample:100,rank:2,cohortSize:30});
 const pitcher=(id,percentile)=>({id,role:'starter',grade:'A',percentile,metric:2.8,outs:90,earnedRuns:10,rank:2,cohortSize:30});
 const performance={groups:{hitting:{...fresh},pitching:{...fresh}},ratings:{'1':{hitting:hitter('1',60)},'2':{pitching:pitcher('2',80)},'3':{hitting:hitter('3',50),pitching:pitcher('3',95)},'4':{pitching:pitcher('4',90)}}};
 const players=[{id:'1',name:'Batter',position:'RF'},{id:'2',name:'Pitcher',position:'P'},{id:'3',name:'TwoWay',position:'TWP'},{id:'4',name:'TwoWayPitchOnly',position:'TWP'},{id:'5',name:'Unknown',position:'P'}].map(p=>({...p,roster:{name:'Team',observedAt:fresh.observedAt}}));
 assert.deepEqual(sortMlbRoster(players,performance,2026,now).map(x=>x.id),['4','2','1','3','5']);
 assert.equal(mlbRosterRating(performance,players[2],2026,now).group,'hitting');assert.equal(mlbRosterRating(performance,players[3],2026,now).group,'pitching');
 assert.equal(mlbRosterRating(performance,players[0],2025,now),null);
 assert.equal(mlbRosterRating(performance,{...players[0],roster:{...players[0].roster,stale:true}},2026,now),null);
 assert.equal(mlbRosterRating(performance,{...players[0],roster:{...players[0].roster,observedAt:'2026-11-10T00:00:00Z'}},2026,now),null);
 const duplicates=[...players,{...players[0],roster:{...players[0].roster,name:'Other Team'}}];const duplicateRows=sortMlbRoster(players,performance,2026,now,duplicates);assert.equal(duplicateRows.find(p=>p.id==='1').rosterRating,null);assert.equal(duplicateRows.find(p=>p.id==='1').identityDuplicate,true);
 performance.groups.pitching={...fresh,status:'stale',stale:false};assert.equal(mlbRosterRating(performance,players[1],2026,now),null);assert.equal(mlbRosterRating(performance,players[3],2026,now),null);
 performance.groups.hitting={...fresh,observedAt:'2026-11-10T11:59:00Z'};assert.equal(mlbRosterRating(performance,players[0],2026,now),null);
});
test('compact cards distinguish two-way stats, missing values, actual zero and stale data',()=>{
 const fresh={season:2026,status:'ok',observedAt:new Date().toISOString()};const data={groups:{hitting:{...fresh},pitching:{...fresh}},seasonStats:{hitting:{'42':{stat:{avg:'.300',homeRuns:0,rbi:4}}},pitching:{'42':{stat:{era:'2.00',inningsPitched:'10.1',strikeOuts:12,whip:'0.90'}}}}};
 const html=mlbCompactStats(data,'42');assert.match(html,/打擊率 AVG/);assert.match(html,/防禦率 ERA/);assert.match(html,/<strong>0<\/strong>/);assert.match(html,/<strong>—<\/strong>/);assert.match(html,/10.1/);
 assert.match(mlbCompactStats(data,'99'),/暫無資料/);data.groups.pitching={...fresh,status:'stale',stale:false};assert.match(mlbCompactStats(data,'42'),/舊資料/);
});
test('roster cards sort by validated rating and keep search functional',()=>{
 const now=new Date().toISOString(),source={season:2026,status:'ok',observedAt:now,source:'https://statsapi.mlb.com/api/v1/stats'};
 const rating=(id,percentile)=>({id,role:'hitting',grade:'A',percentile,metric:.8,obp:.35,slg:.45,sample:100,rank:2,cohortSize:30});
 const performance={groups:{hitting:source},ratings:{'1':{hitting:rating('1',40)},'2':{hitting:rating('2',90)}},seasonStats:{hitting:{'1':{stat:{avg:'.200',homeRuns:0}},'2':{stat:{avg:'.300',homeRuns:2}}}}};
 const team={teamId:10,name:'Test Team',observedAt:now,source:'https://statsapi.mlb.com/api/v1/teams/10',players:[{id:'1',name:'Alpha',teamId:10,position:'RF',jersey:'1'},{id:'2',name:'Beta',teamId:10,position:'RF',jersey:'2'}]};
 const buttons={'#mlbr-prev':{},'#mlbr-next':{}},results={innerHTML:'',querySelector:key=>buttons[key]},search={},teamSelect={},posSelect={};const nodes={'#mlbr-results':results,'#mlbr-search':search,'#mlbr-team':teamSelect,'#mlbr-position':posSelect};const root={innerHTML:'',querySelector:key=>nodes[key]};
 renderMlbRoster({season:2026,availableTeams:1,players:2,teams:[team]},{root,teamName:x=>x,playerName:x=>x,formatTime:()=>now,performance});
 assert.ok(results.innerHTML.indexOf('Beta')<results.innerHTML.indexOf('Alpha'));assert.match(results.innerHTML,/打擊率 AVG/);assert.match(results.innerHTML,/查看完整球員資料/);
 search.oninput({target:{value:'Alpha'}});assert.match(results.innerHTML,/Alpha/);assert.doesNotMatch(results.innerHTML,/Beta/);
});
