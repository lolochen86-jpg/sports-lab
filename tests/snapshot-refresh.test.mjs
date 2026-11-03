import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotRefresh} from '../public/snapshot-refresh.js';
const snap=(n)=>({schemaVersion:1,runId:String(n),generatedAt:`2026-11-03T${n}:00:00Z`,targetDates:['2026-11-03']});
test('refresh applies only new snapshots and preserves usable data on failure or rollback',async()=>{
 let next=snap(10),applied=[],errors=[],checks=0;
 const refresh=createSnapshotRefresh({fetchSnapshot:async()=>{if(next instanceof Error)throw next;return next;},apply:n=>applied.push(n),status:()=>checks++,failed:(e,previous)=>errors.push(previous)});
 await refresh();await refresh();assert.equal(applied.length,1);assert.equal(checks,2);
 next=new Error('offline');await refresh();assert.equal(errors[0].runId,'10');
 next=snap(11);await refresh();assert.equal(applied.length,2);
 next=snap(10);await refresh();assert.equal(applied.length,2);assert.equal(errors[1].runId,'11');
 next={};await refresh();assert.equal(applied.length,2);
});
test('overlapping timer and visibility updates share one request',async()=>{
 let resolve,count=0;const refresh=createSnapshotRefresh({fetchSnapshot:()=>{count++;return new Promise(r=>resolve=r);},apply:()=>{},status:()=>{},failed:()=>{}});
 const a=refresh(),b=refresh();assert.equal(a,b);assert.equal(count,1);resolve(snap(10));await a;
});
