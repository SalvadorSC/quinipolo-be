// controllers/ScraperController.js
const { fetchAndSelectMatches } = require("../services/scraper/scraperService");

/**
 * GET /api/scraper/matches
 * Fetches matches from Flashscore and returns selected matches
 * for the next 7 days based on league quotas
 */
const getMatches = async (req, res) => {
  try {
    const data = await fetchAndSelectMatches();

    res.json({
      matches: data.legacySelection,
      count: data.legacySelection.length,
      allMatches: data.matches,
      presets: data.presets,
      quotas: data.quotas,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    res.status(500).json({
      error: "Failed to fetch matches",
      message: error.message,
    });
  }
};

module.exports = {
  getMatches,
};

