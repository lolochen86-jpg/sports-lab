import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
export const sha=body=>createHash('sha256').update(body).digest('hex');
export async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,typeof value==='string'?value:JSON.stringify(value,null,2));try{for(let attempt=0;;attempt++){try{await rename(temp,file);break;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt>=4)throw e;await new Promise(r=>setTimeout(r,25*2**attempt));}}}finally{await rm(temp,{force:true});}}
export function retryDelay(value,now=Date.now()){if(!value)return 3600000;const n=Number(value);return Number.isFinite(n)?Math.max(0,n*1000):Math.max(0,Date.parse(value)-now)||3600000;}
export class SourceClient{
 constructor({directory,fetchImpl=fetch,timeoutMs=10000,deadline=Date.now()+90000,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){Object.assign(this,{directory,fetchImpl,timeoutMs,deadline,now,sleep});this.cooldowns=new Map();}
 async get(job){
  const started=this.now(),file=path.join(this.directory,sha(job.url)+'.json');let cached;try{cached=JSON.parse(await readFile(file,'utf8'));}catch{}
  const age=cached?.observedAt?started-Date.parse(cached.observedAt):Infinity;
  if(cached?.body&&age>=0&&age<(job.ttlMs??180000)&&!cached.cooldownUntil)return {...cached,id:job.id,provider:job.provider,status:'cached',attempts:0,elapsedMs:0};
  const circuitKey=job.circuitKey??new URL(job.url).origin;
  const circuitUntil=Math.max(cached?.cooldownUntil??0,this.cooldowns.get(circuitKey)??0);
  if(circuitUntil>started)return this.fallback(job,cached,{status:'cooldown',error:'來源暫停重試',cooldownUntil:circuitUntil,attempts:0,elapsedMs:0});
  let error;let httpStatus;let attempts=0;
  for(let attempt=0;attempt<2;attempt++){
   const remaining=this.deadline-this.now();if(remaining<=100){error='整輪時間上限';break;}
   attempts++;try{
    const signal=AbortSignal.timeout(Math.max(1,Math.min(this.timeoutMs,remaining)));
    const response=await this.fetchImpl(job.url,{signal,headers:{'User-Agent':'DigitalLab-SportsResearch/1.0','Accept':'application/json,text/html'}});httpStatus=response.status;
    if(!response.ok){error=`HTTP ${response.status}`;if([401,403,429].includes(response.status)){const cooldownUntil=this.now()+(response.status===429?retryDelay(response.headers.get('retry-after'),this.now()):21600000);this.cooldowns.set(circuitKey,cooldownUntil);await atomic(file,{...(cached??{}),cooldownUntil,lastFailure:{httpStatus,error,at:new Date(this.now()).toISOString()}});return this.fallback(job,cached,{status:response.status===429?'rate_limited':'blocked',error,httpStatus,cooldownUntil,attempts,elapsedMs:this.now()-started});}if(response.status<500)break;}
    else{
     const reader=response.body.getReader();let size=0;const chunks=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>12*1024*1024){await reader.cancel();throw new Error('來源回應超過12MB');}chunks.push(value);}}finally{reader.releaseLock();}
     const body=Buffer.concat(chunks).toString('utf8');if(!body.trim())throw new Error('空白回應');const observedAt=new Date(this.now()).toISOString();const result={url:job.url,body,observedAt,sha256:sha(body),httpStatus,contentType:response.headers.get('content-type'),provider:job.provider,id:job.id,status:'live',attempts,elapsedMs:this.now()-started};await atomic(file,{...result,cooldownUntil:null});return result;
    }
   }catch(e){error=e.name==='TimeoutError'||e.name==='AbortError'?'請求逾時':e.message;}
   if(attempt===0&&this.deadline-this.now()>450)await this.sleep(150+Math.floor(Math.random()*150));
  }
  return this.fallback(job,cached,{status:error?.includes('逾時')?'timeout':'failed',error:error??'來源不可用',httpStatus,attempts,elapsedMs:this.now()-started});
 }
 fallback(job,cached,failure){const age=cached?.observedAt?this.now()-Date.parse(cached.observedAt):Infinity;return {id:job.id,provider:job.provider,url:job.url,...failure,...(cached?.body&&age>=0&&age<(job.maxStaleMs??86400000)?{body:cached.body,observedAt:cached.observedAt,sha256:cached.sha256,cacheFallback:true,stale:true}:{stale:false})};}
}
export async function pool(jobs,worker,concurrency=6){const queue=[...jobs],out=[];let failure;await Promise.allSettled(Array.from({length:Math.min(concurrency,jobs.length)},async()=>{while(queue.length&&!failure){const job=queue.shift();try{out.push(await worker(job));}catch(e){failure??=e;}}}));if(failure)throw failure;return out;}
