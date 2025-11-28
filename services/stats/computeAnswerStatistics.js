const supabase = require("../supabaseClient").supabase;

/**
 * Computes answer statistics for a quinipolo
 * @param {string} quinipoloId - The ID of the quinipolo
 * @returns {Promise<Object|null>} Statistics object or null if no answers
 */
async function computeAnswerStatistics(quinipoloId) {
  try {
    // 1. Get all answers for this quinipolo
    const { data: allAnswers, error: answersError } = await supabase
      .from("answers")
      .select("answers")
      .eq("quinipolo_id", quinipoloId);

    if (answersError) {
      console.error("Error fetching answers for statistics:", answersError);
      return null;
    }

    // 2. Get quinipolo to get match details
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("quinipolo")
      .eq("id", quinipoloId)
      .single();

    if (quinipoloError || !quinipolo) {
      console.error("Error fetching quinipolo for statistics:", quinipoloError);
      return null;
    }

    const totalResponses = allAnswers?.length || 0;
    if (totalResponses === 0) {
      return null; // No statistics if no answers
    }

    // 3. Initialize statistics structure
    const statistics = {
      computed_at: new Date().toISOString(),
      total_responses: totalResponses,
      matches: [],
    };

    // 4. Process each match (1-15)
    for (let matchNum = 1; matchNum <= 15; matchNum++) {
      const matchIndex = matchNum - 1;
      const match = quinipolo.quinipolo[matchIndex];

      if (!match) {
        continue; // Skip if match doesn't exist
      }

      const matchStats = {
        matchNumber: matchNum,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        statistics: {
          homeTeam: { count: 0, percentage: 0 },
          awayTeam: { count: 0, percentage: 0 },
          empat: { count: 0, percentage: 0 },
        },
      };

      // Count winner choices
      allAnswers.forEach((answerDoc) => {
        if (!answerDoc.answers || !Array.isArray(answerDoc.answers)) {
          return;
        }

        const answer = answerDoc.answers.find(
          (a) => a.matchNumber === matchNum
        );
        if (!answer || !answer.chosenWinner) return;

        const winner = answer.chosenWinner;
        if (winner === match.homeTeam) {
          matchStats.statistics.homeTeam.count++;
        } else if (winner === match.awayTeam) {
          matchStats.statistics.awayTeam.count++;
        } else if (winner === "empat") {
          matchStats.statistics.empat.count++;
        }
      });

      // Calculate percentages
      Object.keys(matchStats.statistics).forEach((key) => {
        const count = matchStats.statistics[key].count;
        matchStats.statistics[key].percentage =
          totalResponses > 0
            ? Math.round((count / totalResponses) * 10000) / 100
            : 0;
      });

      // For match 15, also compute goal statistics
      if (matchNum === 15) {
        matchStats.statistics.goals = {
          homeTeam: {
            "-": { count: 0, percentage: 0 },
            "11/12": { count: 0, percentage: 0 },
            "+": { count: 0, percentage: 0 },
          },
          awayTeam: {
            "-": { count: 0, percentage: 0 },
            "11/12": { count: 0, percentage: 0 },
            "+": { count: 0, percentage: 0 },
          },
        };

        allAnswers.forEach((answerDoc) => {
          if (!answerDoc.answers || !Array.isArray(answerDoc.answers)) {
            return;
          }

          const answer = answerDoc.answers.find((a) => a.matchNumber === 15);
          if (!answer) return;

          if (answer.goalsHomeTeam) {
            const goalKey = answer.goalsHomeTeam;
            if (matchStats.statistics.goals.homeTeam[goalKey]) {
              matchStats.statistics.goals.homeTeam[goalKey].count++;
            }
          }

          if (answer.goalsAwayTeam) {
            const goalKey = answer.goalsAwayTeam;
            if (matchStats.statistics.goals.awayTeam[goalKey]) {
              matchStats.statistics.goals.awayTeam[goalKey].count++;
            }
          }
        });

        // Calculate goal percentages
        Object.keys(matchStats.statistics.goals).forEach((team) => {
          Object.keys(matchStats.statistics.goals[team]).forEach((goalKey) => {
            const count = matchStats.statistics.goals[team][goalKey].count;
            matchStats.statistics.goals[team][goalKey].percentage =
              totalResponses > 0
                ? Math.round((count / totalResponses) * 10000) / 100
                : 0;
          });
        });
      }

      statistics.matches.push(matchStats);
    }

    return statistics;
  } catch (error) {
    console.error("Error computing answer statistics:", error);
    return null;
  }
}

module.exports = { computeAnswerStatistics };

