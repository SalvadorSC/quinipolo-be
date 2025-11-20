const { championsLeagueFeeds } = require("./config");
const { fetchHtml } = require("./http");
const { extractFlashscoreEvents } = require("./flashscoreData");

async function fetchChampionsLeagueMatches() {
  const matches = [];

  for (const feed of championsLeagueFeeds) {
    try {
      const html = await fetchHtml(feed.flashscoreUrl);
      const events = extractFlashscoreEvents(html);
      events.forEach((event) => {
        matches.push({
          leagueId: "CL",
          leagueName: feed.label,
          homeTeam: event.home,
          awayTeam: event.away,
          startTime: new Date(event.timestamp).toISOString(),
          sourceUrl: feed.flashscoreUrl,
          flashscoreId: event.id,
          isChampionsLeague: true,
        });
      });
    } catch (error) {
      console.error(
        `Failed to parse Champions League feed ${feed.label}: ${error.message}`
      );
    }
  }

  return matches;
}

module.exports = { fetchChampionsLeagueMatches };
