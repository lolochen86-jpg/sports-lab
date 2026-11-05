export async function collectMlbPlayerNumbers(client,leaderboards,previous){
 const ids=[...new Set(['hitting','pitching'].flatMap(k=>(leaderboards?.[k]?.categories??[]).flatMap(c=>(c.rows??[]).map(p=>Number(p.id)))).filter(Number.isSafeInteger))];
 if(!ids.length)return previous?{...previous,stale:true,error:'排行榜球員不足'}:{players:[],stale:true,error:'排行榜球員不足'};
 try{
  const batches=[];for(let i=0;i<ids.length;i+=75)batches.push(ids.slice(i,i+75));
  const replies=await Promise.all(batches.map((batch,i)=>client.get({id:`mlb-numbers-${i}`,provider:'mlb',url:`https://statsapi.mlb.com/api/v1/people?personIds=${batch.join(',')}`,ttlMs:6*3600000,maxStaleMs:0})));
  const players=[];for(const [i,r] of replies.entries()){if(!r.body||r.stale)throw Error(r.error??'MLB 來源不可用');const d=JSON.parse(r.body);if(!Array.isArray(d.people))throw Error('MLB 球員資料格式錯誤');const expected=new Set(batches[i]);for(const p of d.people){if(expected.has(p.id)&&p.primaryNumber!==undefined&&/^\d{1,2}$/.test(String(p.primaryNumber)))players.push({id:p.id,number:String(p.primaryNumber)});}}
  return {players,source:'https://statsapi.mlb.com/api/v1/people',observedAt:replies.map(r=>r.observedAt).sort()[0],stale:false};
 }catch(e){return previous?{...previous,stale:true,error:e.message}:{players:[],stale:true,error:e.message};}
}
