const { fetchFlashscoreResults } = require("./flashscore");
const { fetchLeveradeResults } = require("./leverade");
const { getWindowBounds, isWithinWindow } = require("./dateUtils");
const { matchTeamNameSync, fetchTeamMap, getTeamNameById } = require("./teamMatcher");
const { supabase } = require("../../services/supabaseClient");

/**
 * Determines match outcome (winner or tie)
 * @param {Object} match - Match object with scores
 * @returns {string} - Winner team name, "Tie", "Tie (PEN)", or "N/A"
 */
function getMatchOutcome(match) {
  if (match.homeScore === undefined || match.awayScore === undefined) {
    return "N/A";
  }

  const wentToPenalties = match.wentToPenalties || match.status === "PEN";

  // If went to penalties and regulation scores are tied, it's a tie resolved by penalties
  if (
    wentToPenalties &&
    match.homeRegulationScore !== undefined &&
    match.awayRegulationScore !== undefined &&
    match.homeRegulationScore === match.awayRegulationScore
  ) {
    return "Tie (PEN)";
  }

  // If scores are equal
  if (match.homeScore === match.awayScore) {
    return wentToPenalties ? "Tie (PEN)" : "Tie";
  }

  // Return winner team name
  return match.homeScore > match.awayScore ? match.homeTeam : match.awayTeam;
}

/**
 * Calculates confidence score for matching a result to a quinipolo question
 * @param {Object} result - Result match from scraper
 * @param {Object} question - Quinipolo question/match
 * @returns {number} - Confidence score between 0.0 and 1.0
 */
