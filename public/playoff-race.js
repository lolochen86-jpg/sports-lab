export function orderConference(rows){
 const sorted=[...(rows??[])].sort((a,b)=>b.pct-a.pct||b.wins-a.wins||a.team.localeCompare(b.team));
 return sorted.map((x,i)=>({...x,rank:i>0&&x.pct===sorted[i-1].pct?null:i+1})).map((x,i,a)=>{if(x.rank===null){let j=i-1;while(j>=0&&a[j].rank===null)j--;x.rank=a[j].rank;}return x;});
}
export function gamesBehind(row,threshold){if(!row||!threshold)return null;return ((threshold.wins-row.wins)+(row.losses-threshold.losses))/2;}
