// routes/answerStatistics.js
const express = require("express");
const router = express.Router();
const AnswerStatisticsController = require("../controllers/AnswerStatisticsController");
const { authenticateToken } = require("../middleware/auth");

// Get answer statistics for a quinipolo
router.get(
  "/quinipolo/:quinipoloId",
  authenticateToken,
  AnswerStatisticsController.getAnswerStatistics
);

module.exports = router;


