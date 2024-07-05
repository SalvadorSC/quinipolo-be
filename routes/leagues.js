// routes/leagues.js
const express = require("express");
const router = express.Router();
const LeaguesController = require("../controllers/LeaguesController");

//getAllLeaguesData,
// getLeagueData,
// createNewLeague,
// deleteLeague,
// updateLeague,

// Define a route for fetching all users
router.get("/", LeaguesController.getAllLeaguesData);
router.get("/:leagueId", LeaguesController.getLeagueData);
router.post("/", LeaguesController.createNewLeague);
router.put("/:leagueId", LeaguesController.updateLeague);
router.delete("/:leagueId", LeaguesController.deleteLeague);
router.put("/:leagueId/join", LeaguesController.joinLeague);
router.put("/:leagueId/addImage", LeaguesController.addLeagueImage);

module.exports = router;
