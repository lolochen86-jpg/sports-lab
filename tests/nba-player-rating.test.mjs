import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNbaPlayerRatings,collectNbaPlayerRatings,rankPositionGroups} from '../lib/nba-player-ratings.mjs';
import {selectNbaRating,nbaRatingBadge,nbaRatingPanel} from '../public/nba-player-rating.js';

const asOf='2026-11-11T12:00:00Z',prev='2026-11-11T11:00:00Z',now=Date.parse(asOf);
function fixture(){
 const ratings=[],crosswalk=[],players=[];
 for(let i=1;i<=12;i++){
  const name=`Player ${i}`,nba=String(10000+i),espn=String(20000+i);
  players.push({id:espn,name,position:'G'});
  crosswalk.push({season:'2027',espn_athlete_id:espn,espn_full_name:name,nba_player_id:nba,nba_player_name:name,team_abbreviation:'ATL',match_method:'exact_name',match_confidence:'1.0'});
  ratings.push({season:'2027',season_type:'Regular Season',player_id:nba,player_name:name,team_abbreviation:'ATL',gp:'7',min:'100',adj_rapm:String(i),o_adj_rapm:String(i/2),d_adj_rapm:String(i/2)});
 }
 return {ratings,crosswalk,season:2027,rosters:{teams:[{team:'ATL',players,observedAt:prev,stale:false}]},asOf};
}
test('position percentile gives equal values equal grades and separates positions',()=>{
 const rows=Array.from({length:12},(_,i)=>({id:String(i),position:'G',games:5,minutes:60,impact:i<2?0:i}));
 const ranked=rankPositionGroups(rows);assert.equal(ranked.length,12);assert.equal(ranked[0].percentile,ranked[1].percentile);assert.equal(ranked.at(-1).grade,'S');assert.equal(ranked[0].grade,'D');
 assert.equal(rankPositionGroups([{id:'a',position:'C',games:5,minutes:60,impact:1}])[0].status,'pending');
});
test('requires unique crosswalk, same roster team and complete source figures',()=>{
 const f=fixture();f.ratings[0].gp='4';f.ratings[1].min='59';f.ratings[2].adj_rapm='';f.crosswalk[3].team_abbreviation='BOS';f.rosters.teams[0].players.push({id:'999',name:'Unknown',position:'F'});
 const r=buildNbaPlayerRatings(f);for(const id of ['20001','20002','20003','20004','999'])assert.equal(r.rows.find(x=>x.id===id).status,'pending');assert.equal(r.rows.filter(x=>x.status==='rated').length,0);
});
test('valid source values are rated without adding fake injury or 2K data',()=>{
 const f=fixture(),result=buildNbaPlayerRatings(f);assert.equal(result.rows.filter(x=>x.status==='rated').length,12);assert.equal(result.groupSizes.G,12);assert.ok(result.rows.every(x=>!('injury' in x)&&!('nba2k' in x)));
});
test('bad or stale upstream remains unavailable or preserves stale prior',async()=>{
 const client={get:async()=>({body:'',status:'failed'})};const x=await collectNbaPlayerRatings({client,rosters:fixture().rosters,now:()=>now});assert.equal(x.status,'unavailable');
 const prevSnapshot={rows:[{id:'1'}],season:2027};const y=await collectNbaPlayerRatings({client,rosters:fixture().rosters,previous:prevSnapshot,now:()=>now});assert.equal(y.stale,true);assert.equal(y.rows.length,1);
});
test('badge and panel disclose thresholds, formula and do not report stale ratings',()=>{
 const x=buildNbaPlayerRatings(fixture()).rows[10],snapshot={rows:[x],status:'partial',observedAt:prev,generatedAt:asOf,season:2027};
 assert.ok(selectNbaRating(snapshot,x.id,'ATL','G',now).rating);const badge=nbaRatingBadge(snapshot,x.id,'ATL','G',now);assert.match(badge,/表現等級/);const html=nbaRatingPanel(snapshot,x.id,'ATL','G',now);assert.match(html,/進攻影響 \+ 防守影響/);assert.match(html,/非 NBA、ESPN 或 2K 官方評分/);assert.match(html,/至少 5 場及 60 分鐘/);
 assert.equal(selectNbaRating(snapshot,x.id,'BOS','G',now).rating,undefined);assert.equal(selectNbaRating({...snapshot,stale:true},x.id,'ATL','G',now).rating,undefined);assert.match(nbaRatingBadge(snapshot,x.id,'ATL','G',now+2*86400000),/待評/);
});
