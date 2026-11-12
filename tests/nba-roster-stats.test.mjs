import test from 'node:test';
import assert from 'node:assert/strict';
import {nbaRosterSeason,nbaRosterStatValues} from '../public/nba-roster-stats.js';

test('名單優先對應同季全球員數據，查無才使用合格榜',()=>{
 const data={leaderboards:{nba:{seasonYear:2027,players:[{id:'1',stats:{gamesPlayed:9}}]}},improvement:{current:{seasonYear:2027,players:[{id:'1',stats:{gamesPlayed:10}},{id:'2',stats:{gamesPlayed:2}}]}}};
 assert.equal(nbaRosterSeason(data,'1').player.stats.gamesPlayed,10);
 assert.equal(nbaRosterSeason(data,'2').player.stats.gamesPlayed,2);
 assert.equal(nbaRosterSeason(data,'3'),null);
 data.improvement.current.seasonYear=2026;
 assert.equal(nbaRosterSeason(data,'1').player.stats.gamesPlayed,9);
 assert.equal(nbaRosterSeason(data,'2'),null);
});
test('兩分與三分命中率計算正確，缺值和零出手不顯示假數據',()=>{
 const values=Object.fromEntries(nbaRosterStatValues({gamesPlayed:5,avgPoints:3.6,fieldGoalsMade:7,fieldGoalsAttempted:15,fieldGoalPct:46.667,threePointFieldGoalsMade:2,threePointFieldGoalsAttempted:8,threePointFieldGoalPct:25,freeThrowsMade:0,freeThrowsAttempted:0,freeThrowPct:0}));
 assert.equal(values['兩分 / 2P%'],'71.4%');assert.equal(values['三分 / 3P%'],'25.0%');assert.equal(values['罰球 / FT%'],'—');assert.equal(values['籃板 / REB'],'—');
});
