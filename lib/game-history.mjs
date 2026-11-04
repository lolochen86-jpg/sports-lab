export function preserveGameHistory(dashboard, previous) {
 const cutoff=dashboard.targetDates[0];
 const dates=new Set((previous?.historicalDates??[]).filter(d=>d<cutoff));
 for(const d of previous?.targetDates??[])if(d<cutoff)dates.add(d);
 const games=new Map((previous?.historicalGames??[]).filter(g=>g.date<cutoff).map(g=>[g.id,g]));
 for(const g of previous?.games??[])if(g.date<cutoff){dates.add(g.date);games.set(g.id,{...g,archiveObservedAt:previous.generatedAt,forecastEligible:false});}
 dashboard.historicalDates=[...dates].sort();
 dashboard.historicalGames=[...games.values()];
 return dashboard;
}
