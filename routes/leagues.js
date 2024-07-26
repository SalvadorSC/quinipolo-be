// routes/leagues.js
const express = require("express");
const router = express.Router();
const LeaguesController = require("../controllers/LeaguesController");
const QuinipolosController = require("../controllers/QuinipolosController");
const LeaderboardController = require("../controllers/LeaderboardController");

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
router.post(
  "/:leagueId/request-moderator",
  LeaguesController.createModerationPetition
);
router.post(
  "/:leagueId/request-participant",
  LeaguesController.createParticipantPetition
);

router.get(
  "/:leagueId/moderator-petitions",
  LeaguesController.getModerationPetitions
);
router.put(
  "/:leagueId/moderator-petitions/:petitionId/accept",
  LeaguesController.acceptModerationPetition
);
router.put(
  "/:leagueId/moderator-petitions/:petitionId/reject",
  LeaguesController.rejectModerationPetition
);
router.put(
  "/:leagueId/moderator-petitions/:petitionId/cancel",
  LeaguesController.cancelModerationPetition
);

router.get(
  "/:leagueId/participant-petitions",
  LeaguesController.getParticipantPetitions
);
router.put(
  "/:leagueId/participant-petitions/:petitionId/accept",
  LeaguesController.acceptParticipantPetition
);
router.put(
  "/:leagueId/participant-petitions/:petitionId/reject",
  LeaguesController.rejectParticipantPetition
);
router.put(
  "/:leagueId/participant-petitions/:petitionId/cancel",
  LeaguesController.cancelParticipantPetition
);

// Get quinipolos for a league
router.get(
  "/league/:leagueId/leagueQuinipolos",
  QuinipolosController.getQuinipoloByLeague
);

// Get leaderboard for league by leagueId
// /global/leaderboard

router.get(
  "/:leagueId/leaderboard",
  LeaderboardController.getLeaderboardByLeagueId
);

module.exports = router;
