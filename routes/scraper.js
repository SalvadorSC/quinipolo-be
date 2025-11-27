// routes/scraper.js
const express = require("express");
const router = express.Router();
const ScraperController = require("../controllers/ScraperController");
const { authenticateToken } = require("../middleware/auth");

// Get matches from scraper
// Note: We can add authentication if needed, but for now it's open
// since it's only called from the frontend by authenticated users
router.get("/matches", ScraperController.getMatches);

// Get results for a quinipolo
router.get("/results", ScraperController.getResults);

module.exports = router;

