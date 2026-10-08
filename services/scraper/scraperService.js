const {
  leagues,
  championsLeagueReplacementOrder,
  maxClfFill,
} = require("./config");
const { fetchFlashscoreMatches } = require("./flashscore");
const { fetchChampionsLeagueMatches } = require("./championsLeague");
const { fetchLeveradeMatches } = require("./leverade");
const { fetchRfenResults } = require("./rfen");
const { fetchFlashscoreHeadToHeadScores } = require("./flashscoreHeadToHead");
const {
  buildHeadToHeadIndex,
  buildTableStats,
  getHeadToHeadScore,
  getTableGap,
} = require("./headToHead");
const {
  getWindowBounds,
  isWithinWindow,
  filterMatchesWithinWindow,
} = require("./dateUtils");
const { matchTeamNameSync, fetchTeamMap } = require("./teamMatcher");
const { normalizeTeamName } = require("./teamNames");

const USE_RFEN_RESULTS = process.env.SCRAPER_USE_RFEN === "true";
const WOMEN_LEAGUES = new Set(["DHF", "PDF", "CLF"]);

async function fetchAndSelectMatches() {
  const { start, end } = getWindowBounds();

  const completedResultsPromise = USE_RFEN_RESULTS
    ? fetchRfenResults().catch((err) => {
        console.error("RFEN results fetch failed:", err.message);
        return [];
      })
    : Promise.resolve([]);

  const [flashscoreMatches, championsMatchesRaw, leveradeMatches, completedResults] =
    await Promise.all([
      fetchFlashscoreMatches().catch((err) => {
        console.error("Flashscore fetch failed:", err.message);
        return [];
      }),
      fetchChampionsLeagueMatches().catch((err) => {
        console.error("Champions League fetch failed:", err.message);
        return [];
      }),
      fetchLeveradeMatches(start, end).catch((err) => {
        console.error("Leverade fetch failed:", err.message);
        return [];
      }),
      completedResultsPromise,
    ]);

  // Supplement using only fixtures inside the window. Flashscore's season
  // pages still list 2025/26 games, so a raw count would hide the empty
  // 2026/27 leagues.
  const domesticMatches = supplementDomesticMatches(
    filterMatchesWithinWindow(flashscoreMatches, start, end),
    filterMatchesWithinWindow(leveradeMatches, start, end)
  );
  warnEmptyLeagues(domesticMatches);

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

  logWindowCounts(matchesInWindow);

  await fetchTeamMap();
  const normalizedMatches = matchesInWindow.map((match) => {
    const isChampionsLeague =
      match.isChampionsLeague ||
      match.leagueId === "CL" ||
      match.leagueId === "CLF";
    return {
      ...match,
      homeTeam: matchStoredName(match.homeTeam, match, isChampionsLeague),
      awayTeam: matchStoredName(match.awayTeam, match, isChampionsLeague),
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

/**
 * When Flashscore has fewer in-window matches than a league's quota, add
 * Leverade fixtures that are not the same game. Leagues already at quota
 * keep the Flashscore rows so head-to-head difficulty still applies.
 */
function supplementDomesticMatches(primaryMatches, backupMatches) {
  const result = [...primaryMatches];

  leagues.forEach((league) => {
    const primary = primaryMatches.filter((match) => match.leagueId === league.id);
    if (primary.length >= league.quota) return;

    const backups = backupMatches.filter((match) => match.leagueId === league.id);
    let added = 0;
    backups.forEach((match) => {
      const duplicate = result.some(
        (existing) =>
          existing.leagueId === league.id && isSameFixture(existing, match)
      );
      if (duplicate) return;
      result.push(match);
      added += 1;
    });

    if (added > 0) {
      console.log(
        `Leverade filled ${added} ${league.id} match${
          added === 1 ? "" : "es"
        } (${primary.length} already came from Flashscore).`
      );
    }
  });

  return result;
}

function warnEmptyLeagues(matches) {
  leagues.forEach((league) => {
    const count = matches.filter((match) => match.leagueId === league.id).length;
    if (count === 0) {
      console.warn(
        `No ${league.id} matches (${league.name}) in the auto-fill window after Flashscore and Leverade.`
      );
    }
  });
}

function logWindowCounts(matches) {
  const counts = {};
  matches.forEach((match) => {
    counts[match.leagueId] = (counts[match.leagueId] || 0) + 1;
  });
  const summary = Object.entries(counts)
    .map(([leagueId, count]) => `${leagueId}=${count}`)
    .join(" ");
  console.log(`Auto-fill matches in window: ${summary || "none"}`);
}

function isSameFixture(a, b) {
  if (!a || !b || a.leagueId !== b.leagueId) return false;
  if (madridDateKey(a.startTime) !== madridDateKey(b.startTime)) return false;
  const sameOrder =
    teamsLooselyEqual(a.homeTeam, b.homeTeam) &&
    teamsLooselyEqual(a.awayTeam, b.awayTeam);
  const swapped =
    teamsLooselyEqual(a.homeTeam, b.awayTeam) &&
    teamsLooselyEqual(a.awayTeam, b.homeTeam);
  return sameOrder || swapped;
}

function teamsLooselyEqual(a, b) {
  const left = normalizeTeamName(a);
  const right = normalizeTeamName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 5 && longer.includes(shorter);
}

function madridDateKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function assignChampionReplacements(matches) {
  const ordered = [...matches].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );

  ordered.forEach((match) => {
    if (!match.leagueId) {
      match.leagueId = "CL";
    }
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

  const domesticCounts = {};
  leagues.forEach((league) => {
    domesticCounts[league.id] = matches.filter(
      (match) => match.leagueId === league.id && !match.isChampionsLeague
    ).length;
  });

  // Only the shortfall of DHM/DHF/SDM can be given to Champions League.
  // A league that already has its fixtures keeps them.
  const slots = [];
  championsLeagueReplacementOrder.forEach((leagueId) => {
    const shortfall = Math.max(
      0,
      (quotas[leagueId] || 0) - (domesticCounts[leagueId] || 0)
    );
    for (let i = 0; i < shortfall; i += 1) slots.push(leagueId);
  });

  const champions = matches
    .filter((match) => match.isChampionsLeague)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  champions.forEach((match) => {
    match.replacementLeagueId = null;
  });

  const men = champions.filter((match) => match.leagueId !== "CLF");
  const women = champions.filter((match) => match.leagueId === "CLF");

  let championsQuota = 0;
  let championsWomenQuota = 0;
  let slotIndex = 0;

  const takeSlot = (match) => {
    if (slotIndex >= slots.length) return false;
    if (match.leagueId === "CLF" && championsWomenQuota >= maxClfFill) {
      return false;
    }
    const replacementId = slots[slotIndex];
    if (!replacementId || !(quotas[replacementId] > 0)) return false;
    quotas[replacementId] -= 1;
    match.replacementLeagueId = replacementId;
    slotIndex += 1;
    if (match.leagueId === "CLF") {
      championsWomenQuota += 1;
    } else {
      championsQuota += 1;
    }
    return true;
  };

  men.forEach((match) => takeSlot(match));
  women.forEach((match) => takeSlot(match));

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
  if (match.leveradeId) {
    return `lev-${match.leveradeId}`;
  }
  return `${match.leagueId}-${match.homeTeam}-${match.awayTeam}-${match.startTime}-${index}`;
}

function teamQueryName(name, match) {
  if (!name) return name;
  if (
    match.source === "leverade" &&
    WOMEN_LEAGUES.has(match.leagueId) &&
    !/\sF$/i.test(name)
  ) {
    return `${name} F`;
  }
  return name;
}

function matchStoredName(name, match, isChampionsLeague) {
  const query = teamQueryName(name, match);
  const matched = matchTeamNameSync(query, isChampionsLeague);
  if (query !== name && matched === query) return name;
  return matched;
}

function buildPresetSelections(matches, quotas) {
  const matchesByLeague = groupMatchesByLeague(matches);
  const easy = selectForStrategy(matchesByLeague, quotas, "easy", matches);
  const moderate = selectForStrategy(matchesByLeague, quotas, "moderate", matches);
  const hard = selectForStrategy(matchesByLeague, quotas, "hard", matches);
  return { easy, moderate, hard };
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

function selectForStrategy(matchesByLeague, quotas, strategy, allMatches) {
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
  if (selection.length < 15 && allMatches) {
    const remaining = allMatches.filter(
      (match) => !selection.includes(match.matchId)
    );
    const domestic = remaining.filter((match) => !match.isChampionsLeague);
    const clMen = remaining.filter(
      (match) => match.isChampionsLeague && match.leagueId !== "CLF"
    );
    const clf = remaining.filter((match) => match.leagueId === "CLF");
    const ordered = [
      ...sortBackfill(domestic, strategy),
      ...sortBackfill(clMen, strategy),
      ...sortBackfill(clf, strategy),
    ];
    ordered.forEach((match) => {
      if (selection.length >= 15) return;
      if (
        match.leagueId === "CLF" &&
        countSelected(selection, "CLF", allMatches) >= maxClfFill
      ) {
        return;
      }
      selection.push(match.matchId);
    });
  }
  return selection.slice(0, 15);
}

function sortBackfill(matches, strategy) {
  const copy = [...matches];
  if (strategy === "easy") {
    copy.sort((a, b) => b.closeness - a.closeness);
  } else {
    copy.sort((a, b) => a.closeness - b.closeness);
  }
  return copy;
}

function countSelected(ids, leagueId, matches) {
  const selected = new Set(ids);
  return matches.filter(
    (match) => selected.has(match.matchId) && match.leagueId === leagueId
  ).length;
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

module.exports = {
  fetchAndSelectMatches,
  supplementDomesticMatches,
  computeAdjustedQuotas,
  buildPresetSelections,
  warnEmptyLeagues,
  isSameFixture,
  teamQueryName,
};
