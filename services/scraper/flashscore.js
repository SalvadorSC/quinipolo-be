const { leagues } = require("./config");
const { fetchHtml } = require("./http");
const { extractFlashscoreEvents } = require("./flashscoreData");

async function fetchFlashscoreMatches() {
  const matches = [];

  for (const league of leagues) {
    if (!league.flashscoreUrl) continue;

    try {
      const html = await fetchHtml(league.flashscoreUrl);
      const events = extractFlashscoreEvents(html);

      events.forEach((event) => {
        matches.push({
          leagueId: league.id,
          leagueName: league.name,
          homeTeam: event.home,
          awayTeam: event.away,
          startTime: new Date(event.timestamp).toISOString(),
          sourceUrl: league.flashscoreUrl,
          flashscoreId: event.id,
        });
      });
    } catch (error) {
      console.error(
        `Failed to parse Flashscore league ${league.name}: ${error.message}`
      );
    }
  }

  return matches;
}

/**
 * Fetches completed matches with results from Flashscore results pages
 * Uses the /resultados/ URL suffix to get the "Últimos Resultados" section
 */
async function fetchFlashscoreResults() {
  const matches = [];

  for (const league of leagues) {
    if (!league.flashscoreUrl) continue;

    // Construct results URL by appending /resultados/ to the base URL
    const resultsUrl = league.flashscoreUrl.endsWith("/")
      ? `${league.flashscoreUrl}resultados/`
      : `${league.flashscoreUrl}/resultados/`;

    try {
      const html = await fetchHtml(resultsUrl);
      const events = extractFlashscoreEvents(html);

      events.forEach((event) => {
        // Only include matches that have scores and are completed
        // Status "FT" = Finished, "AET" = After Extra Time, "PEN" = Penalties
        // Also include if scores exist even if status is missing (some pages don't include status)
        // Check if match is in the past (completed)
        const matchDate = new Date(event.timestamp);
        const isPastMatch = matchDate < new Date();

        const isCompleted =
          event.status === "FT" ||
          event.status === "AET" ||
          event.status === "PEN" ||
          (event.homeScore !== undefined && event.awayScore !== undefined);

        // Include if it has scores and is either marked as finished or is a past match
        if (
          isCompleted &&
          event.homeScore !== undefined &&
          event.awayScore !== undefined
        ) {
          // Only include if it's a past match (completed) or explicitly marked as finished
          if (
            isPastMatch ||
            event.status === "FT" ||
            event.status === "AET" ||
            event.status === "PEN"
          ) {
            const match = {
              leagueId: league.id,
              leagueName: league.name,
              homeTeam: event.home,
              awayTeam: event.away,
              startTime: new Date(event.timestamp).toISOString(),
              sourceUrl: resultsUrl,
              flashscoreId: event.id,
              homeScore: event.homeScore,
              awayScore: event.awayScore,
            };
            if (event.status) {
              match.status = event.status;
            }
            if (event.wentToPenalties) {
              match.wentToPenalties = event.wentToPenalties;
            }
            if (event.homeRegulationScore !== undefined) {
              match.homeRegulationScore = event.homeRegulationScore;
            }
            if (event.awayRegulationScore !== undefined) {
              match.awayRegulationScore = event.awayRegulationScore;
            }
            matches.push(match);
          }
        }
      });
    } catch (error) {
      console.error(
        `Failed to parse Flashscore results for league ${league.name}: ${error.message}`
      );
    }
  }

  return matches;
}

module.exports = { fetchFlashscoreMatches, fetchFlashscoreResults };

