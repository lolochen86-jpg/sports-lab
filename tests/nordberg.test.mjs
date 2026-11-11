import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectNordberg,parseTeamResults,predictNordberg,retainNordberg} from '../lib/nordberg.mjs';
const artifact=JSON.parse(readFileSync(new URL('../data/nordberg-model-v1.json',import.meta.url),'utf8'));
const codes=['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
const header='season,team,game_date,opponent,home,points,opponent_points,point_diff,field_goals_made,field_goal_attempts,three_point_makes,free_throw_attempts,offensive_rebounds,defensive_rebounds,assists,turnovers';
function rows(season,dates){const out=[header];for(const date of dates)for(let i=0;i<30;i+=2){out.push(`${season},${codes[i]},${date},${codes[i+1]},True,110,100,10,40,80,10,20,10,30,20,10`);out.push(`${season},${codes[i+1]},${date},${codes[i]},False,100,110,-10,37,80,8,18,8,29,18,11`)}return out.join('\n');}
const dates=(start,n)=>Array.from({length:n},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));
const before=rows('2025-26',dates('2025-10-01',82)),current=rows('2026-27',dates('2026-11-01',9));
const at=Date.parse('2026-11-11T04:00:00Z'),observed=new Date(at-1000).toISOString(),start='2026-11-12T00:00:00Z';
const game={id:'nba-test',league:'NBA',home:'ATL',away:'BOS',startAt:start,status:'scheduled',comparison:'matched_websites',conflicts:[],observations:[{provider:'espn',stale:false,status:'scheduled',home:'ATL',away:'BOS',startAt:start,seasonType:2,seasonYear:2027,neutralSite:false,observedAt:observed}]};
function client(){return {get:async job=>({body:job.season==='2025-26'?before:current,status:'live',observedAt:observed,sha256:'a'.repeat(64),stale:false})};}
test('published formula independently refitted reproduces sklearn output exactly',()=>{
 const h={point_diff:-4.5,efg:.5382965184254747,ast_to:1.9121173125120496,ftr:.27903111127807245,offensive_rebounds:8.7,defensive_rebounds:31.8};
 const a={point_diff:-7,efg:.5111512982351086,ast_to:1.668014874141876,ftr:.28183518849993716,offensive_rebounds:9.8,defensive_rebounds:32};
 const p=predictNordberg(artifact,h,a,'IND','WAS');assert.ok(Math.abs(p.homeWinProbability-.6155161607883418)<1e-12);assert.equal(p.trace.terms.length,12);
});
test('actual features exclude today, expose substitution and retain only genuine pregame',async()=>{
 const r=await collectNordberg(client(),[game],artifact,()=>at);assert.equal(r.status.available,1);const p=r.forecasts[0];
 assert.equal(p.status,'experimental');assert.equal(p.historyThrough,'2026-11-09');assert.equal(p.trace.terms.length,12);
 assert.ok(p.homeSampleDates.every(d=>d<'2026-11-10'));assert.equal(p.awayWinProbability,1-p.homeWinProbability);
 assert.equal(retainNordberg(null,{games:[game],nordbergForecasts:[p]},at).length,1);
 assert.equal(retainNordberg(null,{games:[game],nordbergForecasts:[{...p,generatedAt:p.startAt}]},Date.parse(start)+1).length,0);
 assert.equal(retainNordberg(null,{games:[game],nordbergForecasts:[p]},Date.parse(start)+1).length,0);
 assert.equal(retainNordberg({games:[game],nordbergForecasts:[p]},null,Date.parse(start)+1).length,1);
});
test('rejects stale data, mismatched source and unverified neutral or started games',async()=>{
 const stale=client(),get=stale.get;stale.get=async j=>({...await get(j),stale:true});
 assert.equal((await collectNordberg(stale,[game],artifact,()=>at)).forecasts[0].status,'pending');
 const neutral=structuredClone(game);neutral.observations[0].neutralSite=true;
 assert.equal((await collectNordberg(client(),[neutral],artifact,()=>at)).forecasts[0].status,'pending');
 const started=structuredClone(game);started.startAt='2026-11-10T00:00:00Z';
 assert.equal((await collectNordberg(client(),[started],artifact,()=>at)).forecasts.length,0);
});
test('paired scores must match and invalid stats do not become zero',()=>{
 assert.throws(()=>parseTeamResults(current.replace('110,100,10','110,100,11'),'2026-27'));
 assert.throws(()=>parseTeamResults(current.replace('40,80,10','40,,10'),'2026-27'));
});
