// routes/teams.js
const express = require("express");
const router = express.Router();
const TeamsController = require("../controllers/TeamsController");

// Define a route for fetching all teams grouped by sport
router.get("/all", TeamsController.getAllTeams);

// Fetch every waterpolo team with full record data
router.get("/waterpolo", TeamsController.getWaterpoloTeams);

module.exports = router;
