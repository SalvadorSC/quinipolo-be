// routes/teams.js
const express = require("express");
const router = express.Router();
const TeamsController = require("../controllers/TeamsController");

// Define a route for fetching all teams grouped by sport
router.get("/all", TeamsController.getAllTeams);

// Fetch every waterpolo team with full record data
router.get("/waterpolo", TeamsController.getWaterpoloTeams);

// Fetch waterpolo teams with logo audit (resolved/missing/closestMatch)
router.get("/waterpolo/full", TeamsController.getWaterpoloTeamsFull);

// Duplicate detection and merge (for curator) - must be before /:id
router.get("/waterpolo/duplicates", TeamsController.getDuplicateGroups);
router.post("/merge", TeamsController.mergeTeams);
router.get("/quinipolo-count", TeamsController.getQuinipoloCountForTeam);

// Update team (gender, alias, team_type)
router.patch("/:id", TeamsController.updateTeam);

module.exports = router;
