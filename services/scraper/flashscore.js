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

module.exports = { fetchFlashscoreMatches };

