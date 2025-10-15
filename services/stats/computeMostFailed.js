const { supabase } = require("../../services/supabaseClient");

/**
 * Compute the most failed match stats for a corrected quinipolo.
 * - Chooses match with highest incorrect percentage
 * - Tiebreaker: lowest matchNumber
 * - Returns team names and winners mapping for clarity
 *
 * @param {string} quinipoloId
 * @param {Array<{ matchNumber: number, chosenWinner: string, goalsHomeTeam?: string, goalsAwayTeam?: string }>} correctedAnswers
 * @param {Array} surveyItems - original quinipolo items containing homeTeam/awayTeam
 * @returns {Promise<{ matchNumber: number, failedPercentage: number, homeTeam?: string, awayTeam?: string, correctWinner?: string, mostWrongWinner?: string }|null>}
 */
async function computeMostFailed(quinipoloId, correctedAnswers, surveyItems) {
  try {
    const { data: allAnswersRows } = await supabase
      .from("answers")
      .select("answers")
      .eq("quinipolo_id", quinipoloId);

    const correctedByMatch = new Map(
      (correctedAnswers || []).map((c) => [c.matchNumber, c])
    );
    const perMatchCounts = new Map();

    for (const row of allAnswersRows || []) {
      for (const ua of row.answers || []) {
        const m = ua.matchNumber;
        if (!perMatchCounts.has(m))
          perMatchCounts.set(m, { total: 0, wrong: 0, wrongByWinner: {} });
        const counts = perMatchCounts.get(m);
        counts.total += 1;
        const correct = correctedByMatch.get(m);
        if (correct) {
          const isCorrect =
            ua.chosenWinner === correct.chosenWinner &&
            (m !== 15 ||
              (ua.goalsHomeTeam === correct.goalsHomeTeam &&
                ua.goalsAwayTeam === correct.goalsAwayTeam));
          if (!isCorrect) {
            counts.wrong += 1;
            counts.wrongByWinner[ua.chosenWinner] =
              (counts.wrongByWinner[ua.chosenWinner] || 0) + 1;
          }
        }
      }
    }

    let best = null;
    for (const [matchNumber, counts] of perMatchCounts.entries()) {
      if (counts.total === 0) continue;
      const failedPct = (counts.wrong / counts.total) * 100;
      if (
        !best ||
        failedPct > best.failedPercentage ||
        (Math.abs(failedPct - best.failedPercentage) < 1e-9 &&
          matchNumber < best.matchNumber)
      ) {
        let mostWrongWinner = null;
        let mostWrongCount = -1;
        for (const [winner, c] of Object.entries(counts.wrongByWinner)) {
          if (c > mostWrongCount) {
            mostWrongWinner = winner;
            mostWrongCount = c;
          }
        }

        const item = Array.isArray(surveyItems)
          ? surveyItems[matchNumber - 1] || {}
          : {};
        const homeTeam = (item.homeTeam || "").split("__")[0] || undefined;
        const awayTeam = (item.awayTeam || "").split("__")[0] || undefined;
        const correct = correctedByMatch.get(matchNumber);
        const correctWinner = correct ? correct.chosenWinner : undefined;

        best = {
          matchNumber,
          failedPercentage: Number(failedPct.toFixed(1)),
          homeTeam,
          awayTeam,
          correctWinner,
          mostWrongWinner: mostWrongWinner || undefined,
        };
      }
    }

    return best;
  } catch (e) {
    console.warn("Failed computing most failed match stats:", e);
    return null;
  }
}

module.exports = { computeMostFailed };
