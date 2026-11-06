const taipeiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function taipeiDay(time) {
  const value = new Date(time);
  return Number.isFinite(value.getTime()) ? taipeiDate.format(value) : null;
}

export function nextTaipeiMidnight(now) {
  const dayMs = 24 * 60 * 60 * 1000;
  const offsetMs = 8 * 60 * 60 * 1000;
  return (Math.floor((now + offsetMs) / dayMs) + 1) * dayMs - offsetMs;
}

export function todayPredictions(rows, league, now) {
  const today = taipeiDay(now);
  if (!today) return [];
  return rows.filter(p => p.league === league && Date.parse(p.startAt) > now && taipeiDay(p.startAt) === today)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
