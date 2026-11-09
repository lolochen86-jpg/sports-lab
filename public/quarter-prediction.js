const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function quarterPredictionCard(prediction, away, home) {
  const q = prediction?.quarterPrediction;
  if (!q || q.status !== 'experimental' || !Array.isArray(q.quarters) || q.quarters.length !== 4 || q.quarters.some((x,i)=>x.period!==i+1||!Number.isFinite(x.away)||!Number.isFinite(x.home)) || !Number.isFinite(q.regulationAway) || !Number.isFinite(q.regulationHome)) {
    const message = q?.reason || (prediction?.archivedPregame ? '當時沒有保存分節預測，不事後補算。' : '分節資料不足，等待更新。');
    return `<section class="quarter-card"><h3>每節預測 / Quarter predictions</h3><p>${esc(message)}</p></section>`;
  }
  const n = v => v.toFixed(1);
  return `<section class="quarter-card"><h3>每節預測 / Quarter predictions</h3><div class="quarter-scroll"><table><thead><tr><th>球隊</th>${q.quarters.map(x=>`<th>第 ${x.period} 節</th>`).join('')}<th>四節合計</th></tr></thead><tbody><tr><th>${esc(away)}</th>${q.quarters.map(x=>`<td>${n(x.away)}</td>`).join('')}<td><strong>${n(q.regulationAway)}</strong></td></tr><tr><th>${esc(home)}</th>${q.quarters.map(x=>`<td>${n(x.home)}</td>`).join('')}<td><strong>${n(q.regulationHome)}</strong></td></tr></tbody></table></div><p>近 30 日例行賽分節資料：客 ${esc(q.awaySamples)} 場、主 ${esc(q.homeSamples)} 場。四節合計為正常時間估計，與上方全場模型分開計算，未含延長賽、傷病或先發；研究模型未經回測校準。</p><details><summary>計算方法與資料來源</summary><p>${(q.limitations??[]).map(esc).join('；')}</p>${(q.sources??[]).map(x=>{try{const u=new URL(x.url);return u.protocol==='https:'?`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(x.day)} ↗</a>`:'';}catch{return '';}}).join(' · ')}</details></section>`;
}

