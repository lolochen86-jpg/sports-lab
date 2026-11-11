import {pool} from './fetch.mjs';

export function parseMlbTeams(body,season){
 const d=JSON.parse(body),rows=(d.teams??[]).filter(x=>x.active===true&&x.sport?.id===1&&x.season===season);
 if(rows.length!==30||new Set(rows.map(x=>x.id)).size!==30||rows.some(x=>!Number.isSafeInteger(x.id)||!x.name||!x.abbreviation))throw Error('MLB 球隊清單或球季未通過核對');
 return rows.map(x=>({teamId:x.id,team:x.abbreviation,name:x.name}));
}
export function parseMlbRoster(body,expected){
 const d=JSON.parse(body);if(d.teamId!==expected.teamId||d.rosterType!=='40Man'||!Array.isArray(d.roster)||d.roster.length<5||d.roster.length>60)throw Error('MLB 名單球隊或人數不符');
 const seen=new Set();return d.roster.map(x=>{const id=x.person?.id,name=x.person?.fullName;if(!Number.isSafeInteger(id)||!name||seen.has(id)||x.parentTeamId!==expected.teamId)throw Error('MLB 球員身分或球隊不符');seen.add(id);return {id:String(id),name,teamId:expected.teamId,team:expected.team,jersey:x.jerseyNumber??null,position:x.position?.abbreviation??null,positionEn:x.position?.name??null,rosterStatus:x.status?.description??null,profile:`https://www.mlb.com/player/${id}`};});
}
export async function collectMlbRosters(client,previous,season){
 const teamsUrl=`https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${season}`;
 let sourceTeams;try{const r=await client.get({id:'mlb-roster-teams',provider:'mlb',url:teamsUrl,ttlMs:6*3600000,maxStaleMs:0});if(!r.body||r.stale)throw Error(r.error??'MLB 球隊來源不可用');sourceTeams=parseMlbTeams(r.body,season);}catch(e){return previous?{...previous,availableTeams:0,teams:(previous.teams??[]).map(t=>({...t,stale:true,error:'球隊清單更新失敗'})),stale:true,error:String(e.message??e)}:{league:'MLB',season,teamCount:0,availableTeams:0,players:0,teams:[],stale:true,error:String(e.message??e)};}
 const results=await pool(sourceTeams,async info=>{const url=`https://statsapi.mlb.com/api/v1/teams/${info.teamId}/roster?rosterType=40Man&season=${season}`;let r;try{r=await client.get({id:`mlb-roster-${info.teamId}`,provider:'mlb',url,ttlMs:6*3600000,maxStaleMs:0});if(!r.body||r.stale)throw Error(r.error??'來源不可用');return {...info,players:parseMlbRoster(r.body,info),source:url,observedAt:r.observedAt,sha256:r.sha256,stale:false,status:r.status};}catch(e){const old=previous?.season===season?previous.teams?.find(t=>t.teamId===info.teamId):null;return old?{...old,stale:true,status:r?.status??'failed',error:String(e.message??e)}:{...info,players:[],source:url,observedAt:null,sha256:null,stale:true,status:r?.status??'failed',error:String(e.message??e)};}},8);
 results.sort((a,b)=>a.name.localeCompare(b.name));return {league:'MLB',season,source:'MLB Stats API',rosterType:'40Man',teamCount:results.length,availableTeams:results.filter(t=>!t.stale).length,players:results.reduce((n,t)=>n+t.players.length,0),teams:results,limitations:'MLB 40 人名單來源快照，休賽季或異動可能延遲；不代表當天出賽、先發或傷病狀態。'};
}
