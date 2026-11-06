const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
const timestamp = x => Date.parse(x);

// Keep only an already-generated, identity-matched pregame estimate.
export function retainPregamePredictions(current, previous, now = Date.now()) {
  const today = day.format(new Date(now));
  const saved = new Map();
  const games = new Map((current.games ?? []).map(g => [g.id, g]));
  const candidates = [...(previous?.retainedPredictions ?? []), ...(previous?.researchPredictions ?? [])];
  for (const p of candidates) {
    const g = games.get(p.gameId), start = timestamp(p.startAt), generated = timestamp(p.generatedAt);
    if (!g || p.status !== 'experimental' || p.calibrated !== false || p.league !== 'NBA' ||
        p.league !== g.league || p.away !== g.away || p.home !== g.home || start !== timestamp(g.startAt) ||
        !Number.isFinite(start) || !Number.isFinite(generated) || generated >= start || start > now ||
        day.format(new Date(start)) !== today || !p.historyHash || !Number.isFinite(p.homeWinProbability) ||
        !Number.isFinite(p.awayWinProbability) || p.homeWinProbability < 0 || p.homeWinProbability > 1 ||
        Math.abs(p.homeWinProbability + p.awayWinProbability - 1) > 1e-8) continue;
    const prior = saved.get(p.gameId);
    const scenario = p.archivedScenario ?? ((previous?.researchPredictions ?? []).includes(p)
      ? (previous?.injuryScenarios ?? []).find(s => s.gameId === p.gameId) : null);
    const scenarioTime = timestamp(scenario?.generatedAt);
    const validExperimental = scenario?.status !== 'experimental' || (Number.isFinite(scenario.homeWinProbability) && Number.isFinite(scenario.awayWinProbability) && scenario.homeWinProbability >= 0 && scenario.homeWinProbability <= 1 && Math.abs(scenario.homeWinProbability + scenario.awayWinProbability - 1) <= 1e-8 && Array.isArray(scenario.players));
    const safeScenario = scenario && scenario.gameId === p.gameId && scenario.calibrated === false && Number.isFinite(scenarioTime) && scenarioTime >= generated && scenarioTime < start && validExperimental ? scenario : null;
    if (!prior || timestamp(prior.generatedAt) < generated) saved.set(p.gameId, {...p, archivedScenario: safeScenario});
  }
  return [...saved.values()];
}
