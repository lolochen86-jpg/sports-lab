const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (v, digits = 2) => typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';
const safeLink = (url, title) => { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>` : esc(title); } catch { return esc(title); } };
const gameUrl = id => /^\d+$/.test(String(id ?? '')) ? `https://www.espn.com/nba/boxscore/_/gameId/${id}` : null;
const time = v => Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)) : '未提供';
const teamName = (team, options) => options?.shortTeam?.(team) ?? team ?? '待確認';
const noTrace = '<p class="walkthrough-note">這份預測產生時沒有保存完整計算明細，無法可靠還原當時的數值；不使用目前資料補算。</p>';
function historyLinks(sources) {
  if (!Array.isArray(sources) || !sources.length) return '<p>本次歷史比分來源未保存。</p>';
  return `<ul class="walkthrough-sources">${sources.map(s=>`<li>${safeLink(s.url, `ESPN ${s.day ?? '日期未提供'} 賽果`)} <span>取得 ${esc(time(s.observedAt))}（台灣時間）</span></li>`).join('')}</ul>`;
}
function gamesTable(side, options, quarters = false) {
  if (!Array.isArray(side?.samples) || !side.samples.length) return '<p>本次樣本明細未保存。</p>';
  return `<div class="walkthrough-scroll"><table><thead><tr><th>日期／對手</th>${quarters ? '<th>本隊每節得分 Q1–Q4</th><th>對手每節得分 Q1–Q4</th>' : '<th>本隊得分</th><th>對手得分</th>'}<th>來源</th></tr></thead><tbody>${[...side.samples].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).map(g=>`<tr><td>${esc(time(g.date))}<br>${esc(teamName(g.opponent,options))}</td><td>${quarters ? esc(Array.isArray(g.scored)?g.scored.join(' / '):'—') : esc(number(g.scored,0))}</td><td>${quarters ? esc(Array.isArray(g.allowed)?g.allowed.join(' / '):'—') : esc(number(g.allowed,0))}</td><td>${safeLink(gameUrl(g.id),'比賽')}</td></tr>`).join('')}</tbody></table></div>`;
}
function teamBaseline(side, league, prior, options) {
  const n=side?.samples?.length;
  return `<section class="walkthrough-step"><h5>${esc(teamName(side?.team,options))}：近期樣本 ${esc(n ?? '—')} 場</h5><p>平均得分 <strong>${number(side?.rawScored)}</strong>，平均失分 <strong>${number(side?.rawAllowed)}</strong>。</p><p>調整後得分 ≈（${number(n,0)} × ${number(side?.rawScored)} ＋ ${number(prior,0)} × ${number(league)}）÷（${number(n,0)} ＋ ${number(prior,0)}）＝ <strong>${number(side?.adjustedScored)}</strong></p><p>調整後失分 ≈（${number(n,0)} × ${number(side?.rawAllowed)} ＋ ${number(prior,0)} × ${number(league)}）÷（${number(n,0)} ＋ ${number(prior,0)}）＝ <strong>${number(side?.adjustedAllowed)}</strong></p>${gamesTable(side,options)}</section>`;
}
function baseline(p,options) {
 const t=p?.calculationTrace;
 if (!t?.away || !t?.home) return `<h4>一、全場比分基準</h4>${noTrace}`;
 const a=esc(teamName(t.away.team,options)),h=esc(teamName(t.home.team,options));
 return `<h4>一、全場比分基準</h4><p>採用 ${esc(t.seasonYear-1)}–${esc(t.seasonYear)} 球季、以更新時的台灣日期往前推 30 個日期查詢 ESPN 賽程（不含當日查詢），採用其中已完賽例行賽比分；聯盟樣本 ${esc(t.leagueSamples)} 場，每隊至少需 3 場。聯盟每隊每場平均得分 <strong>${number(t.leagueAverage)}</strong>。</p><p>為什麼用這些數據：近期得失分反映球隊近期表現；加入相當於 ${esc(t.priorGames)} 場聯盟平均的權重，降低小樣本波動。這是模型假設，不代表最佳權重。</p>${teamBaseline(t.away,t.leagueAverage,t.priorGames,options)}${teamBaseline(t.home,t.leagueAverage,t.priorGames,options)}<section class="walkthrough-step"><h5>兩隊配對與主場</h5><p>${a}預估 ≈（${a}調整後得分 ${number(t.away.adjustedScored)} ＋ ${h}調整後失分 ${number(t.home.adjustedAllowed)}）÷ 2 − ${number(t.homeAdjustment)} ＝ <strong>${number(p.expectedAway,1)}</strong> 分。</p><p>${h}預估 ≈（${h}調整後得分 ${number(t.home.adjustedScored)} ＋ ${a}調整後失分 ${number(t.away.adjustedAllowed)}）÷ 2 ＋ ${number(t.homeAdjustment)} ＝ <strong>${number(p.expectedHome,1)}</strong> 分。</p><p>主客各加減 ${number(t.homeAdjustment)} 分是未校準的主場假設。上式顯示值經四捨五入，模型實際以完整精度計算後再顯示。</p></section><section class="walkthrough-step"><h5>模擬勝率</h5><p>以未四捨五入的預估分差，加上假設的常態波動（每隊標準差 ${number(t.teamScoreStdDev,0)} 分），模擬 ${Number(t.simulations).toLocaleString('zh-TW')} 次；主隊得分較高的比例為主隊勝率。此波動與主場假設尚未經獨立回測校準。</p></section><section class="walkthrough-step"><h5>近期比分資料來源與取得時間</h5>${historyLinks(p.historySources)}</section>`;
}
function injury(p,s,options) {
 const heading='<h4>二、傷病情境</h4>';
 if(!s) return heading+'<p>此場沒有保存傷病情境，無法展開計算。</p>';
 if(s.status!=='experimental') return heading+`<p>待確認：${esc(s.reason ?? '資料不足')}</p>${s.unresolved?.length?`<ul>${s.unresolved.map(x=>`<li>${esc(teamName(x.team,options))} · ${esc(x.player)}：${esc(options?.injuryNames?.[x.status] ?? x.status)} ${esc(x.detail ?? '')}</li>`).join('')}</ul>`:''}`;
 const t=s.calculationTrace;
 const playerRows=(s.players??[]).map(x=>`<tr><td>${esc(teamName(x.team,options))} · ${esc(x.player)}</td><td>${esc(x.games)} 場</td><td>${number(x.minutes,1)}</td><td>${number(x.points,1)}</td><td>${typeof x.rawPoints === 'number' && Number.isFinite(x.rawPoints) ? `≈ ${number(x.rawPoints,4)} × 25% ＝ ${number(x.adjustment)}` : `原始場均未保存；已存扣分 ${number(x.adjustment)}`}</td><td>${safeLink(x.source,'ESPN 球員紀錄')}（取得 ${esc(time(x.observedAt))}）${(x.injurySources??[]).map(y=>`<br>${safeLink(y.reference, options?.providerNames?.[y.provider] ?? y.provider)}（取得 ${esc(time(y.observedAt))}）`).join('')}</td></tr>`).join('');
 return heading+`<p>單獨在全場比分基準上，對來源一致標示缺陣、且近期有至少 3 場可核對紀錄的球員，假設其近期場均得分的 25% 為球隊得分損失，每隊最多扣 8 分。為什麼使用：用球員近期得分估計缺陣可能影響；25% 與上限只是未校準假設，不等於球員真實價值。</p>${playerRows?`<div class="walkthrough-scroll"><table><thead><tr><th>缺陣球員</th><th>樣本</th><th>場均分鐘</th><th>場均得分</th><th>假設損失</th><th>來源／取得時間（台灣時間）</th></tr></thead><tbody>${playerRows}</tbody></table></div>${(s.players??[]).map(x=>`<section class="walkthrough-step"><h5>${esc(x.player)}：場均得分計算樣本</h5>${Array.isArray(x.gameLog)?`<div class="walkthrough-scroll"><table><thead><tr><th>比賽</th><th>得分</th><th>上場分鐘（參考）</th></tr></thead><tbody>${x.gameLog.map(g=>`<tr><td>${safeLink(gameUrl(g.eventId),`比賽 ${g.eventId}`)}</td><td>${number(g.points,0)}</td><td>${number(g.minutes,1)}</td></tr>`).join('')}</tbody></table></div>`:'<p>這份存檔未保留逐場明細。</p>'}</section>`).join('')}`:'<p>來源沒有符合條件的缺陣球員；不代表全員健康。</p>'}${t?`<p>客隊：全場基準 ${number(p.expectedAway,1)} − 損失 ${number(t.awayDeduction)} ≈ <strong>${number(s.expectedAway,1)}</strong>；主隊：全場基準 ${number(p.expectedHome,1)} − 損失 ${number(t.homeDeduction)} ≈ <strong>${number(s.expectedHome,1)}</strong>。扣分以已四捨五入的全場基準計算，最低為 0；結果顯示時四捨五入至小數點後一位；再以相同的波動假設模擬 ${Number(t.simulations).toLocaleString('zh-TW')} 次。</p><p>表中場均得分為顯示值，球員損失先按完整場均得分計算並取至小數點後兩位，再加總及套用上限。上場分鐘只供參考，並未帶入扣分公式。若沒有符合條件的缺陣球員，勝率沿用基準。</p>`:noTrace}${s.unresolved?.length?`<p>下列球員尚未納入計算：</p><ul>${s.unresolved.map(x=>`<li>${esc(teamName(x.team,options))} · ${esc(x.player)}：${esc(options?.injuryNames?.[x.status] ?? x.status)} ${esc(x.detail ?? '')}</li>`).join('')}</ul>`:''}<p>未計防守、替代球員與完整輪替；近期比分可能已反映缺陣，存在重複扣分風險。多來源也可能共用上游。</p>`;
}
function quarter(p,options) {
 const q=p?.quarterPrediction,t=q?.calculationTrace,heading='<h4>三、四節比分</h4>';
 if(q?.status!=='experimental')return heading+`<p>待確認：${esc(q?.reason ?? '分節預測尚未保存或資料不足')}</p>`;
 if(!t?.away||!t?.home||!Array.isArray(t.periods))return heading+noTrace;
 const a=esc(teamName(t.away.team,options)),h=esc(teamName(t.home.team,options));
 return heading+`<p>使用同一球季、更新時台灣日期往前推 30 個查詢日期（不含當日查詢）內已完賽的逐節比分，每隊至少 3 場；每節各用相當於 ${esc(t.priorGames)} 場的該節聯盟平均調整，降低樣本波動。分節主場假設：主隊每節加 ${number(t.homeAdjustmentPerQuarter,4)}，客隊每節減相同分數。</p><div class="walkthrough-scroll"><table><thead><tr><th>節次</th><th>聯盟每隊平均</th><th>${a}原始得／失</th><th>${a}調整後得／失</th><th>${h}原始得／失</th><th>${h}調整後得／失</th><th>${a}預估</th><th>${h}預估</th></tr></thead><tbody>${t.periods.map((x,i)=>`<tr><td>第 ${esc(x.period)} 節</td><td>${number(x.leagueAverage)}</td><td>${number(x.away?.rawScored)} / ${number(x.away?.rawAllowed)}</td><td>${number(x.away?.adjustedScored)} / ${number(x.away?.adjustedAllowed)}</td><td>${number(x.home?.rawScored)} / ${number(x.home?.rawAllowed)}</td><td>${number(x.home?.adjustedScored)} / ${number(x.home?.adjustedAllowed)}</td><td>${number(q.quarters?.[i]?.away,1)}</td><td>${number(q.quarters?.[i]?.home,1)}</td></tr>`).join('')}</tbody></table></div><p>每節調整後得分／失分 ≈（球隊該節平均 × 球隊樣本場數 ＋ 聯盟該節平均 × ${esc(t.priorGames)}）÷（球隊樣本場數 ＋ ${esc(t.priorGames)}）。客隊該節預估＝（客隊調整後得分＋主隊調整後失分）÷ 2 − ${number(t.homeAdjustmentPerQuarter,4)}；主隊反向配對並加同樣分數，最低均為 0。</p><p>數值先計算再四捨五入；四節合計是各節顯示值相加，僅計正常時間。分節模型與全場模型獨立，未納傷病、先發與輪替。</p><section class="walkthrough-step"><h5>${a}分節樣本</h5>${gamesTable(t.away,options,true)}</section><section class="walkthrough-step"><h5>${h}分節樣本</h5>${gamesTable(t.home,options,true)}</section><section class="walkthrough-step"><h5>分節資料來源與取得時間</h5>${historyLinks(q.sources)}</section>`;
}
function scheduleSources(p, options) {
 const observations=p?.calculationTrace?.scheduleObservations;
 if(!Array.isArray(observations) || !observations.length) return '<h4>賽程核對來源</h4><p>這份預測未保存當時的賽程來源明細，無法以目前賽程還原。</p>';
 const labels={scheduled:'未開賽',live:'進行中',final:'已完賽',postponed:'延期',unknown:'未確認'};
 return `<h4>賽程核對來源</h4><p>以下為預測當時保存的賽程觀測，用來核對各來源有提供的對戰、時間及狀態；未提供的欄位如實標示。不同網站可能共用上游，不能直接視為完全獨立來源。</p><ul class="walkthrough-sources">${observations.map(o=>`<li>${safeLink(o.sourceUrl ?? o.reference,options?.providerNames?.[o.provider] ?? o.provider ?? '來源未提供')} <span>觀測 ${esc(time(o.observedAt))} · 開賽 ${esc(time(o.startAt))} · ${esc(labels[o.status] ?? o.status ?? '狀態未提供')}（台灣時間）</span></li>`).join('')}</ul><p>下方 ESPN 歷史比分來源用於計算球隊得失分，與賽程核對的用途不同。</p>`;
}
// Equations use recorded inputs and outputs; displayed intermediates are rounded.
const eq=(label,expr)=>`<div class="formula-line"><span>${label}</span><strong>${expr}</strong></div>`;
function baselineEquations(p,options){
 const t=p?.calculationTrace;
 if(!t?.away||!t?.home)return '<h4>① 全場比分公式</h4>'+(p?.model==='nba-recent-scores-baseline-v1'?eq('調整後得分','(球隊平均得分 × 場數 + 聯盟平均 × 8) ÷ (場數 + 8)')+eq('調整後失分','(球隊平均失分 × 場數 + 聯盟平均 × 8) ÷ (場數 + 8)')+eq('客隊預測','(客隊調整後得分 + 主隊調整後失分) ÷ 2 − 0.75')+eq('主隊預測','(主隊調整後得分 + 客隊調整後失分) ÷ 2 + 0.75')+eq('主隊勝率','主隊模擬獲勝次數 ÷ 10,000'): '')+noTrace;
 const a=esc(teamName(t.away.team,options)),h=esc(teamName(t.home.team,options)),prior=t.priorGames,league=t.leagueAverage;
 const smooth=(side,label)=>{const n=side.samples?.length;return ['Scored','Allowed'].map((key,i)=>eq(`${label}調整後${i?'失':'得'}分`,`(${number(n,0)} × ${number(side['raw'+key],4)} + ${number(prior,0)} × ${number(league,4)}) ÷ (${number(n,0)} + ${number(prior,0)}) ≈ ${number(side['adjusted'+key],4)}`)).join('');};
 const wins=Number.isFinite(p.homeWinProbability)&&Number.isFinite(t.simulations)?Math.round(p.homeWinProbability*t.simulations):null;
 return `<h4>① 全場比分公式</h4>${eq('聯盟平均得分',`${number(Math.round(league * 2 * t.leagueSamples),0)} ÷ (2 × ${number(t.leagueSamples,0)}) ≈ ${number(league,4)} 分`)}${smooth(t.away,a)}${smooth(t.home,h)}${eq(`${a}預測`, `(${number(t.away.adjustedScored,4)} + ${number(t.home.adjustedAllowed,4)}) ÷ 2 − ${number(t.homeAdjustment,2)} ≈ ${number(p.expectedAway,1)} 分`)}${eq(`${h}預測`, `(${number(t.home.adjustedScored,4)} + ${number(t.away.adjustedAllowed,4)}) ÷ 2 + ${number(t.homeAdjustment,2)} ≈ ${number(p.expectedHome,1)} 分`)}${eq(`${h}勝率（獲勝次數 ÷ 模擬次數）`, `${wins===null?'—':wins.toLocaleString('zh-TW')} ÷ ${number(t.simulations,0)} ≈ ${number(p.homeWinProbability*100,1)}%`)}${eq(`${a}勝率`, `1 − ${number(p.homeWinProbability,4)} ≈ ${number(p.awayWinProbability*100,1)}%`)}<div class="formula-hint">模擬分差 = ${number(t.home.expectedBeforeRounding,4)} − ${number(t.away.expectedBeforeRounding,4)} + ${number(t.teamScoreStdDev,0)} × √2 × Z；分差 &gt; 0 為主勝；Z 為標準常態隨機數。主場、波動及權重尚未校準；公式數值顯示為四捨五入。</div>`;
}
function injuryEquations(p,s,options){
 const title='<h4>② 傷病情境公式</h4>';
 if(!s)return title+'<p>此場未保存傷病情境。</p>';
 if(s.status!=='experimental')return title+`<p>待確認：${esc(s.reason??'資料不足')}</p>`;
 const t=s.calculationTrace;if(!t)return title+(s.model==='injury-scenario-v1'?eq('球員扣分','round(近期場均得分 × 25%, 2)')+eq('球隊扣分','min(8, 各球員扣分總和)')+eq('傷病預測','max(0, 全場基準 − 球隊扣分)'):'')+noTrace;
 const playerRows=(s.players??[]).map(x=>eq(`${esc(x.player)}扣分`,Number.isFinite(x.rawPoints)?`${number(x.rawPoints,4)} × 25% ≈ ${number(x.adjustment,2)}`:`原始場均未保存；已存扣分 ${number(x.adjustment,2)}`)).join('');
 const teamEq=(code,label,deduction,base,result)=>{const vals=(s.players??[]).filter(x=>x.team===code).map(x=>number(x.adjustment,2));return eq(`${label}扣分`,`min(8, ${vals.length?vals.join(' + '):'0'}) ≈ ${number(deduction,2)}`)+eq(`${label}傷病預測`,`max(0, ${number(base,1)} − ${number(deduction,2)}) ≈ ${number(result,1)} 分`);};
 return title+`${playerRows||'<p>未有符合條件的缺陣球員。</p>'}${teamEq(p.away,esc(teamName(p.away,options)),t.awayDeduction,p.expectedAway,s.expectedAway)}${teamEq(p.home,esc(teamName(p.home,options)),t.homeDeduction,p.expectedHome,s.expectedHome)}<div class="formula-hint">min：取較小值（最多扣 8 分）；max：取較大值（最低 0 分）；round：四捨五入。25% 與 8 分上限未校準；未含完整先發與替補。${s.unresolved?.length?`${esc(s.unresolved.length)} 位球員待確認。`:''}</div>`;
}
function quarterEquations(p,options){
 const q=p?.quarterPrediction,t=q?.calculationTrace,title='<h4>③ 四節比分公式</h4>';
 if(q?.status!=='experimental')return title+`<p>待確認：${esc(q?.reason??'資料不足')}</p>`;
 if(!t?.away||!t?.home||!Array.isArray(t.periods))return title+(q?.model==='nba-quarter-regulation-baseline-v1'?eq('每節調整','(該節平均 × 場數 + 聯盟該節平均 × 8) ÷ (場數 + 8)')+eq('每節客隊','max(0, (客隊調整後得分 + 主隊調整後失分) ÷ 2 − 0.1875)')+eq('每節主隊','max(0, (主隊調整後得分 + 客隊調整後失分) ÷ 2 + 0.1875)'):'')+noTrace;
 const a=esc(teamName(t.away.team,options)),h=esc(teamName(t.home.team,options));
 const rows=t.periods.map((x,i)=>{const nA=t.away.samples?.length,nH=t.home.samples?.length;const smooth=(who,key,n,label)=>eq(`${label}調整後${key==='Scored'?'得':'失'}`,`(${number(n,0)} × ${number(who['raw'+key],4)} + ${number(t.priorGames,0)} × ${number(x.leagueAverage,4)}) ÷ (${number(n,0)} + ${number(t.priorGames,0)}) ≈ ${number(who['adjusted'+key],4)}`);return `<section class="quarter-formulas"><h5>第 ${esc(x.period)} 節</h5>${smooth(x.away,'Scored',nA,a)}${smooth(x.away,'Allowed',nA,a)}${smooth(x.home,'Scored',nH,h)}${smooth(x.home,'Allowed',nH,h)}${eq(`${a}預測`,`max(0, (${number(x.away.adjustedScored,4)} + ${number(x.home.adjustedAllowed,4)}) ÷ 2 − ${number(t.homeAdjustmentPerQuarter,4)}) ≈ ${number(q.quarters?.[i]?.away,1)} 分`)}${eq(`${h}預測`,`max(0, (${number(x.home.adjustedScored,4)} + ${number(x.away.adjustedAllowed,4)}) ÷ 2 + ${number(t.homeAdjustmentPerQuarter,4)}) ≈ ${number(q.quarters?.[i]?.home,1)} 分`)}</section>`;}).join('');
 const total=(key,label)=>eq(`${label}四節合計`,`${q.quarters.map(x=>number(x[key],1)).join(' + ')} = ${number(key==='away'?q.regulationAway:q.regulationHome,1)} 分`);
 return title+rows+total('away',a)+total('home',h)+'<div class="formula-hint">四節為正常時間；分開計算，未納入傷病或延長賽。</div>';
}
export function predictionWalkthrough(p,s,options={}) {
 if(p?.status!=='experimental'||p?.league!=='NBA')return '';
 return `<section class="prediction-walkthrough"><h3>預測計算公式 / Prediction formulas</h3><div class="formula-hint">${esc(time(p.generatedAt))}（台灣時間） · 研究模型，尚未校準</div>${baselineEquations(p,options)}${injuryEquations(p,s,options)}${quarterEquations(p,options)}<details class="formula-sources"><summary>查看數據、原因與來源</summary>${scheduleSources(p,options)}${baseline(p,options)}${injury(p,s,options)}${quarter(p,options)}<p class="walkthrough-note">尚未納入完整球員強弱、先發、輪替、上場時間、對手賽程強度，也未接入 DPM、EPM 或 LEBRON。</p></details></section>`;
}
