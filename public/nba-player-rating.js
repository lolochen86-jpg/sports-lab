const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=v=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'未提供';
const pos={G:'後衛',F:'前鋒',C:'中鋒'};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sign=x=>`${x>0?'+':''}${x.toFixed(2)}`;
const gradeFor=p=>p>=90?'S':p>=75?'A':p>=50?'B':p>=25?'C':'D';

export function selectNbaRating(snapshot,id,team,position,now=Date.now()){
 if(!snapshot||!Array.isArray(snapshot.rows)||snapshot.stale||!['ok','partial'].includes(snapshot.status))return {reason:'評分資料目前不可用'};
 const sourceAt=Date.parse(snapshot.observedAt),builtAt=Date.parse(snapshot.generatedAt);
 if(!Number.isFinite(sourceAt)||!Number.isFinite(builtAt)||sourceAt>builtAt||builtAt>now||now-sourceAt>24*3600000)return {reason:'評分資料已過期或時間待核對'};
 const matches=snapshot.rows.filter(x=>String(x.id)===String(id));
 if(matches.length!==1)return {reason:matches.length?'球員身分重複，等待核對':'沒有球員評分資料'};
 const x=matches[0];if(x.team!==team||x.position!==position)return {reason:'球隊或位置不一致，等待核對'};
 if(x.status!=='rated')return {reason:x.reason||'球季樣本不足'};
 if(!['G','F','C'].includes(x.position)||!Number.isInteger(x.peerCount)||x.peerCount<10||!Number.isInteger(x.games)||x.games<5||!finite(x.minutes)||x.minutes<60||!finite(x.impact)||!finite(x.offense)||!finite(x.defense)||Math.abs(x.impact-x.offense-x.defense)>1e-5||!finite(x.percentile)||x.percentile<0||x.percentile>100||x.grade!==gradeFor(x.percentile))return {reason:'球員評分數據尚未通過核對'};
 return {rating:x};
}
export function nbaRatingBadge(snapshot,id,team,position,now=Date.now()){
 const {rating:r}=selectNbaRating(snapshot,id,team,position,now);
 return r?`<p class="roster-status"><strong>表現等級 ${esc(r.grade)}</strong> · 在場影響 ${sign(r.impact)} / 100 回合</p>`:'<p class="roster-status">表現等級：待評</p>';
}
export function nbaRatingPanel(snapshot,id,team,position,now=Date.now()){
 const {rating:r,reason}=selectNbaRating(snapshot,id,team,position,now);
 if(!r)return `<section class="content-section"><h2>球員表現等級 / Player performance</h2><p>待評：${esc(reason)}</p><p class="fine-print">至少 5 場、60 分鐘，並確認名單、位置及球員身分，才與同位置比較。</p></section>`;
 const source='https://hoopr.sportsdataverse.org/articles/nba-player-impact-model.html';
 return `<section class="content-section"><h2>球員表現等級 / Player performance</h2><div class="team-stat-grid"><article><span>同位置等級 / Grade</span><strong>${esc(r.grade)}</strong></article><article><span>在場影響 / adj-RAPM</span><strong>${sign(r.impact)}</strong><small>每 100 回合</small></article><article><span>進攻影響 / Offense</span><strong>${sign(r.offense)}</strong></article><article><span>防守影響 / Defense</span><strong>${sign(r.defense)}</strong></article><article><span>${esc(pos[r.position])}百分位 / Percentile</span><strong>${r.percentile.toFixed(1)}</strong><small>比較 ${r.peerCount} 人</small></article><article><span>出賽 / Minutes</span><strong>${r.games} 場</strong><small>${r.minutes.toFixed(0)} 分鐘</small></article></div><details><summary>查看評分公式與等級標準</summary><p>在場影響 = 進攻影響 + 防守影響 = ${sign(r.offense)} + (${sign(r.defense)}) = ${sign(r.impact)}，單位：每 100 回合球隊淨得分影響估計。</p><p>本站以能核對 ESPN 名單及評分來源的當季球員為比較樣本，依名單主位置 G 後衛、F 前鋒、C 中鋒分組；資料缺失者不在比較母體，結果不代表全聯盟。合格球員依同位置 adj-RAPM 百分位分級：S ≥90、A ≥75、B ≥50、C ≥25、D &lt;25；並列取同一平均位置。至少 5 場及 60 分鐘，該組至少 10 人。這是本站相對分級，並非 NBA、ESPN 或 2K 官方評分。</p><p><a href="${source}" target="_blank" rel="noopener noreferrer">SportsDataverse 評分方法 ↗</a> · ${esc(snapshot.season-1)}–${esc(String(snapshot.season).slice(-2))} 例行賽 · 資料取得 ${esc(when(snapshot.observedAt))}（台灣時間）</p></details><p class="fine-print">影響值是依在場表現與模型先驗估計，不是球員全面能力或預測。賽季初、少量出賽、隊友與對手組合都可能造成波動。</p></section>`;
}
