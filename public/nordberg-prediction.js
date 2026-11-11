// Refit of Nordberg's public last-10-game logistic model, kept distinct from other models.
const MODEL='nordberg-last10-logit-refit-v1',SOURCE='https://github.com/tylernordberg0/nba-game-predictor',DATA='https://www.boxscorelab.com/downloads/',MAX_AGE=72*3600000;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=x=>typeof x==='number'&&Number.isFinite(x),time=x=>Date.parse(x),pct=x=>`${(100*x).toFixed(1)}%`;
const date=x=>Number.isFinite(time(x))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x)):'未提供';
const labels={point_diff:'淨勝分',efg:'有效命中率 eFG（0–1）',ast_to:'助攻失誤比 AST/TO',ftr:'罰球出手比 FTA/FGA（0–1）',offensive_rebounds:'進攻籃板',defensive_rebounds:'防守籃板'};
const expected=new Set(Object.keys(labels).flatMap(x=>[`home_${x}`,`away_${x}`]));
const same=(p,g)=>p?.gameId===g.id&&p.league==='NBA'&&p.home===g.home&&p.away===g.away&&time(p.startAt)===time(g.startAt);
const easternDay=v=>{const f=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(v)).map(p=>[p.type,p.value]));return `${f.year}-${f.month}-${f.day}`;};
function valid(p,g,now){
 const generated=time(p?.generatedAt),observed=time(p?.observedAt),dataObserved=time(p?.dataObservedAt),start=time(g.startAt),t=p?.trace;
 if(!same(p,g)||p.status!=='experimental'||p.model!==MODEL||p.source!==SOURCE||p.dataSource!==DATA||!Number.isFinite(generated)||!Number.isFinite(observed)||!Number.isFinite(dataObserved)||observed>generated||dataObserved>generated||generated>now||generated>=start||!/^\d{4}-\d{2}-\d{2}$/.test(p.historyThrough??'')||!/^\d{4}-\d{2}-\d{2}$/.test(p.trainingCutoff??'')||p.historyThrough>=easternDay(start)||p.trainingCutoff>p.historyThrough)return false;
 if(!finite(p.homeWinProbability)||!finite(p.awayWinProbability)||p.homeWinProbability<0||p.homeWinProbability>1||Math.abs(p.homeWinProbability+p.awayWinProbability-1)>1e-8||!finite(t?.intercept)||!finite(t?.linearScore)||!Array.isArray(t?.terms)||t.terms.length!==12)return false;
 const seen=new Set();let s=t.intercept;
 for(const x of t.terms){if(!expected.has(x.name)||seen.has(x.name)||x.team!==(x.name.startsWith('home_')?g.home:g.away)||!finite(x.featureValue)||!finite(x.coefficient)||!finite(x.product)||Math.abs(x.product-x.featureValue*x.coefficient)>1e-8)return false;seen.add(x.name);s+=x.product;}
 return Math.abs(s-t.linearScore)<1e-8&&Math.abs(p.homeWinProbability-1/(1+Math.exp(-t.linearScore)))<1e-8;
}
export function selectNordberg(game,current=[],retained=[],now=Date.now()){
 if(game?.league!=='NBA')return {prediction:null,reason:null};
 const start=time(game.startAt),t=Number(now);if(!Number.isFinite(start)||!Number.isFinite(t))return {prediction:null,reason:'賽事時間尚未確認'};
 if(game.comparison==='conflict'||game.comparison==='stale_only'||(game.conflicts??[]).length)return {prediction:null,reason:'賽程資料衝突或過期'};
 const before=start>t;if(before&&game.status!=='scheduled')return {prediction:null,reason:'比賽狀態尚未確認'};if(!before&&!['scheduled','live','final'].includes(game.status))return {prediction:null,reason:'比賽狀態尚未確認'};
 const rows=(before?current:retained).filter(p=>same(p,game));if(before&&rows.length>1)return {prediction:null,reason:'資料重複，等待核對'};if(before&&rows[0]?.status==='pending')return {prediction:null,reason:rows[0].reason??'球隊數據待確認'};
 const good=rows.filter(p=>valid(p,game,t)).sort((a,b)=>time(b.generatedAt)-time(a.generatedAt));if(!good.length)return {prediction:null,reason:before?'球隊數據或公式驗證未通過':'沒有可核對的賽前存檔'};
 const p=good[0];if(before&&(t-time(p.generatedAt)>MAX_AGE||t-time(p.observedAt)>MAX_AGE||t-time(p.dataObservedAt)>MAX_AGE))return {prediction:null,reason:'資料超過 72 小時，等待更新'};
 return {prediction:p,archived:!before,reason:null};
}
export function nordbergCard(game,current,retained,now,options={}){
 if(game?.league!=='NBA')return '';
 const {prediction:p,reason,archived}=selectNordberg(game,current,retained,now);if(!p)return `<section class="provider-prediction-notice"><h3>近 10 場球隊數據模型</h3><p>暫不可用：${esc(reason)}</p></section>`;
 const term=x=>{const key=x.name.replace(/^(home|away)_/,'');const team=options.shortTeam?.(x.team,'NBA')??x.team;return `<tr><th scope="row">${esc(team)} ${esc(labels[key])}</th><td>${x.featureValue.toFixed(4)}</td><td>${x.coefficient.toFixed(6)}</td><td>${x.product.toFixed(4)}</td></tr>`;};
 return `<section class="provider-prediction-notice"><h3>${archived?'近 10 場數據模型・賽前存檔':'近 10 場球隊數據模型'}</h3><div class="prediction-values"><div><span>客隊勝率</span><strong>${pct(p.awayWinProbability)}</strong></div><div><span>主隊勝率</span><strong>${pct(p.homeWinProbability)}</strong></div></div><p>賽果截至 ${esc(p.historyThrough)}（美國日期） · 資料取得 ${esc(date(p.dataObservedAt))} · 預測 ${esc(date(p.generatedAt))}（台灣時間）</p><details><summary>展開公式與 12 個數據</summary><p>主隊勝率 = 1 ÷ (1 + e<sup>−Z</sup>)</p><p>Z = 截距 + Σ（球隊數據 × 係數）</p><p>Z = ${p.trace.intercept.toFixed(6)} + Σ（下表 12 項貢獻）= ${p.trace.linearScore.toFixed(6)}</p><p>主隊勝率 = 1 ÷ (1 + e<sup>−(${p.trace.linearScore.toFixed(6)})</sup>) = ${pct(p.homeWinProbability)}</p><div class="table-wrap"><table><thead><tr><th>球隊 / 數據</th><th>近 10 場平均</th><th>係數</th><th>貢獻</th></tr></thead><tbody>${p.trace.terms.map(term).join('')}</tbody></table></div><p>以兩隊最近最多 10 場的淨勝分、有效命中率、助攻失誤比、罰球出手比、進攻與防守籃板計算。係數以截至 ${esc(p.trainingCutoff)} 的歷史資料自行重新擬合，並非原作者原始係數。</p><p><a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Nordberg 公開模型 ↗</a> · <a href="${DATA}" target="_blank" rel="noopener noreferrer">BoxScore Lab 賽果資料 ↗</a></p></details><p>球隊數據模型，未直接納入球員、傷病、交易與陣容；僅供參考。</p></section>`;
}
