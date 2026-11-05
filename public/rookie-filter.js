// ESPN roster experience values used by the existing site: 0 = rookie, 2 = sophomore.
export function buildRookieRoster(database, now = Date.now()) {
  const byId = new Map();
  for (const team of database?.teams ?? []) for (const player of team.players ?? []) {
    if (!player.id) continue;
    const id = String(player.id), entries = byId.get(id) ?? [];
    entries.push({ ...player, espnId: id, rosterSource: team.source, rosterObservedAt: team.observedAt,
      rosterStale: team.stale || !Number.isFinite(Date.parse(team.observedAt)) || now - Date.parse(team.observedAt) > 86400000 });
    byId.set(id, entries);
  }
  const rows = [], unresolved = [];
  for (const entries of byId.values()) {
    if (entries.length !== 1) { unresolved.push(entries[0]); continue; }
    const p = entries[0];
    if (p.experience === 0) rows.push({ ...p, yearClass: 'rookie' });
    else if (p.experience === 2) rows.push({ ...p, yearClass: 'sophomore' });
    else if (p.experience === null || p.experience === undefined || p.experience === 1) unresolved.push(p);
  }
  rows.sort((a,b) => a.name.localeCompare(b.name, 'en'));
  return { rows, unresolved };
}
export function filterRookies(rows, view = 'all') {
  const records = Array.isArray(rows) ? rows : [];
  if (view === 'rookie' || view === 'sophomore') return records.filter(row => row.yearClass === view);
  return records;
}
