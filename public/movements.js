// Verified from the linked official league or team releases; dates are US transaction dates.
const nba='https://www.nba.com/news/2026-offseason-trade-tracker';
const trades=[
['2026-09-27','Rob Dillingham','CHI','CHA'],['2026-09-27','Buddy Hield','CHA','CHI'],
['2026-09-22','Dorian Finney-Smith','CHA','ATL'],['2026-09-22','Buddy Hield','ATL','CHA'],['2026-09-22','Ryan Nembhard','ATL','CHA'],
['2026-09-14','Kawhi Leonard','LAC','TOR'],['2026-09-14','Gradey Dick','TOR','LAC'],['2026-09-14','Brandon Ingram','TOR','LAC'],
['2026-09-08','Jordan Hawkins','NOP','MEM'],['2026-09-08','Micah Peavy','NOP','MEM'],['2026-09-08','Taj Gibson','MEM','NOP'],['2026-09-08','AJ Johnson','MEM','NOP'],
['2026-08-29','Josh Green','MIN','UTA'],['2026-08-29','John Konchar','UTA','MIN'],['2026-08-29','Cody Williams','UTA','MIN'],
['2026-08-20','Peyton Watson','DEN','CLE'],['2026-08-20','Cam Whitmore','WAS','CLE'],['2026-08-20','Max Strus','CLE','LAC'],['2026-08-20','Dennis Schröder','CLE','CHA'],['2026-08-20','Julian Reese','WAS','DEN'],['2026-08-20','Tre Mann','CHA','WAS'],
['2026-07-28','Johni Broome','PHI','LAC'],['2026-07-19','Luguentz Dort','OKC','ATL'],['2026-07-19','Ryan Nembhard','DAL','ATL'],['2026-07-19','Zaccharie Risacher','ATL','DAL'],
['2026-07-13','Miles Bridges','CHA','PHX'],['2026-07-13','Grayson Allen','PHX','CHA'],['2026-07-13',"Royce O'Neale",'PHX','CHA'],
['2026-07-10','Julius Randle','MIN','BKN'],['2026-07-10','Nic Claxton','BKN','CHI'],['2026-07-10','Naz Reid','MIN','CHA'],['2026-07-10','LaMelo Ball','CHA','MIN'],['2026-07-10','Josh Green','CHA','MIN'],
['2026-07-08','Khris Middleton','DAL','WAS'],['2026-07-08','AJ Johnson','DAL','MEM'],['2026-07-08',"D'Angelo Russell",'WAS','MEM'],['2026-07-08','Isaiah Stewart','DET','MEM'],['2026-07-08','Santi Aldama','MEM','DAL'],['2026-07-08','Marcus Sasser','DET','DAL'],['2026-07-08','Caris LeVert','DET','MIL'],['2026-07-08','John Collins','LAC','DET'],['2026-07-08','Gary Harris','MIL','DET'],['2026-07-08','Taurean Prince','MIL','DET'],
['2026-07-07','Deandre Ayton','LAL','WAS'],['2026-07-07','Jaden Hardy','WAS','LAL'],['2026-07-06','Dorian Finney-Smith','HOU','CHA'],['2026-07-06','Isaiah Joe','OKC','DET'],['2026-07-06','Jaylen Brown','BOS','PHI'],['2026-07-06','Paul George','PHI','BOS'],['2026-07-06','Giannis Antetokounmpo','MIL','MIA'],['2026-07-06','Bobby Portis','MIL','MIA'],['2026-07-06','Tyler Herro','MIA','MIL'],['2026-07-06',"Kel'el Ware",'MIA','MIL'],['2026-07-06','Jaime Jaquez Jr.','MIA','MIL'],['2026-07-06','Kasparas Jakucionis','MIA','MIL'],['2026-07-06','Aaron Wiggins','OKC','ATL'],['2026-06-30','Devin Carter','SAC','ATL'],['2026-06-29','Ja Morant','MEM','POR'],['2026-06-29','Jerami Grant','POR','MEM'],['2026-06-29','Kris Murray','POR','MEM']
].map(([date,name,from,to])=>({league:'NBA',date,name,from,to,type:'交易 / Trade',source:nba}));
export const movements=[...trades,
{league:'NBA',date:'2026-07-08',name:'Walker Kessler',from:'UTA',to:'LAL',type:'先簽後換 / Sign-and-trade',source:nba},
{league:'NBA',date:'2026-07-27',name:'LeBron James',from:'LAL',to:'PHI',type:'自由球員簽約 / Free agent',source:'https://www.nba.com/sixers/news/philadelphia-76ers-sign-4x-nba-champion-and-22x-all-star-lebron-james'},
{league:'NBA',date:'2026-07-14',name:'Luke Kennard',from:'LAL',to:'PHX',type:'自由球員簽約 / Free agent',source:'https://www.nba.com/news/luke-kennard-suns-deal'},
{league:'MLB',date:'2026-11-03',name:'Eduardo Rivera',zh:'艾德華多·里維拉',from:'Boston Red Sox',to:'St. Louis Cardinals',type:'交易 / Trade',source:'https://www.mlb.com/cardinals/roster/transactions/'},
{league:'MLB',date:'2026-10-29',name:'Nate Eaton',zh:'內特·伊頓',from:'Boston Red Sox',to:'Athletics',type:'交易 / Trade',source:'https://www.mlb.com/press-release/red-sox-trade-of-nate-eaton-to-athletics'}
];
export const movementReviewDate='2026-11-05';
