export function twoPointStats(s){
 const keys=['fieldGoalsMade','fieldGoalsAttempted','threePointFieldGoalsMade','threePointFieldGoalsAttempted'];
 if(!s||!keys.every(k=>Number.isFinite(s[k])&&s[k]>=0))return {made:null,attempts:null,pct:null};
 const made=s.fieldGoalsMade-s.threePointFieldGoalsMade,attempts=s.fieldGoalsAttempted-s.threePointFieldGoalsAttempted;
 if(made<0||attempts<0||made>attempts)return {made:null,attempts:null,pct:null};
 return {made,attempts,pct:attempts>0?100*made/attempts:null};
}
export function basicStatValue(stats,key){return Number.isFinite(stats?.[key])?stats[key]:null;}
