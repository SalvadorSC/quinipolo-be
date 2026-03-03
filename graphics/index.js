const { renderRanking } = require("./renderers/renderRanking");
const { renderMatchResults } = require("./renderers/renderMatchResults");
const { renderStatistics } = require("./renderers/renderStatistics");
const { buildMatchResultsFromCorrectionSee } = require("./utils/matchResultsTransformer");

async function generateGraphics(payload) {
  const results = {};
  const matchday = payload._meta?.matchday || "J16";

  const correctionSee = payload.correctionSee || payload.rawBeResponses?.correctionSee;
  const hasExplicitImage1 = !!payload.image1_lastResults;
  const hasExplicitImage2 = !!payload.image2_lastResultsExtended;

  if (correctionSee && correctionSee.quinipolo?.length >= 15) {
    const { image1, image2 } = buildMatchResultsFromCorrectionSee(correctionSee, matchday);
    results.image1 = await renderMatchResults(image1);
    results.image2 = await renderMatchResults(image2, { hideTitle: true });
  } else {
    if (hasExplicitImage1) results.image1 = await renderMatchResults(payload.image1_lastResults);
    if (hasExplicitImage2) results.image2 = await renderMatchResults(payload.image2_lastResultsExtended, { hideTitle: true });
  }

  if (payload.image3_quinipoloRanking) {
    results.image3 = await renderRanking(
      payload.image3_quinipoloRanking,
      "quinipolo"
    );
  }

  if (payload.image4_generalLeagueRanking) {
    results.image4 = await renderRanking(
      payload.image4_generalLeagueRanking,
      "general"
    );
  }

  if (payload.image5_statistics) {
    results.image5 = await renderStatistics(payload.image5_statistics);
  }

  return { matchday, images: results };
}

module.exports = { generateGraphics, renderRanking, renderMatchResults, renderStatistics };
