import {mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {SourceClient,pool,atomic} from '../lib/fetch.mjs';
import {makeJobs,parsers,PROVIDERS,taipeiDate,shiftDate,team} from '../lib/providers.mjs';
import {reconcileGames,reconcileInjuries} from '../lib/reconcile.mjs';
import {collectLeaderboards} from '../lib/leaderboards.mjs';
import {collectMlbPlayerNumbers} from '../lib/mlb-numbers.mjs';
import {collectImprovement} from '../lib/improvement.mjs';
import {collectPopularity} from '../lib/player-popularity.mjs';
import {collectRecentForm} from '../lib/recent-player-form.mjs';
import {collectTeamStats} from '../lib/team-stats.mjs';
import {collectRosters} from '../lib/rosters.mjs';
import {gatherInjuryEvidence,compareInjuries} from '../lib/injury-scenario.mjs';
import {gatherHistory,calculatePredictions} from '../lib/prediction.mjs';
import {preserveUnavailable} from '../lib/preserve.mjs';
import {preserveGameHistory} from '../lib/game-history.mjs';
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
  const improvement=await collectImprovement(client,previous?.improvement);
  const {games,unresolved}=reconcileGames(observations,dates);const injuryRows=reconcileInjuries(injuries);const imported=JSON.parse(await readFile(path.join(data,'legacy-archive.json'),'utf8'));if(!Array.isArray(imported.forecasts)||!Array.isArray(imported.rookieSnapshots)||!Array.isArray(imported.backtests))throw new Error('歷史存檔格式錯誤');
  const needsHistory=games.some(g=>g.league==='NBA'&&g.status==='scheduled'&&Date.parse(g.startAt)>Date.now()&&g.sourceCount>=2&&!g.conflicts.length);
  const history=needsHistory?await gatherHistory(client,date):{complete:false,events:[],receipts:[],failures:[]};
  const evidenceAt=new Date().toISOString();
  const injuryEvidence=needsHistory&&history.complete?await gatherInjuryEvidence(client,games,injuryRows,history,evidenceAt):{};
  const predictionAt=new Date().toISOString();
  const researchPredictions=calculatePredictions(games,history,predictionAt);
  const injurySourceOk=['espn-injuries','cbs-injuries'].every(id=>receipts.some(r=>r.id===id&&r.parseStatus==='ok'&&!r.stale));
  const injuryScenarios=compareInjuries(researchPredictions,injuryRows,injuryEvidence,injurySourceOk,predictionAt);
  const leaderboards=await collectLeaderboards(client,previous?.leaderboards,Number(date.slice(0,4)));
  const mlbPlayerNumbers=await collectMlbPlayerNumbers(client,leaderboards,previous?.mlbPlayerNumbers);
  const teamDashboard=await collectTeamStats(client,previous?.teamDashboard);
  const rosterDatabase=await collectRosters(client,previous?.rosterDatabase);
  const recentForm=await collectRecentForm(client,leaderboards?.nba,rosterDatabase,history,new Date().toISOString());
  const popularity=await collectPopularity(client,leaderboards?.nba,rosterDatabase,new Date().toISOString());
  const analysisReadiness=archives.filter(a=>a.provider==='statshub').flatMap(a=>(a.data.games??[]).filter(r=>r.game&&r.prediction).map(r=>({league:a.data.league,away:team(r.game.away.tricode??r.game.away.abbreviation??r.game.away.name_en,a.data.league),home:team(r.game.home.tricode??r.game.home.abbreviation??r.game.home.name_en,a.data.league),startAt:r.game.start_time_utc,status:r.prediction.status,reasons:r.prediction.reasons??[],sourceUpdatedAt:a.data.sourceUpdatedAt})));
  for(const g of games){g.forecasts=imported.forecasts.filter(p=>p.league===g.league&&p.away===g.away&&p.home===g.home&&Math.abs(Date.parse(p.startAt)-Date.parse(g.startAt))<300000);g.modelState=analysisReadiness.filter(p=>p.league===g.league&&p.away===g.away&&p.home===g.home&&Math.abs(Date.parse(p.startAt)-Date.parse(g.startAt))<300000);}
  const sourceHealth=Object.entries(PROVIDERS).map(([id,meta])=>{const rows=receipts.filter(r=>r.provider===id);const usable=rows.filter(r=>r.parseStatus==='ok'&&!r.stale);return {id,...meta,aggregate:['statshub','hoopslab'].includes(id),status:!rows.length?'not_requested':usable.length===rows.length?'ok':usable.length?'partial':'unavailable',usableEndpoints:usable.length,totalEndpoints:rows.length,records:rows.reduce((n,r)=>n+r.recordCount,0),observedAt:rows.map(r=>r.observedAt).filter(Boolean).sort().at(-1)??null,independentUpstreamConfirmed:id==='nba'||id==='mlb',endpoints:rows};});
  const activeProviders=sourceHealth.filter(s=>!s.aggregate&&s.usableEndpoints>0);const dashboard={schemaVersion:1,title:'Sports Lab',runId,generatedAt:new Date().toISOString(),targetDates:dates,timeZone:'Asia/Taipei',collection:{status:progress.failures?'partial_success':'success',durationMs:Date.now()-started,budgetMs,total:jobs.length,usable:receipts.filter(r=>r.parseStatus==='ok'&&!r.stale).length,failed:progress.failures,activeProviderCount:activeProviders.length,warning:'來源網站數不等於獨立上游數；不使用網站票數當預測信心。'},teamDashboard,rosterDatabase,leaderboards,mlbPlayerNumbers,improvement,recentForm,popularity,injuryScenarios,predictionHistory:{complete:history.complete,failures:history.failures,days:history.receipts.length},researchPredictions,schedule:{taipeiHours:[7,14,21],mechanism:'GitHub Actions',mayBeDelayed:true},games,injuries:injuryRows,unresolvedSchedule:unresolved,officialReports:reports,sources:sourceHealth,...imported,limitations:['新研究基準僅根據近期完賽比分，未經獨立校準；不混合原站模型勝率。','新預測僅供研究，未納入傷病與先發；原站舊預測仍是歷史存檔。','傷病取同隊完整姓名配對，無記錄不代表健康；預期先發不等於確認先發。','MLB 非賽季或無賽事時如實顯示空賽程；不補造比賽。','NBA 官方CDN若403會保留阻擋原因；官方PDF目前提供連結索引，未解析成球員共識。']};
  // Never replace a useful previous snapshot with an empty failed refresh.
  preserveUnavailable(dashboard,previous,receipts);
  preserveGameHistory(dashboard,previous);
  await atomic(path.join(data,'dashboard.json'),dashboard);await atomic(path.join(data,'runs',runId+'.json'),dashboard);progress.stage='complete';progress.completedAt=new Date().toISOString();progress.status=dashboard.collection.status;await atomic(path.join(data,'progress.json'),progress);
  const runs=(await readdir(path.join(data,'runs'))).filter(n=>n.endsWith('.json')).sort();for(const old of runs.slice(0,-20))await rm(path.join(data,'runs',old));
  console.log(JSON.stringify({runId,status:dashboard.collection.status,providers:activeProviders.length,games:games.length,injuries:injuryRows.length,unresolved:unresolved.length,durationMs:Date.now()-started}));return dashboard;
 }catch(e){progress.stage='failed';progress.error=e.message;await atomic(path.join(data,'progress.json'),progress);throw e;}finally{if(acquired)await rm(lock,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){collect({date:process.argv.find(v=>/^\d{4}-\d{2}-\d{2}$/.test(v))}).catch(e=>{console.error(e.message);process.exitCode=1;});}
