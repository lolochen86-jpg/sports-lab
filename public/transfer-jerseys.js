// Historical numbers require a dated team-specific source. Never copy a present-day number backwards.
export const transferJerseys=[
 {league:'NBA',name:'Buddy Hield',team:'ATL',number:'8',asOf:'2026-02-07',source:'https://www.nba.com/game/cha-vs-atl-0022500751/game-charts'},
 {league:'NBA',name:'Dorian Finney-Smith',team:'HOU',number:'2',asOf:'2026-02-05',source:'https://statsdmz.nba.com/pdfs/20260205/20260205_CHAHOU_book.pdf'}
];
export const validJersey=x=>/^\d{1,2}$/.test(String(x??''));
