// controllers/ScraperController.js
const { fetchAndSelectMatches } = require("../services/scraper/scraperService");
const { fetchLastWeekResults } = require("../services/scraper/resultsService");

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

/**
 * GET /api/scraper/results
 * Fetches last week's results and matches them to a quinipolo
 * Query params:
 *   - quinipoloId: Required. The quinipolo ID to match results against
 *   - days: Optional. Number of days to look back (default: 7)
 */
const getResults = async (req, res) => {
  try {
    const { quinipoloId, days } = req.query;

    if (!quinipoloId) {
      return res.status(400).json({
        error: "Missing required parameter",
        message: "quinipoloId is required",
      });
    }

    const daysParam = days ? parseInt(days, 10) : 7;
    if (isNaN(daysParam) || daysParam < 1 || daysParam > 30) {
      return res.status(400).json({
        error: "Invalid parameter",
        message: "days must be a number between 1 and 30",
      });
    }

    const data = await fetchLastWeekResults(quinipoloId, daysParam);

    res.json(data);
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({
      error: "Failed to fetch results",
      message: error.message,
    });
  }
};

module.exports = {
  getMatches,
  getResults,
};

