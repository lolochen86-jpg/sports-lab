import {twoPointStats} from './nba-basic-stats.js';

// Prefer the all-player regular-season snapshot; qualified leaderboards are a fallback.
export function nbaRosterSeason(data,id){
 const current=data?.improvement?.current, leaders=data?.leaderboards?.nba;
 const candidates=[current,leaders].filter(s=>s&&Array.isArray(s.players)&&Number.isInteger(s.seasonYear)&&(!leaders?.seasonYear||s.seasonYear===leaders.seasonYear));
 for(const source of candidates){const player=source.players.find(p=>String(p.id)===String(id));if(player?.stats&&Number.isFinite(player.stats.gamesPlayed)&&player.stats.gamesPlayed>0)return {source,player};}
 return null;
}

export function nbaRosterStatValues(stats){
 const number=v=>Number.isFinite(v)?v.toFixed(1):'—';
 const pct=(made,attempts,value)=>Number.isFinite(attempts)&&attempts>0&&Number.isFinite(made)&&made>=0&&made<=attempts&&Number.isFinite(value)&&value>=0&&value<=100?`${value.toFixed(1)}%`:'—';
 const two=twoPointStats(stats);
 return [['場次 / GP',Number.isFinite(stats.gamesPlayed)?String(stats.gamesPlayed):'—'],['時間 / MIN',number(stats.avgMinutes)],['得分 / PTS',number(stats.avgPoints)],['籃板 / REB',number(stats.avgRebounds)],['助攻 / AST',number(stats.avgAssists)],['抄截 / STL',number(stats.avgSteals)],['阻攻 / BLK',number(stats.avgBlocks)],['失誤 / TOV',number(stats.avgTurnovers)],['投籃 / FG%',pct(stats.fieldGoalsMade,stats.fieldGoalsAttempted,stats.fieldGoalPct)],['兩分 / 2P%',two.pct===null?'—':`${two.pct.toFixed(1)}%`],['三分 / 3P%',pct(stats.threePointFieldGoalsMade,stats.threePointFieldGoalsAttempted,stats.threePointFieldGoalPct)],['罰球 / FT%',pct(stats.freeThrowsMade,stats.freeThrowsAttempted,stats.freeThrowPct)]];
}
