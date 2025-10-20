const { supabase } = require("../../services/supabaseClient");

/**
 * Compute the most failed match stats for a corrected quinipolo.
 * Uses logic equivalent to the provided SQL: groups incorrect submissions by
 * (matchNumber, submitted solution), orders by failure count desc, and picks the top.
 * Then computes failedPercentage for that match as wrong/total * 100.
 * Returns team names and winners mapping for clarity.
 *
 * @param {string} quinipoloId
 * @param {Array<{ matchNumber: number, chosenWinner: string, goalsHomeTeam?: string, goalsAwayTeam?: string }>} correctedAnswers
 * @param {Array} surveyItems - original quinipolo items containing homeTeam/awayTeam
 * @returns {Promise<{ matchNumber: number, failedPercentage: number, wrongCount: number, totalCount: number, homeTeam?: string, awayTeam?: string, correctWinner?: string, mostWrongWinner?: string }|null>}
 */
async function computeMostFailed(quinipoloId, correctedAnswers, surveyItems) {
  try {
    const { data: allAnswersRows, error } = await supabase
      .from("answers")
      .select("answers")
      .eq("quinipolo_id", quinipoloId);

    if (error) throw error;

    const correctedByMatch = new Map(
      (correctedAnswers || []).map((c) => [c.matchNumber, c])
    );

    // Totals per match and wrong counts per submitted solution
    const totalByMatch = new Map(); // matchNumber -> total answers
    const wrongByMatchAndSolution = new Map(); // key: matchNumber|chosenWinner|goalsHome|goalsAway -> count

    for (const row of allAnswersRows || []) {
      for (const ua of row.answers || []) {
        const m = ua.matchNumber;
        totalByMatch.set(m, (totalByMatch.get(m) || 0) + 1);

        const correct = correctedByMatch.get(m);
        if (!correct) continue;

        const isCorrect =
          ua.chosenWinner === correct.chosenWinner &&
          (m !== 15 ||
            (ua.goalsHomeTeam ===
              (correct.goalsHomeTeam ?? correct.goalsHome) &&
              ua.goalsAwayTeam ===
                (correct.goalsAwayTeam ?? correct.goalsAway)));

        if (!isCorrect) {
          const goalsHome = ua.goalsHomeTeam ?? ua.goals_home ?? "";
          const goalsAway = ua.goalsAwayTeam ?? ua.goals_away ?? "";
          const key = `${m}|${ua.chosenWinner}|${goalsHome}|${goalsAway}`;
          wrongByMatchAndSolution.set(
            key,
            (wrongByMatchAndSolution.get(key) || 0) + 1
          );
        }
      }
    }

    if (wrongByMatchAndSolution.size === 0) return null;

    // Pick the wrong group with a deterministic tiebreak:
    // failures desc, failedPercentage desc, lowest matchNumber, chosenWinner asc, goalsHome asc, goalsAway asc
    let best = null; // { matchNumber, failures, chosenWinner, goalsHome, goalsAway, failedPercentage }
    for (const [key, failures] of wrongByMatchAndSolution.entries()) {
      const [matchNumberStr, chosenWinner, goalsHome, goalsAway] =
        key.split("|");
      const matchNumber = Number(matchNumberStr);
      const total = totalByMatch.get(matchNumber) || 0;
      const failedPercentage = total > 0 ? failures / total : 0;

      if (!best) {
        best = {
          matchNumber,
          failures,
          chosenWinner,
          goalsHome,
          goalsAway,
          failedPercentage,
        };
        continue;
      }

      const cmp =
        failures !== best.failures
          ? failures - best.failures
          : failedPercentage !== best.failedPercentage
          ? failedPercentage - best.failedPercentage
          : best.matchNumber - matchNumber || // lower matchNumber wins
            chosenWinner.localeCompare(best.chosenWinner) ||
            goalsHome.localeCompare(best.goalsHome) ||
            goalsAway.localeCompare(best.goalsAway);

      if (cmp > 0) {
        best = {
          matchNumber,
          failures,
          chosenWinner,
          goalsHome,
          goalsAway,
          failedPercentage,
        };
      }
    }

    if (!best) return null;

    const total = totalByMatch.get(best.matchNumber) || 0;
    const failedPercentagePct =
      total > 0 ? Number(((best.failures / total) * 100).toFixed(1)) : 0;

    const item = Array.isArray(surveyItems)
      ? surveyItems[best.matchNumber - 1] || {}
      : {};
    const homeTeam = (item.homeTeam || "").split("__")[0] || undefined;
    const awayTeam = (item.awayTeam || "").split("__")[0] || undefined;

    const correct = correctedByMatch.get(best.matchNumber);
    const correctWinner = correct ? correct.chosenWinner : undefined;

    return {
      matchNumber: best.matchNumber,
      failedPercentage: failedPercentagePct,
      wrongCount: best.failures,
      totalCount: total,
      homeTeam,
      awayTeam,
      correctWinner,
      // mostWrongWinner maps to the most commonly submitted wrong winner option
      mostWrongWinner: best.chosenWinner || undefined,
    };
  } catch (e) {
    console.warn("Failed computing most failed match stats:", e);
    return null;
  }
}

module.exports = { computeMostFailed };
