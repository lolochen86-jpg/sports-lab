const endpoint = 'https://pyhmnoonmtxvwpcaxeyb.supabase.co/rest/v1/guest_comments';
const key = 'sb_publishable_TFFsK6pAF9mxlgdG6bUOcg_bO85CRJw';
const root = document.querySelector('#guest-community');
if (root) {
  root.innerHTML = `<h2>訪客留言 / Guest comments</h2><p>留下暱稱、信箱和留言。信箱不會公開，也不會寄送驗證信；信箱所有權未經驗證。</p><form><label>暱稱 / Name <input name="nickname" maxlength="30" required></label><label>信箱 / Email <input name="email" type="email" maxlength="254" required></label><label>留言 / Comment <textarea name="body" maxlength="500" required></textarea></label><button type="submit">送出留言 / Submit</button></form><p role="status" aria-live="polite"></p><div class="guest-list"></div>`;
  const form = root.querySelector('form');
  const status = root.querySelector('[role=status]');
  const list = root.querySelector('.guest-list');
  const headers = { apikey: key };
  async function refresh() {
    const response = await fetch(`${endpoint}?select=nickname,body,created_at&order=created_at.desc&limit=30`, {headers});
    if (!response.ok) throw new Error('無法讀取留言');
    const rows = await response.json();
    list.replaceChildren();
    for (const row of rows) {
      const article = document.createElement('article');
      const heading = document.createElement('strong');
      const time = document.createElement('time');
      const body = document.createElement('p');
      heading.textContent = row.nickname;
      time.dateTime = row.created_at;
      time.textContent = new Date(row.created_at).toLocaleString('zh-TW', {timeZone:'Asia/Taipei'});
      body.textContent = row.body;
      article.append(heading, document.createTextNode(' · '), time, body);
      list.append(article);
    }
    if (!rows.length) list.textContent = '目前還沒有留言。';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = new FormData(form);
    const payload = Object.fromEntries(['nickname','email','body'].map(k => [k, String(values.get(k) || '').trim()]));
    if (!payload.nickname || !payload.email || !payload.body) {status.textContent = '請填寫所有欄位。'; return;}
    const button = form.querySelector('button'); button.disabled = true;
    try {
      const response = await fetch(endpoint, {method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload)});
      if (!response.ok) throw new Error('送出失敗，請稍後重試。');
      form.reset(); status.textContent = '留言已送出。';
      try {await refresh();} catch {status.textContent = '留言已送出，但目前無法重新讀取留言。';}
    } catch (error) {status.textContent = error.message || '送出失敗，請稍後重試。';}
    finally {button.disabled = false;}
  });
  refresh().catch(() => {status.textContent = '目前無法讀取留言，請稍後再試。';});
}
