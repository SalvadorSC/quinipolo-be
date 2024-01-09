// routes/teams.js
const express = require("express");
const router = express.Router();
const TeamsController = require("../controllers/TeamsController");

// Define a route for fetching all users
router.get("/teams", TeamsController.getAllTeams);

module.exports = router;
