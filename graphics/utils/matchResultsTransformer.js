/**
 * Transforms correction-see (quinipolo + correct_answers) into matchesByLeague format.
 * Splits into two parts: first 7 matches (image1), remaining 8 (image2).
 */

const LEAGUE_NAMES = {
  DHM: "División de Honor Masculina",
  DHF: "División de Honor Femenina",
  PDM: "Primera División Masculina",
  PDF: "Primera División Femenina",
  SDM: "Segunda División Masculina",
  CL: "Champions League",
  CLF: "Liga de Campeones Femenina",
  PLENO_15: "PLENO AL 15",
};
const PLENO_15_SUB_LABEL = "PDM";

const IMAGE1_MATCH_COUNT = 7;
const IMAGE2_MATCH_COUNT = 8;

function buildMatchFromItem(item, answer, matchNumber) {
  const cancelled = answer?.cancelled;
  const isGame15 = item?.isGame15 || matchNumber === 15;
  const hasExact = isGame15 && answer?.goalsHomeTeamExact != null && answer?.goalsAwayTeamExact != null
    && answer.goalsHomeTeamExact !== "" && answer.goalsAwayTeamExact !== "";
  const homeScore = cancelled ? null : (hasExact
    ? parseInt(String(answer.goalsHomeTeamExact), 10)
    : (answer?.goalsHomeTeam ? parseInt(answer.goalsHomeTeam, 10) : null));
  const awayScore = cancelled ? null : (hasExact
    ? parseInt(String(answer.goalsAwayTeamExact), 10)
    : (answer?.goalsAwayTeam ? parseInt(answer.goalsAwayTeam, 10) : null));
  const regularHome = answer?.regularGoalsHomeTeam != null ? parseInt(String(answer.regularGoalsHomeTeam), 10) : null;
  const regularAway = answer?.regularGoalsAwayTeam != null ? parseInt(String(answer.regularGoalsAwayTeam), 10) : null;
  const hasTie =
    !cancelled &&
    !isNaN(regularHome) &&
    !isNaN(regularAway) &&
    regularHome === regularAway &&
    !isNaN(homeScore) &&
    !isNaN(awayScore) &&
    (homeScore !== regularHome || awayScore !== regularAway);

  return {
    matchNumber,
    homeTeam: item.homeTeam,
    awayTeam: item.awayTeam,
    homeScore: isNaN(homeScore) ? null : homeScore,
    awayScore: isNaN(awayScore) ? null : awayScore,
    regularGoalsHomeTeam: hasTie ? regularHome : null,
    regularGoalsAwayTeam: hasTie ? regularAway : null,
    status: cancelled ? "postponed" : "completed",
    statusLabel: cancelled ? "APLAZADO" : undefined,
    isGame15: item.isGame15 || false,
    homeTeamLogoUrl: item.homeTeamLogoUrl ?? null,
    awayTeamLogoUrl: item.awayTeamLogoUrl ?? null,
  };
}

/**
 * Groups consecutive matches from the same league, preserving original order.
 * This ensures the graphic matches the quinipolo order (including user reordering).
 * E.g. [DHF, PDM, PDF, PDM] stays as 4 groups in that order, not merged by league.
 */
function groupByLeague(matches) {
  const groups = [];
  let current = null;
  for (const m of matches) {
    const leagueId = m.leagueId;
    const leagueSubLabel = leagueId === "PLENO_15" ? PLENO_15_SUB_LABEL : null;
    if (current && current.leagueId === leagueId) {
      current.matches.push(m);
    } else {
      current = { leagueId, leagueName: m.leagueName, leagueSubLabel, matches: [m] };
      groups.push(current);
    }
  }
  return groups;
}

/**
 * @param {Object} correctionSee - { quinipolo: [...], correct_answers: [...] }
 * @returns {{ image1: Object, image2: Object }}
 */
function buildMatchResultsFromCorrectionSee(correctionSee, matchday = "J16") {
  const quinipolo = correctionSee.quinipolo || [];
  const correctAnswers = correctionSee.correct_answers || [];
  const answerMap = new Map(correctAnswers.map((a) => [a.matchNumber, a]));

  const allMatches = quinipolo.map((item, i) => {
    const matchNumber = i + 1;
    const answer = answerMap.get(matchNumber);
    const leagueId = item.leagueId || item.league_id || "DHM";
    const leagueName = LEAGUE_NAMES[leagueId] || leagueId;
    const m = buildMatchFromItem(item, answer, matchNumber);
    m.leagueId = leagueId;
    m.leagueName = leagueName;
    return m;
  });

  const part1 = allMatches.slice(0, IMAGE1_MATCH_COUNT);
  const part2 = allMatches.slice(IMAGE1_MATCH_COUNT, IMAGE1_MATCH_COUNT + IMAGE2_MATCH_COUNT);

  const basePayload = { matchday };

  return {
    image1: { ...basePayload, matchesByLeague: groupByLeague(part1) },
    image2: { ...basePayload, matchesByLeague: groupByLeague(part2) },
  };
}

module.exports = {
  buildMatchResultsFromCorrectionSee,
  LEAGUE_NAMES,
};
