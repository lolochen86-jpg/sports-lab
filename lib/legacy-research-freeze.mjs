/** Freeze the user's prior self-defined model results for historical review. */
export function freezeLegacyResearchPredictions(previous){
 const saved=new Map();
 for(const p of [...(previous?.legacyResearchPredictions??[]),...(previous?.retainedPredictions??[]),...(previous?.researchPredictions??[])]){
  if(!p||typeof p!=='object')continue;
  const key=JSON.stringify([p.gameId??null,p.generatedAt??null]);const already=saved.get(key);
  const start=Date.parse(p.startAt),created=Date.parse(p.generatedAt);
  const scenario=p.archivedScenario??(previous?.injuryScenarios??[]).find(s=>s.gameId===p.gameId&&Number.isFinite(Date.parse(s.generatedAt))&&Date.parse(s.generatedAt)===created&&Date.parse(s.generatedAt)<start)??null;
  const item=scenario?{...p,archivedScenario:scenario}:p;
  if(!already||(!already.archivedScenario&&item.archivedScenario))saved.set(key,item);
 }
 return [...saved.values()];
}
