import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMlbPlayerNumbers} from '../lib/mlb-numbers.mjs';
const leaders={hitting:{categories:[{rows:[{id:1},{id:2},{id:1}]}]},pitching:{categories:[{rows:[{id:3}]}]}};
test('MLB 球員背號依 ID 對照，保留零號並忽略來源未提供的背號',async()=>{const client={get:async()=>({body:JSON.stringify({people:[{id:1,primaryNumber:'00'},{id:2},{id:3,primaryNumber:'7'},{id:999,primaryNumber:'2'}]}),observedAt:'2026-11-05T00:00:00Z'})};const result=await collectMlbPlayerNumbers(client,leaders);assert.equal(result.stale,false);assert.deepEqual(result.players,[{id:1,number:'00'},{id:3,number:'7'}]);});
test('MLB 背號來源失敗時保留舊資料並標示過期',async()=>{const prev={players:[{id:1,number:'4'}],observedAt:'2026-11-04T00:00:00Z'};const result=await collectMlbPlayerNumbers({get:async()=>{throw Error('offline')}},leaders,prev);assert.equal(result.stale,true);assert.deepEqual(result.players,prev.players);});
