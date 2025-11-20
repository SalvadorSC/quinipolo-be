const { normalizeTeamName } = require("./teamNames");

const DEFAULT_POINTS = 0;

function buildHeadToHeadIndex(matches) {
  const matchesByPair = new Map();

  matches.forEach((match) => {
    const key = makePairKey(match.leagueId, match.homeTeam, match.awayTeam);
    if (!key) return;
    if (!matchesByPair.has(key)) {
      matchesByPair.set(key, []);
    }
    matchesByPair.get(key).push(match);
  });

  return { matchesByPair };
}

function buildTableStats(matches) {
  const pointsByLeague = new Map();

  matches.forEach((match) => {
    const leagueStats =
      pointsByLeague.get(match.leagueId) ?? new Map();
    if (!pointsByLeague.has(match.leagueId)) {
      pointsByLeague.set(match.leagueId, leagueStats);
    }

    const homeKey = normalizeTeamName(match.homeTeam);
    const awayKey = normalizeTeamName(match.awayTeam);
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;

    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return;
    }

    if (homeScore > awayScore) {
      leagueStats.set(homeKey, (leagueStats.get(homeKey) ?? DEFAULT_POINTS) + 3);
      leagueStats.set(awayKey, leagueStats.get(awayKey) ?? DEFAULT_POINTS);
    } else if (homeScore < awayScore) {
      leagueStats.set(homeKey, leagueStats.get(homeKey) ?? DEFAULT_POINTS);
      leagueStats.set(awayKey, (leagueStats.get(awayKey) ?? DEFAULT_POINTS) + 3);
    } else {
      leagueStats.set(homeKey, (leagueStats.get(homeKey) ?? DEFAULT_POINTS) + 1);
      leagueStats.set(awayKey, (leagueStats.get(awayKey) ?? DEFAULT_POINTS) + 1);
    }
  });

  return { pointsByLeague };
}

function getHeadToHeadScore(index, leagueId, homeTeam, awayTeam) {
  const key = makePairKey(leagueId, homeTeam, awayTeam);
  if (!key) return undefined;
  const matches = index.matchesByPair.get(key);
  if (!matches || matches.length === 0) return undefined;

  const diffs = matches
    .map((match) => Math.abs(match.homeScore - match.awayScore))
    .filter((diff) => Number.isFinite(diff));

  if (diffs.length === 0) return undefined;
  const average = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
  return average;
}

function getTableGap(stats, leagueId, homeTeam, awayTeam) {
  const leagueStats = stats.pointsByLeague.get(leagueId);
  if (!leagueStats) return undefined;
  const homeKey = normalizeTeamName(homeTeam);
  const awayKey = normalizeTeamName(awayTeam);
  const homePoints = leagueStats.get(homeKey);
  const awayPoints = leagueStats.get(awayKey);
  if (homePoints === undefined || awayPoints === undefined) return undefined;
  return Math.abs(homePoints - awayPoints);
}

function makePairKey(leagueId, homeTeam, awayTeam) {
  if (!homeTeam || !awayTeam) return null;
  const normalizedHome = normalizeTeamName(homeTeam);
  const normalizedAway = normalizeTeamName(awayTeam);
  if (!normalizedHome || !normalizedAway) return null;
  const [first, second] = [normalizedHome, normalizedAway].sort();
  return `${leagueId}:${first}|${second}`;
}

module.exports = {
  buildHeadToHeadIndex,
  buildTableStats,
  getHeadToHeadScore,
  getTableGap,
};



