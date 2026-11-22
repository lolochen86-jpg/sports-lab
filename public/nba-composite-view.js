export const components = [
  ['impact', '在場影響 adj-RAPM', 40],
  ['bpm', '數據表現 BPM', 40],
  ['war', '累積貢獻 WAR', 20],
];

export function priorRanking(board, id) {
  const prior = board.history?.findLast(record => record.date < board.date);
  return prior?.values[id] ? {date: prior.date, rank: prior.values[id][0]} : null;
}

export function movement(board, row) {
  const previous = priorRanking(board, row.id);
  if (!previous) return '待比較';
  const change = previous.rank - row.rank;
  return change > 0 ? `↑ ${change} 名` : change < 0 ? `↓ ${-change} 名` : '— 持平';
}

export function compositeCurrent(board, now = Date.now()) {
  const observed = Date.parse(board?.observedAt);
  return board?.status === 'available' && observed <= now && now - observed < 86400000;
}
