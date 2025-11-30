const { leagues, championsLeagueReplacementOrder } = require("./config");
const { fetchFlashscoreMatches } = require("./flashscore");
const { fetchChampionsLeagueMatches } = require("./championsLeague");
const { fetchRfenResults } = require("./rfen");
const { fetchFlashscoreHeadToHeadScores } = require("./flashscoreHeadToHead");
const {
  buildHeadToHeadIndex,
  buildTableStats,
  getHeadToHeadScore,
  getTableGap,
} = require("./headToHead");
const { getWindowBounds, isWithinWindow } = require("./dateUtils");
const { matchTeamNameSync, fetchTeamMap } = require("./teamMatcher");

const USE_RFEN_RESULTS = process.env.SCRAPER_USE_RFEN === "true";

async function fetchAndSelectMatches() {
  const { start, end } = getWindowBounds();

  const completedResultsPromise = USE_RFEN_RESULTS
    ? fetchRfenResults().catch((err) => {
        console.error("RFEN results fetch failed:", err.message);
        return [];
      })
    : Promise.resolve([]);

  const [domesticMatches, championsMatchesRaw, completedResults] =
    await Promise.all([
      fetchFlashscoreMatches().catch((err) => {
        console.error("Flashscore fetch failed:", err.message);
        return [];
      }),
      fetchChampionsLeagueMatches().catch((err) => {
        console.error("Champions League fetch failed:", err.message);
        return [];
      }),
      completedResultsPromise,
    ]);

  const championsMatches = assignChampionReplacements(championsMatchesRaw);
  const allMatches = [...domesticMatches, ...championsMatches];

  const flashscoreIds = allMatches
    .filter(
      (match) =>
        match.flashscoreId && isWithinWindow(match.startTime, start, end)
    )
    .map((match) => match.flashscoreId);
  const flashscoreH2hScores = await fetchFlashscoreHeadToHeadScores(
    flashscoreIds
  );

  const headToHeadIndex = buildHeadToHeadIndex(completedResults);
  const tableStats = buildTableStats(completedResults);

  const matchesInWindow = allMatches
    .filter((match) => isWithinWindow(match.startTime, start, end))
    .map((match, index) => {
      const closeness = computeClosenessScore(
        match,
        headToHeadIndex,
        tableStats,
        flashscoreH2hScores
      );
      return {
        ...match,
        matchId: buildMatchId(match, index),
        isChampionsLeague: Boolean(match.isChampionsLeague),
        closeness,
        difficulty: classifyDifficulty(closeness),
      };
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

  await fetchTeamMap();
  const normalizedMatches = matchesInWindow.map((match) => {
    const isChampionsLeague =
      match.isChampionsLeague ||
      match.leagueId === "CL" ||
      match.leagueId === "CLF";
    return {
      ...match,
      homeTeam: matchTeamNameSync(match.homeTeam, isChampionsLeague),
      awayTeam: matchTeamNameSync(match.awayTeam, isChampionsLeague),
    };
  });

  const quotas = computeAdjustedQuotas(normalizedMatches);
  const presets = buildPresetSelections(normalizedMatches, quotas);
  const legacySelection = buildLegacySelection(normalizedMatches, presets);

  return {
    matches: normalizedMatches,
    presets,
    quotas,
    legacySelection,
  };
}

function assignChampionReplacements(matches) {
  const ordered = [...matches].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );

  ordered.forEach((match, index) => {
    match.replacementLeagueId = championsLeagueReplacementOrder[index] ?? null;
    // Preserve leagueId (CL for Men, CLF for Women) instead of overwriting
    if (!match.leagueId) {
      match.leagueId = "CL";
    }
    // Preserve leagueName if already set, otherwise set default
    if (!match.leagueName) {
      match.leagueName =
        match.leagueId === "CLF"
          ? "Champions League (Women)"
          : "Champions League";
    }
    match.isChampionsLeague = true;
  });

  return ordered;
}

function computeAdjustedQuotas(matches) {
  const quotas = {};
  leagues.forEach((league) => {
    quotas[league.id] = league.quota;
  });

  const champions = matches.filter((match) => match.isChampionsLeague);
  let championsQuota = 0;
  let championsWomenQuota = 0;
  champions.forEach((match, index) => {
    const replacementId = championsLeagueReplacementOrder[index];
    if (replacementId && quotas[replacementId] > 0) {
      quotas[replacementId] -= 1;
      match.replacementLeagueId = replacementId;
      if (match.leagueId === "CLF") {
        championsWomenQuota += 1;
      } else {
        championsQuota += 1;
      }
    }
  });

  if (championsQuota > 0) {
    quotas.CL = championsQuota;
  }
  if (championsWomenQuota > 0) {
    quotas.CLF = championsWomenQuota;
  }

  return quotas;
}

function computeClosenessScore(
  match,
  headToHeadIndex,
  tableStats,
  flashscoreH2hScores
) {
  if (match.flashscoreId) {
    const feedScore = flashscoreH2hScores.get(match.flashscoreId);
    if (feedScore !== undefined) {
      return feedScore;
    }
  }
  const h2hScore = getHeadToHeadScore(
    headToHeadIndex,
    match.leagueId,
    match.homeTeam,
    match.awayTeam
  );
  if (h2hScore !== undefined) {
    return h2hScore;
  }
  const tableGap = getTableGap(
    tableStats,
    match.leagueId,
    match.homeTeam,
    match.awayTeam
  );
  if (tableGap !== undefined) {
    return tableGap;
  }
  return Number.POSITIVE_INFINITY;
}

function classifyDifficulty(closeness) {
  if (!Number.isFinite(closeness)) {
    return "unknown";
  }
  if (closeness <= 2) {
    return "hard";
  }
  if (closeness <= 3.5) {
    return "moderate";
  }
  return "easy";
}

function buildMatchId(match, index) {
  if (match.flashscoreId) {
    return match.flashscoreId;
  }
  return `${match.leagueId}-${match.homeTeam}-${match.awayTeam}-${match.startTime}-${index}`;
}

function buildPresetSelections(matches, quotas) {
  const matchesByLeague = groupMatchesByLeague(matches);
  return {
    easy: selectForStrategy(matchesByLeague, quotas, "easy"),
    moderate: selectForStrategy(matchesByLeague, quotas, "moderate"),
    hard: selectForStrategy(matchesByLeague, quotas, "hard"),
  };
}

function groupMatchesByLeague(matches) {
  const map = new Map();
  matches.forEach((match) => {
    const list = map.get(match.leagueId) ?? [];
    if (!map.has(match.leagueId)) {
      map.set(match.leagueId, list);
    }
    list.push(match);
  });
  return map;
}

function selectForStrategy(matchesByLeague, quotas, strategy) {
  const selection = [];
  Object.entries(quotas).forEach(([leagueId, quota]) => {
    if (quota <= 0) return;
    const leagueMatches = matchesByLeague.get(leagueId) ?? [];
    if (!leagueMatches.length) return;
    const picks = pickMatchesForLeague(leagueMatches, quota, strategy);
    picks.forEach((match) => {
      if (!selection.includes(match.matchId)) {
        selection.push(match.matchId);
      }
    });
  });
  return selection.slice(0, 15);
}

function pickMatchesForLeague(matches, quota, strategy) {
  const sortedAsc = [...matches].sort((a, b) => a.closeness - b.closeness);

  if (strategy === "hard") {
    return sortedAsc.slice(0, Math.min(quota, sortedAsc.length));
  }

  if (strategy === "easy") {
    return sortedAsc.slice(-Math.min(quota, sortedAsc.length)).reverse();
  }

  // Moderate: mix of hard and easy
  const { hardCount, easyCount } = splitQuota(quota);
  const hardPicks = sortedAsc.slice(0, Math.min(hardCount, sortedAsc.length));
  const remaining = sortedAsc.filter((match) => !hardPicks.includes(match));
  const easyPicks = remaining
    .sort((a, b) => b.closeness - a.closeness)
    .slice(0, Math.min(easyCount, remaining.length));
  return [...hardPicks, ...easyPicks];
}

function splitQuota(quota) {
  if (quota <= 1) {
    return { hardCount: quota, easyCount: 0 };
  }
  const hardCount = Math.max(1, Math.floor(quota * 0.7));
  const easyCount = Math.max(0, quota - hardCount);
  return { hardCount, easyCount };
}

function buildLegacySelection(matches, presets) {
  const matchMap = new Map(matches.map((match) => [match.matchId, match]));
  const moderateIds = presets.moderate ?? [];
  const fromModerate = moderateIds
    .map((id) => matchMap.get(id))
    .filter(Boolean);
  if (fromModerate.length >= 15) {
    return fromModerate.slice(0, 15);
  }
  const fallback = matches.slice(0, 15);
  return fromModerate
    .concat(fallback.filter((match) => !fromModerate.includes(match)))
    .slice(0, 15);
}

module.exports = { fetchAndSelectMatches };
