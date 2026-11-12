import test from 'node:test';
import assert from 'node:assert/strict';
import {rankNbaRoster} from '../public/nba-roster-ranking.js';
import {renderNbaRosterCard,nbaInjuryWarning} from '../public/nba-roster-card.js';

const now=Date.parse('2026-11-12T13:00:00Z'), observedAt='2026-11-12T12:30:00Z';
const player=(id,name,team='ATL',position='G')=>({id,name,team,position,espnId:id,jersey:'2',height:"6' 5\"",age:27,rosterSource:{observedAt,source:'https://example.com/roster'}});
const rating=(id,impact,grade='B',percentile=60)=>({id,team:'ATL',position:'G',status:'rated',impact,offense:impact,defense:0,percentile,grade,peerCount:20,games:8,minutes:100});
const snapshot={status:'ok',season:2027,observedAt,generatedAt:observedAt,rows:[rating('1',0.25,'B',60),rating('2',1.35,'S',95),rating('3',-0.5,'D',5)]};

test('same raw impact sorts descending, grades do not dictate order and unranked stay last',()=>{
 const ordered=rankNbaRoster([player('1','Aaron'),player('4','Unrated'),player('2','Dyson'),player('3','Other')],snapshot,2027,now);
 assert.deepEqual(ordered.map(p=>p.id),['2','1','3','4']);
 assert.deepEqual(ordered.map(p=>p.rosterRank),[1,2,3,null]);
 assert.equal(ordered[1].rosterRating.grade,'B');
});
test('season mismatch, stale roster, duplicate identity and broken source are never ranked',()=>{
 assert.equal(rankNbaRoster([player('1','Aaron')],snapshot,2026,now)[0].rosterRating,null);
 const stale=player('1','Aaron');stale.rosterSource.stale=true;
 assert.equal(rankNbaRoster([stale],snapshot,2027,now)[0].rosterRating,null);
 assert.ok(rankNbaRoster([player('1','Aaron'),player('1','Aaron')],snapshot,2027,now).every(p=>p.rosterRating===null));
 assert.equal(rankNbaRoster([player('1','Aaron')],{...snapshot,stale:true},2027,now)[0].rosterRating,null);
});
test('only same team and ESPN identity trigger visible injury warnings, including conflicts and stale',()=>{
 const p=player('1','Aaron'),observations=[{provider:'espn',playerId:'1',observedAt}];
 assert.equal(nbaInjuryWarning(p,[{team:'ATL',status:'CONFLICT',comparison:'conflict',observations}],now),'傷病來源衝突');
 assert.equal(nbaInjuryWarning(p,[{team:'ATL',status:'OUT',observations}],now),'傷病：缺陣');
 assert.equal(nbaInjuryWarning(p,[{team:'ATL',status:'OUT',observations}],now+9*3600000),'傷病資料過期');
 assert.equal(nbaInjuryWarning(p,[{team:'BOS',status:'OUT',observations}],now),null);
 assert.equal(nbaInjuryWarning(p,[],now),null);
});
test('unique same-team full-name-only injury record is pending, never a confirmed diagnosis',()=>{
 const p=player('1','Aaron Wiggins');
 const unknown={team:'ATL',player:'Aaron Wiggins',status:'OUT',observations:[{provider:'cbs',status:'OUT',observedAt}]};
 assert.equal(nbaInjuryWarning(p,[unknown],now,[p]),'傷病資料待核對');
 assert.equal(nbaInjuryWarning(p,[{...unknown,team:'BOS'}],now,[p]),null);
 assert.equal(nbaInjuryWarning(p,[{...unknown,player:'Aaron Williams'}],now,[p]),null);
 assert.equal(nbaInjuryWarning(p,[unknown],now,[p,{...p,id:'2'}]),null);
 assert.equal(nbaInjuryWarning(p,[unknown,unknown],now,[p]),null);
 assert.equal(nbaInjuryWarning(p,[{...unknown,observations:[{provider:'espn',playerId:'999',observedAt}]}],now,[p]),null);
 assert.equal(nbaInjuryWarning(p,[unknown],now,[]),null);
});
test('compact card keeps scores, core stats, individual source times, detail link, and exceptions',()=>{
 const p=rankNbaRoster([player('1','Aaron')],snapshot,2027,now)[0];
 const stats={gamesPlayed:8,avgPoints:14.9,avgRebounds:3.7,avgAssists:2.4,fieldGoalsMade:68,fieldGoalsAttempted:147,fieldGoalPct:46.25,threePointFieldGoalsMade:36,threePointFieldGoalsAttempted:86,threePointFieldGoalPct:41.9,freeThrowsMade:7,freeThrowsAttempted:11,freeThrowPct:63.6};
 const source={season:'2026-27',seasonYear:2027,observedAt,source:'https://example.com/stats',players:[{id:'1',team:'ATL',stats}]};
 const data={improvement:{current:source},leaderboards:{nba:{seasonYear:2027}},nbaPlayerRatings:{...snapshot,method:'https://example.com/method',source:'https://example.com/rating'},injuries:[{team:'ATL',status:'OUT',observations:[{provider:'espn',playerId:'1',observedAt}]}]};
 const h=renderNbaRosterCard(p,{data,now,playerName:()=> '亞倫',teamLogo:()=>'<span>徽</span>',shortTeam:x=>x,teamText:x=>x,positions:{G:'後衛'},formatTime:x=>x??'未提供',link:(x,l)=>l});
 assert.match(h,/亞倫/);assert.match(h,/Aaron/);assert.match(h,/14\.9/);assert.match(h,/46\.3%/);
 assert.match(h,/在場影響 \+0\.25/);assert.match(h,/#player\/nba\/1/);
 assert.match(h,/傷病：缺陣/);assert.match(h,/資料來源與時間/);assert.match(h,/2026-11-12T12:30:00Z/);
 assert.doesNotMatch(h,/名單：缺陣/);
});
