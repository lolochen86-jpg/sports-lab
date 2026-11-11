// Standalone Elo baseline. An old pregame snapshot is never regenerated after tipoff.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const when=x=>Number.isFinite(Date.parse(x))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x)):'未提供';
const pct=x=>`${(100*x).toFixed(1)}%`;
const MODEL='nba-elo-dobson-v1';
const MODEL_SOURCE='https://github.com/nicidob/nba_elo';
const DATA_SOURCE='https://www.boxscorelab.com/downloads/';
const MAX_AGE=72*60*60*1000;
function sameGame(p,g){return p?.gameId===g.id&&p.league==='NBA'&&g.league==='NBA'&&p.home===g.home&&p.away===g.away&&Date.parse(p.startAt)===Date.parse(g.startAt);}
function valid(p,g,now){
 const created=Date.parse(p?.generatedAt),observed=Date.parse(p?.observedAt),start=Date.parse(g.startAt);
 if(!sameGame(p,g)||p.status!=='experimental'||p.model!==MODEL||p.modelSource!==MODEL_SOURCE||p.historicalDataSource!==DATA_SOURCE||!Number.isFinite(created)||!Number.isFinite(observed)||observed>created||created>now||created>=start||!/^\d{4}-\d{2}-\d{2}$/.test(p.historyThrough??''))return false;
 if(!finite(p.eloHome)||!finite(p.eloAway)||![0,100].includes(p.homeAdvantage)||!finite(p.homeWinProbability)||!finite(p.awayWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||Math.abs(p.awayWinProbability+p.homeWinProbability-1)>1e-8)return false;
 return Math.abs(p.homeWinProbability-1/(1+10**(-((p.eloHome+p.homeAdvantage-p.eloAway)/400))))<1e-8;
}
export function selectEloPrediction(game,current=[],retained=[],now=Date.now()){
 if(game.league!=='NBA')return {prediction:null,reason:null};
 const start=Date.parse(game.startAt),t=Number(now);
 if(!Number.isFinite(start)||!Number.isFinite(t))return {prediction:null,reason:'賽事時間未確認'};
 if(game.comparison==='conflict'||game.comparison==='stale_only'||(game.conflicts??[]).length)return {prediction:null,reason:'賽事資料衝突或過期'};
 const before=start>t;
 if(before&&game.status!=='scheduled')return {prediction:null,reason:'賽事狀態未確認'};
 if(!before&&!['scheduled','live','final'].includes(game.status))return {prediction:null,reason:'賽事狀態未確認'};
 const rows=(before?current:retained).filter(p=>sameGame(p,game));
 if(before&&rows.length>1)return {prediction:null,reason:'預測資料重複，等待核對'};
 if(before&&rows[0]?.status==='pending')return {prediction:null,reason:rows[0].reason||'歷史數據尚未完整更新'};
 const good=rows.filter(p=>valid(p,game,t)).sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt));
 if(!good.length)return {prediction:null,reason:before?'資料尚未齊備或不符賽前條件':'尚無保存的賽前 Elo 預測'};
 const p=good[0];
 if(before&&(t-Date.parse(p.generatedAt)>MAX_AGE||t-Date.parse(p.observedAt)>MAX_AGE))return {prediction:null,reason:'資料超過 72 小時，等待更新'};
 return {prediction:p,archived:!before,reason:null};
}
export function eloPredictionCard(game,current,retained,now){
 if(game.league!=='NBA')return '';
 const {prediction:p,archived,reason}=selectEloPrediction(game,current,retained,now);
 if(!p)return `<section class="provider-prediction-notice"><strong>球隊 Elo 基準：暫不可用</strong><p>${esc(reason)}</p></section>`;
 const home=p.eloHome.toFixed(2),away=p.eloAway.toFixed(2),difference=(p.eloHome+p.homeAdvantage-p.eloAway).toFixed(2);
 return `<section class="provider-prediction-notice"><h3>${archived?'球隊 Elo 賽前存檔':'球隊 Elo 基準預測'}</h3><div class="prediction-values"><div><span>客隊勝率</span><strong>${pct(p.awayWinProbability)}</strong></div><div><span>主隊勝率</span><strong>${pct(p.homeWinProbability)}</strong></div></div><p>歷史賽果截至 ${esc(p.historyThrough)}（美國賽事日期） · 賽果資料取得 ${esc(when(p.scoreDataObservedAt))} · 預測產生 ${esc(when(p.generatedAt))}（台灣時間）</p><details><summary>展開公式與實際代入</summary><p>主隊勝率 = 1 ÷ (1 + 10<sup>−(主隊 Elo + 主場優勢 − 客隊 Elo) ÷ 400</sup>)</p><p>主隊勝率 = 1 ÷ (1 + 10<sup>−(${home} + ${p.homeAdvantage} − ${away}) ÷ 400</sup>) = ${pct(p.homeWinProbability)}</p><p>差值 ${difference}；客隊勝率 = 1 − ${pct(p.homeWinProbability)} = ${pct(p.awayWinProbability)}</p><p>起始值為 <a href="https://github.com/Neil-Paine-1/NBA-elo" target="_blank" rel="noopener noreferrer">Neil Paine 2022–23 賽季結束 Elo ↗</a>；之後只重算例行賽，未納入季後賽。歷史賽果：<a href="${DATA_SOURCE}" target="_blank" rel="noopener noreferrer">BoxScore Lab ↗</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>）。公式：<a href="${MODEL_SOURCE}" target="_blank" rel="noopener noreferrer">Dobson 公開實作 ↗</a>。</p><p>我們回放 2023–26 年例行賽共 3,690 場：勝負正確率 65.6%，Brier 分數 0.2146。這是歷史回放驗證，非事前公開預測成績。</p></details><p>球隊歷史戰績基準；不含傷病、球員出賽、交易、得分或逐節比分，不能代表球員優先模型。僅供參考。</p></section>`;
}

