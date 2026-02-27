const { renderRanking } = require("./renderers/renderRanking");
const { renderMatchResults } = require("./renderers/renderMatchResults");
const { renderStatistics } = require("./renderers/renderStatistics");

async function generateGraphics(payload) {
  const results = {};
  const matchday = payload._meta?.matchday || "J16";

  if (payload.image5_statistics) {
    results.image1 = await renderStatistics(payload.image5_statistics);
  }

  if (payload.image1_lastResults) {
    results.image2 = await renderMatchResults(payload.image1_lastResults);
  }

  if (payload.image2_lastResultsExtended) {
    results.image3 = await renderMatchResults(payload.image2_lastResultsExtended);
  }

  if (payload.image3_quinipoloRanking) {
    results.image4 = await renderRanking(
      payload.image3_quinipoloRanking,
      "quinipolo"
    );
  }

  if (payload.image4_generalLeagueRanking) {
    results.image5 = await renderRanking(
      payload.image4_generalLeagueRanking,
      "general"
    );
  }

  return { matchday, images: results };
}

module.exports = { generateGraphics, renderRanking, renderMatchResults, renderStatistics };
