// routes/scraper.js
const express = require("express");
const router = express.Router();
const ScraperController = require("../controllers/ScraperController");
const { authenticateToken } = require("../middleware/auth");

// Match search when creating a quinipolo. The profile API hardcodes
// hasScraperAccess so every active league can use it.
router.get("/matches", ScraperController.getMatches);

// Get results for a quinipolo
router.get("/results", ScraperController.getResults);

module.exports = router;

