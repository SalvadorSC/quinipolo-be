const { supabase } = require("../../services/supabaseClient");
const {
  computeAnswerStatistics,
} = require("./computeAnswerStatistics");

/**
 * Compute the most failed match stats for a corrected quinipolo.
 * Uses answer statistics to find the match with the highest failure percentage.
 * Then finds the most common wrong answer for that match.
 *
 * @param {string} quinipoloId
 * @param {Array<{ matchNumber: number, chosenWinner: string, goalsHomeTeam?: string, goalsAwayTeam?: string }>} correctedAnswers
 * @param {Array} surveyItems - original quinipolo items containing homeTeam/awayTeam
 * @returns {Promise<{ matchNumber: number, failedPercentage: number, wrongCount: number, totalCount: number, homeTeam?: string, awayTeam?: string, correctWinner?: string, mostWrongWinner?: string }|null>}
 */
async function computeMostFailed(quinipoloId, correctedAnswers, surveyItems) {
  try {
    // Get or compute answer statistics
    let statistics = await computeAnswerStatistics(quinipoloId);
    
    if (!statistics || !statistics.matches || statistics.matches.length === 0) {
      return null;
    }

    const correctedByMatch = new Map(
      (correctedAnswers || []).map((c) => [c.matchNumber, c])
    );

    const totalResponses = statistics.total_responses;
    if (totalResponses === 0) return null;

    // Find the match with the highest failure percentage
    let mostFailedMatch = null;
    let highestFailurePercentage = 0;

    for (const matchStat of statistics.matches) {
      const matchNumber = matchStat.matchNumber;
      const correctAnswer = correctedByMatch.get(matchNumber);
      if (!correctAnswer) continue;

      // Get the correct winner from the corrected answers
      const correctWinner = correctAnswer.chosenWinner;
      
      // Find the statistics for the correct answer
      let correctCount = 0;
      if (correctWinner === matchStat.homeTeam) {
        correctCount = matchStat.statistics.homeTeam.count;
      } else if (correctWinner === matchStat.awayTeam) {
        correctCount = matchStat.statistics.awayTeam.count;
      } else if (correctWinner === "empat") {
        correctCount = matchStat.statistics.empat.count;
      }

      // Calculate failure percentage
      const wrongCount = totalResponses - correctCount;
      const failurePercentage = totalResponses > 0 
        ? (wrongCount / totalResponses) * 100 
        : 0;

      // Track the match with highest failure percentage
      if (failurePercentage > highestFailurePercentage) {
        highestFailurePercentage = failurePercentage;
        mostFailedMatch = {
          matchNumber,
          matchStat,
          correctWinner,
          wrongCount,
          totalCount: totalResponses,
          failurePercentage,
        };
      }
    }

    if (!mostFailedMatch) return null;

    // Now find the most common wrong answer for this match
    const { matchStat, correctWinner } = mostFailedMatch;
    let mostWrongWinner = null;
    let mostWrongCount = 0;

    // Check each option and find the one with highest count that's not the correct answer
    if (correctWinner !== matchStat.homeTeam && matchStat.statistics.homeTeam.count > mostWrongCount) {
      mostWrongCount = matchStat.statistics.homeTeam.count;
      mostWrongWinner = matchStat.homeTeam;
    }
    if (correctWinner !== matchStat.awayTeam && matchStat.statistics.awayTeam.count > mostWrongCount) {
      mostWrongCount = matchStat.statistics.awayTeam.count;
      mostWrongWinner = matchStat.awayTeam;
    }
    if (correctWinner !== "empat" && matchStat.statistics.empat.count > mostWrongCount) {
      mostWrongCount = matchStat.statistics.empat.count;
      mostWrongWinner = "empat";
    }

    const item = Array.isArray(surveyItems)
      ? surveyItems[mostFailedMatch.matchNumber - 1] || {}
      : {};
    const homeTeam = (item.homeTeam || matchStat.homeTeam || "").split("__")[0] || undefined;
    const awayTeam = (item.awayTeam || matchStat.awayTeam || "").split("__")[0] || undefined;

    return {
      matchNumber: mostFailedMatch.matchNumber,
      failedPercentage: Number(highestFailurePercentage.toFixed(1)),
      wrongCount: mostFailedMatch.wrongCount,
      totalCount: mostFailedMatch.totalCount,
      homeTeam,
      awayTeam,
      correctWinner,
      mostWrongWinner: mostWrongWinner || undefined,
    };
  } catch (e) {
    console.warn("Failed computing most failed match stats:", e);
    return null;
  }
}

module.exports = { computeMostFailed };
