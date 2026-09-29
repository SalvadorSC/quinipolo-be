// routes/scraper.js
const express = require("express");
const router = express.Router();
const ScraperController = require("../controllers/ScraperController");
const { authenticateToken } = require("../middleware/auth");

// Match search for creating a quinipolo. Available for every active league.
// The UI shows it from profiles.hasScraperAccess, which the profile API
// always sets. Finished leagues are rejected when the quinipolo is saved.
router.get("/matches", ScraperController.getMatches);

// Get results for a quinipolo
router.get("/results", ScraperController.getResults);

module.exports = router;

