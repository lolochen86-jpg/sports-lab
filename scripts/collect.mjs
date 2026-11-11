import {collectElo,retainElo} from '../lib/elo-forecast.mjs';
import {collectNordberg,retainNordberg} from '../lib/nordberg.mjs';
import {collectPlayerImpact} from '../lib/player-impact-forecast.mjs';
import {retainPlayerImpactScenarios} from '../lib/player-impact-retention.mjs';
import {freezeLegacyResearchPredictions} from '../lib/legacy-research-freeze.mjs';
import {collectDropForecasts,retainExternalPredictions} from '../lib/drop-coverage.mjs';
import {mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {SourceClient,pool,atomic} from '../lib/fetch.mjs';
import {makeJobs,parsers,PROVIDERS,taipeiDate,shiftDate,team} from '../lib/providers.mjs';
import {reconcileGames,reconcileInjuries} from '../lib/reconcile.mjs';
import {collectLeaderboards} from '../lib/leaderboards.mjs';
import {collectPlayoffRace} from '../lib/playoff-race.mjs';
import {collectMlbPlayerNumbers} from '../lib/mlb-numbers.mjs';
import {collectImprovement} from '../lib/improvement.mjs';
import {collectPopularity} from '../lib/player-popularity.mjs';
import {collectRecentForm} from '../lib/recent-player-form.mjs';
import {collectTeamStats} from '../lib/team-stats.mjs';
import {collectRosters} from '../lib/rosters.mjs';
import {collectMlbRosters} from '../lib/mlb-rosters.mjs';
import {collectMlbPerformance} from '../lib/mlb-performance.mjs';
import {collectNbaPlayerRatings} from '../lib/nba-player-ratings.mjs';
import {gatherHistory} from '../lib/prediction.mjs';
import {preserveUnavailable} from '../lib/preserve.mjs';
import {preserveGameHistory} from '../lib/game-history.mjs';
import {retainPregamePredictions} from '../lib/prediction-retention.mjs';
import {buildOpponentAnalysis} from '../lib/opponent-analysis.mjs';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function collect({root=ROOT,date=taipeiDate(new Date()),budgetMs=90000,timeoutMs=10000,fetchImpl=fetch}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw new Error('日期無效');
 const data=path.join(root,'data');await mkdir(data,{recursive:true});const lock=path.join(data,'collect.lock');let acquired=false;
 try{await writeFile(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx'});acquired=true;}catch(e){if(e.code!=='EEXIST')throw e;let active=false;try{const existing=JSON.parse(await readFile(lock));try{process.kill(existing.pid,0);active=true;}catch{}if(Date.now()-Date.parse(existing.startedAt)>600000)active=false;}catch{}if(active)throw new Error('另一個蒐集程序正在執行，拒絕重疊');await rm(lock,{force:true});await writeFile(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx'});acquired=true;}
 const started=Date.now(),runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`,dates=[date,shiftDate(date,1)],jobs=makeJobs(date);const progress={runId,startedAt:new Date(started).toISOString(),targetDates:dates,stage:'collecting',total:jobs.length,finished:0,failures:0,jobs:[]};await atomic(path.join(data,'progress.json'),progress);
 try{
  const client=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:started+budgetMs});const observations=[],injuries=[],archives=[],reports=[],receipts=[];let progressWrites=Promise.resolve();const saveProgress=()=>{const snapshot=structuredClone(progress);progressWrites=progressWrites.then(()=>atomic(path.join(data,'progress.json'),snapshot));return progressWrites;};
  await pool(jobs,async job=>{const response=await client.get(job);const receipt={...response,body:undefined,kind:job.kind,league:job.league??null,parser:job.parse,recordCount:0};
   if(response.body){try{const parsed=parsers[job.parse](response.body,job);const trace={provider:job.provider,observedAt:response.observedAt,sha256:response.sha256,stale:response.stale===true||Date.now()-Date.parse(response.observedAt)>(job.ttlMs??180000),sourceUrl:job.url};receipt.recordCount=Array.isArray(parsed)?parsed.length:parsed.games?.length??1;
    if(job.kind==='games')observations.push(...parsed.map(r=>({...r,...trace})));if(job.kind==='injuries')injuries.push(...parsed.map(r=>({...r,...trace})));if(job.kind==='reports')reports.push(...parsed.map(r=>({...r,...trace})));if(job.kind==='archive')archives.push({...trace,data:parsed});receipt.parseStatus='ok';
   }catch(e){receipt.parseStatus='failed';receipt.parseError=e.message;}}
   else receipt.parseStatus='not_available';receipts.push(receipt);progress.finished++;if(receipt.parseStatus!=='ok'||receipt.stale)progress.failures++;progress.jobs.push({id:job.id,status:receipt.status,parseStatus:receipt.parseStatus,recordCount:receipt.recordCount,elapsedMs:receipt.elapsedMs});const finished=progress.finished;await saveProgress();console.log(`${finished}/${jobs.length} ${job.id}: ${receipt.status}/${receipt.parseStatus} ${receipt.recordCount}`);
  },6);
  progress.stage='reconciling';await atomic(path.join(data,'progress.json'),progress);
  let previous;try{previous=JSON.parse(await readFile(path.join(data,'dashboard.json'),'utf8'));}catch{}
  const {games,unresolved}=reconcileGames(observations,dates);
  // Reserve a short bounded request opportunity even if other collection jobs exhausted their budget.
  const dropClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+Math.min(12000,timeoutMs*2+300)});
  const externalPredictions=await collectDropForecasts(dropClient,games);
  const dropChecked=Date.now();
  const upcomingIds=new Set(games.filter(g=>g.league==='NBA'&&g.status==='scheduled'&&Date.parse(g.startAt)>dropChecked).map(g=>g.id));
  const externalUpcoming=externalPredictions.filter(p=>upcomingIds.has(p.gameId));
  const externalAvailable=externalUpcoming.filter(p=>p.status==='available');
  const dropSourceStatus={status:externalUpcoming.length?(externalAvailable.length===externalUpcoming.length?'ok':externalAvailable.length?'partial':'no_valid_predictions'):'not_requested',available:externalAvailable.length,total:externalUpcoming.length,checkedAt:new Date(dropChecked).toISOString(),sourceUpdatedAt:externalAvailable[0]?.sourceUpdatedAt??null,reasons:[...new Set(externalUpcoming.filter(p=>p.status==='pending').map(p=>p.reason).filter(Boolean))]};
  const eloClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+12000});
  let eloSeed;try{eloSeed=JSON.parse(await readFile(path.join(data,'elo-seed-2023.json'),'utf8'));}catch{}
  const eloResult=await collectElo(eloClient,games,eloSeed);
  let nordbergArtifact;try{nordbergArtifact=JSON.parse(await readFile(path.join(data,'nordberg-model-v1.json'),'utf8'));}catch{}
  const nordbergClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+12000});
  const nordbergResult=await collectNordberg(nordbergClient,games,nordbergArtifact);
  const improvement=await collectImprovement(client,previous?.improvement);
  const injuryRows=reconcileInjuries(injuries);const imported=JSON.parse(await readFile(path.join(data,'legacy-archive.json'),'utf8'));if(!Array.isArray(imported.forecasts)||!Array.isArray(imported.rookieSnapshots)||!Array.isArray(imported.backtests))throw new Error('歷史存檔格式錯誤');
  const needsHistory=games.some(g=>g.league==='NBA'&&g.status==='scheduled'&&Date.parse(g.startAt)>Date.now()&&g.sourceCount>=2&&!g.conflicts.length);
  const history=needsHistory?await gatherHistory(client,date):{complete:false,events:[],receipts:[],failures:[]};
  // The self-defined model is retired; preserve its old results, do not generate new ones.
  const researchPredictions=[];
  const injuryScenarios=[];
  const leaderboards=await collectLeaderboards(client,previous?.leaderboards,Number(date.slice(0,4)));
  const opponentAnalysis=buildOpponentAnalysis(history,leaderboards?.nba?.seasonYear,date,new Date().toISOString(),previous?.opponentAnalysis);
  const nbaConferenceStandings=await collectPlayoffRace(client,leaderboards?.nba?.seasonYear,previous?.nbaConferenceStandings);
  const mlbPlayerNumbers=await collectMlbPlayerNumbers(client,leaderboards,previous?.mlbPlayerNumbers);
  const teamDashboard=await collectTeamStats(client,previous?.teamDashboard);
  const rosterDatabase=await collectRosters(client,previous?.rosterDatabase);
  // MLB 40-man rosters have a separate request budget so a slow upstream
  // source in another league cannot silently prevent the refresh.
  const mlbRosterClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+20000});
  const mlbRosterDatabase=await collectMlbRosters(mlbRosterClient,previous?.mlbRosterDatabase,Number(date.slice(0,4)));
  const mlbPerformanceClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+15000});
  const mlbPerformance=await collectMlbPerformance(mlbPerformanceClient,previous?.mlbPerformance,Number(date.slice(0,4)));
  // Use a bounded, separate source budget. These are labelled lineup scenarios, not calibrated win forecasts.
  const playerImpactClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+15000});
  const playerImpact=await collectPlayerImpact({client:playerImpactClient,games,rosters:rosterDatabase,injuries:injuryRows,receipts});
  const nbaRatingClient=new SourceClient({directory:path.join(data,'cache'),fetchImpl,timeoutMs,deadline:Date.now()+15000});
  const nbaPlayerRatings=await collectNbaPlayerRatings({client:nbaRatingClient,rosters:rosterDatabase,previous:previous?.nbaPlayerRatings});
  const recentForm=await collectRecentForm(client,leaderboards?.nba,rosterDatabase,history,new Date().toISOString());
  const popularity=await collectPopularity(client,leaderboards?.nba,rosterDatabase,new Date().toISOString());
  const analysisReadiness=archives.filter(a=>a.provider==='statshub').flatMap(a=>(a.data.games??[]).filter(r=>r.game&&r.prediction).map(r=>({league:a.data.league,away:team(r.game.away.tricode??r.game.away.abbreviation??r.game.away.name_en,a.data.league),home:team(r.game.home.tricode??r.game.home.abbreviation??r.game.home.name_en,a.data.league),startAt:r.game.start_time_utc,status:r.prediction.status,reasons:r.prediction.reasons??[],sourceUpdatedAt:a.data.sourceUpdatedAt})));
  for(const g of games){g.forecasts=imported.forecasts.filter(p=>p.league===g.league&&p.away===g.away&&p.home===g.home&&Math.abs(Date.parse(p.startAt)-Date.parse(g.startAt))<300000);g.modelState=analysisReadiness.filter(p=>p.league===g.league&&p.away===g.away&&p.home===g.home&&Math.abs(Date.parse(p.startAt)-Date.parse(g.startAt))<300000);}
  const sourceHealth=Object.entries(PROVIDERS).map(([id,meta])=>{const rows=receipts.filter(r=>r.provider===id);const usable=rows.filter(r=>r.parseStatus==='ok'&&!r.stale);return {id,...meta,aggregate:['statshub','hoopslab'].includes(id),status:!rows.length?'not_requested':usable.length===rows.length?'ok':usable.length?'partial':'unavailable',usableEndpoints:usable.length,totalEndpoints:rows.length,records:rows.reduce((n,r)=>n+r.recordCount,0),observedAt:rows.map(r=>r.observedAt).filter(Boolean).sort().at(-1)??null,independentUpstreamConfirmed:id==='nba'||id==='mlb',endpoints:rows};});
  const activeProviders=sourceHealth.filter(s=>!s.aggregate&&s.usableEndpoints>0);const dashboard={eloForecasts:eloResult.forecasts,eloSourceStatus:eloResult.status,externalPredictions,dropSourceStatus,legacyResearchPredictions:freezeLegacyResearchPredictions(previous),schemaVersion:1,title:'Sports Lab',runId,generatedAt:new Date().toISOString(),targetDates:dates,timeZone:'Asia/Taipei',collection:{status:progress.failures?'partial_success':'success',durationMs:Date.now()-started,budgetMs,total:jobs.length,usable:receipts.filter(r=>r.parseStatus==='ok'&&!r.stale).length,failed:progress.failures,activeProviderCount:activeProviders.length,warning:'來源網站數不等於獨立上游數；不使用網站票數當預測信心。'},teamDashboard,rosterDatabase,leaderboards,nbaConferenceStandings,mlbPlayerNumbers,improvement,recentForm,popularity,injuryScenarios,predictionHistory:{complete:history.complete,failures:history.failures,days:history.receipts.length},researchPredictions,schedule:{taipeiHours:[7,14,21],mechanism:'GitHub Actions',mayBeDelayed:true},games,injuries:injuryRows,unresolvedSchedule:unresolved,officialReports:reports,sources:sourceHealth,...imported,limitations:['本網站自訂比分模型已停止產生新預測；原始資料保留供歷史查閱。','外部預測依原來源發布資訊顯示，實際陣容及模型輸入細節以來源說明為準。','傷病取同隊完整姓名配對，無記錄不代表健康；預期先發不等於確認先發。','MLB 非賽季或無賽事時如實顯示空賽程；不補造比賽。','NBA 官方CDN若403會保留阻擋原因；官方PDF目前提供連結索引，未解析成球員共識。']};
  dashboard.opponentAnalysis=opponentAnalysis;
  dashboard.mlbRosterDatabase=mlbRosterDatabase;
  dashboard.mlbPerformance=mlbPerformance;
  dashboard.playerImpactScenarios=playerImpact.scenarios;
  dashboard.playerImpactSourceStatus=playerImpact.status;
  dashboard.nbaPlayerRatings=nbaPlayerRatings;
  dashboard.nordbergForecasts=nordbergResult.forecasts;
  dashboard.nordbergSourceStatus=nordbergResult.status;
  // Never replace a useful previous snapshot with an empty failed refresh.
  preserveUnavailable(dashboard,previous,receipts);
  preserveGameHistory(dashboard,previous);
  let recovery;try{recovery=JSON.parse(await readFile(path.join(data,'pregame-recovery.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const retentionInputs={...previous,retainedPredictions:[...(previous?.retainedPredictions??[]),...(recovery?.retainedPredictions??[])]};
  dashboard.retainedPredictions=retainPregamePredictions(dashboard,retentionInputs);
  dashboard.retainedExternalPredictions=retainExternalPredictions(dashboard,previous);
  dashboard.retainedEloForecasts=retainElo(previous,dashboard);
  dashboard.retainedPlayerImpactScenarios=retainPlayerImpactScenarios(dashboard,previous);
  dashboard.retainedNordbergForecasts=retainNordberg(previous,dashboard);
  await atomic(path.join(data,'dashboard.json'),dashboard);await atomic(path.join(data,'runs',runId+'.json'),dashboard);progress.stage='complete';progress.completedAt=new Date().toISOString();progress.status=dashboard.collection.status;await atomic(path.join(data,'progress.json'),progress);
  const runs=(await readdir(path.join(data,'runs'))).filter(n=>n.endsWith('.json')).sort();for(const old of runs.slice(0,-20))await rm(path.join(data,'runs',old));
  console.log(JSON.stringify({runId,status:dashboard.collection.status,providers:activeProviders.length,games:games.length,injuries:injuryRows.length,unresolved:unresolved.length,durationMs:Date.now()-started}));return dashboard;
 }catch(e){progress.stage='failed';progress.error=e.message;await atomic(path.join(data,'progress.json'),progress);throw e;}finally{if(acquired)await rm(lock,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){collect({date:process.argv.find(v=>/^\d{4}-\d{2}-\d{2}$/.test(v))}).catch(e=>{console.error(e.message);process.exitCode=1;});}