function calculateMatchConfidence(result, question, teamMap) {
  let confidence = 0.0;
  let factors = 0;

  // Helper to get team ID by name from team map
  const getTeamIdByName = (name) => {
    if (!name || !teamMap) return null;
    const team = teamMap.find((t) => t.name === name);
    return team ? team.id : null;
  };

  // Get team IDs for question teams
  const questionHomeTeamId = getTeamIdByName(question.homeTeam);
  const questionAwayTeamId = getTeamIdByName(question.awayTeam);

  // Factor 1: Team ID matching (highest weight)
  if (result.homeTeamId && result.awayTeamId && questionHomeTeamId && questionAwayTeamId) {
    const homeIdMatch = result.homeTeamId === questionHomeTeamId;
    const awayIdMatch = result.awayTeamId === questionAwayTeamId;
    
    if (homeIdMatch && awayIdMatch) {
      confidence += 0.5; // High confidence for both team ID matches
      factors += 1;
    } else if (homeIdMatch || awayIdMatch) {
      confidence += 0.25; // Medium confidence for one team ID match
      factors += 1;
    }
  }

  // Factor 2: Team name matching (medium weight) - use matched names
  const homeNameMatch = result.homeTeamMatched === question.homeTeam || result.homeTeam === question.homeTeam;
  const awayNameMatch = result.awayTeamMatched === question.awayTeam || result.awayTeam === question.awayTeam;
  
  if (homeNameMatch && awayNameMatch) {
    confidence += 0.3;
    factors += 1;
  } else if (homeNameMatch || awayNameMatch) {
    confidence += 0.15;
    factors += 1;
  }

  // Factor 3: Date matching (lower weight, but important)
  const resultDate = new Date(result.startTime);
  const questionDate = question.date instanceof Date ? question.date : new Date(question.date);
  const timeDiff = Math.abs(resultDate.getTime() - questionDate.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff <= 1) {
    confidence += 0.15; // Within 1 hour
    factors += 1;
  } else if (hoursDiff <= 6) {
    confidence += 0.1; // Within 6 hours
    factors += 1;
  } else if (hoursDiff <= 24) {
    confidence += 0.05; // Within 24 hours
    factors += 1;
  }

  // Factor 4: League matching
  if (result.leagueId === question.leagueId) {
    confidence += 0.05;
    factors += 1;
  }

  // Normalize confidence (if no factors matched, return 0)
  if (factors === 0) {
    return 0.0;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Adds teams-table names and ids to scraped results so they can be scored
 * against quinipolo questions.
 */
function attachTeamIds(results, teamMap) {
  const getTeamIdByName = (name) => {
    const team = teamMap.find((t) => t.name === name);
    return team ? team.id : null;
  };

  return results.map((result) => {
    const homeTeamName = matchTeamNameSync(result.homeTeam, false, result.leagueId);
    const awayTeamName = matchTeamNameSync(result.awayTeam, false, result.leagueId);

    return {
      ...result,
      homeTeamMatched: homeTeamName,
      awayTeamMatched: awayTeamName,
      homeTeamId: getTeamIdByName(homeTeamName),
      awayTeamId: getTeamIdByName(awayTeamName),
    };
  });
}

/**
 * Picks the best result for each question (above the confidence threshold).
 * @param {Array} results - Results with team ids attached
 * @param {Array} questions - quinipolo.quinipolo
 * @param {string} leagueId - quinipolo league id
 * @param {Array} teamMap - teams table rows
 * @param {Array<number>} [onlyIndices] - limit matching to these 0-based questions
 */
function matchResultsToQuestions(results, questions, leagueId, teamMap, onlyIndices) {
  const indices = onlyIndices || questions.map((_, index) => index);
  const matchedResults = [];

  for (const i of indices) {
    const question = questions[i];
    if (!question) continue;

    let bestMatch = null;
    let bestConfidence = 0;

    for (const result of results) {
      const confidence = calculateMatchConfidence(
        result,
        { ...question, leagueId },
        teamMap
      );

      if (confidence > bestConfidence) {
        bestConfidence = confidence;

        // Determine outcome using form team names
        let outcome = getMatchOutcome(result);
        if (outcome !== "Tie" && outcome !== "Tie (PEN)" && outcome !== "N/A") {
          if (outcome === result.homeTeam || outcome === result.homeTeamMatched) {
            outcome = question.homeTeam;
          } else if (outcome === result.awayTeam || outcome === result.awayTeamMatched) {
            outcome = question.awayTeam;
          }
        }

        bestMatch = {
          ...result,
          matchNumber: i + 1,
          confidence,
          outcome,
          // Use form team names instead of scraped names
          homeTeam: question.homeTeam,
          awayTeam: question.awayTeam,
        };
      }
    }

    // Only include if confidence is above threshold
    if (bestMatch && bestConfidence > 0.3) {
      matchedResults.push(bestMatch);
    }
  }

  return matchedResults;
}

/**
 * Fetches last week's results and matches them to a quinipolo
 * @param {string} quinipoloId - Quinipolo ID to match results against
 * @param {number} days - Number of days to look back (default: 7)
 * @returns {Promise<Object>} - Matched results with confidence scores
 */
async function fetchLastWeekResults(quinipoloId, days = 7) {
  try {
    // Fetch quinipolo from database
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id, league_id, quinipolo")
      .eq("id", quinipoloId)
      .single();

    if (quinipoloError || !quinipolo) {
      throw new Error(`Quinipolo not found: ${quinipoloError?.message || "Unknown error"}`);
    }

    // Fetch results from Flashscore
    const allResults = await fetchFlashscoreResults();

    // Filter to last N days
    const { start, end } = getWindowBounds(new Date(), true, days);
    const filteredResults = allResults.filter((result) =>
      isWithinWindow(result.startTime, start, end)
    );

    // Load team map for matching
    const teamMap = await fetchTeamMap();
    const quinipoloMatches = quinipolo.quinipolo || [];

    // Flashscore first
    const matchedResults = matchResultsToQuestions(
      attachTeamIds(filteredResults, teamMap),
      quinipoloMatches,
      quinipolo.league_id,
      teamMap
    );

    // Leverade fallback for questions Flashscore did not match (Primera,
    // Segunda, or anything missing from the Flashscore results page)
    const matchedNumbers = new Set(matchedResults.map((m) => m.matchNumber));
    const unmatchedIndices = quinipoloMatches
      .map((_, index) => index)
      .filter((index) => !matchedNumbers.has(index + 1));

    let leveradeResultsCount = 0;
    if (unmatchedIndices.length > 0) {
      let leveradeResults = [];
      try {
        leveradeResults = await fetchLeveradeResults(start, end);
      } catch (error) {
        console.error("Leverade results fallback failed:", error.message);
      }
      leveradeResultsCount = leveradeResults.length;
      const fallbackMatches = matchResultsToQuestions(
        attachTeamIds(leveradeResults, teamMap),
        quinipoloMatches,
        quinipolo.league_id,
        teamMap,
        unmatchedIndices
      );
      matchedResults.push(...fallbackMatches);
      matchedResults.sort((a, b) => a.matchNumber - b.matchNumber);
    }

    return {
      matches: matchedResults,
      window: { start: start.toISOString(), end: end.toISOString() },
      totalResults: filteredResults.length,
      leveradeResults: leveradeResultsCount,
      matchedCount: matchedResults.length,
    };
  } catch (error) {
    console.error("Error fetching last week results:", error);
    throw error;
  }
}

module.exports = {
  fetchLastWeekResults,
  attachTeamIds,
  matchResultsToQuestions,
  getMatchOutcome,
  calculateMatchConfidence,
};

