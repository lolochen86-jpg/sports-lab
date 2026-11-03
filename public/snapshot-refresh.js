// Serialise refreshes and retain the last usable snapshot on network failure.
export function createSnapshotRefresh({fetchSnapshot, apply, status, failed}) {
 let current, pending;
 return function refresh() {
  if(pending)return pending;
  pending=(async()=>{
   try {
    const next=await fetchSnapshot();
    if(next.schemaVersion!==1||!Array.isArray(next.targetDates)||!next.targetDates.length||!Number.isFinite(Date.parse(next.generatedAt)))throw new Error('Invalid snapshot');
    if(current&&Date.parse(next.generatedAt)<Date.parse(current.generatedAt))throw new Error('Older snapshot');
    if(!current||next.runId!==current.runId||next.generatedAt!==current.generatedAt){apply(next,current);current=next;}
    status(current);
   }catch(error){failed(error,current);}
   finally{pending=null;}
  })();
  return pending;
 };
}
