const states = [
  ['final', '已完賽'],
  ['live', '進行中'],
  ['scheduled', '未開賽'],
  ['other', '待核對／延期'],
];

export function homeGameStatus(games, league, date) {
  const counts = new Map(states.map(([key]) => [key, 0]));
  for (const game of games) {
    const key = counts.has(game.status) ? game.status : 'other';
    counts.set(key, counts.get(key) + 1);
  }
  const rows = states.filter(([key]) => key !== 'other' || counts.get(key));
  const formattedDate = /^\d{4}-\d\d-\d\d$/.test(date) ? date.slice(5).replace('-', '/') : '日期待確認';
  const leagueLabel = league === 'MLB' ? 'MLB' : 'NBA';
  const chart = games.length ? `<div class="home-status-bar" aria-hidden="true">${rows.map(([key]) => {
    const count = counts.get(key);
    return count ? `<span class="home-status-${key}" style="width:${100 * count / games.length}%"></span>` : '';
  }).join('')}</div>` : '';
  return `<p class="home-status-date">${leagueLabel} · ${formattedDate} · ${games.length} 場</p>
    ${chart}
    <dl class="home-status-grid">${rows.map(([key, label]) => `<div><dt><i class="home-status-${key}" aria-hidden="true"></i>${label}</dt>
    <dd>${counts.get(key)}</dd></div>`).join('')}</dl>`;
}
