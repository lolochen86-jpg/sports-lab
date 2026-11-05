// The source is an archived mixed-class ranking, not a live rookie leaderboard.
export function filterRookies(rows, view = 'all') {
  const records = Array.isArray(rows) ? rows : [];
  if (view === 'rookie') return records.filter(row => row.class === '一年級');
  if (view === 'sophomore') return records.filter(row => row.class === '二年級');
  return records;
}
