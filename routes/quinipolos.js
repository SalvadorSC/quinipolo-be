// routes/teams.js
const express = require("express");
const router = express.Router();
const QuinipolosController = require("../controllers/QuinipolosController");

// Define a route for fetching all users
router.get("/quinipolos", QuinipolosController.getAll);

module.exports = router;
