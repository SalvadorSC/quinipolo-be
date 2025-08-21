// routes/quinipolos.js
const express = require("express");
const router = express.Router();
const QuinipolosController = require("../controllers/QuinipolosController");
const AnswerController = require("../controllers/AnswerController");
const { authenticateToken } = require("../middleware/auth");

// Create an answer

router.post("/", QuinipolosController.createNewQuinipolo);

// Get All Quinipolos
router.get("/", QuinipolosController.getAllQuinipolo);

// Get a quinipolo
router.get("/quinipolo/:id", QuinipolosController.getQuinipoloById);

router.get(
  "/quinipolo/:id/correction-see",
  QuinipolosController.getQuinipoloCorrectedById
);

// Correct a quinipolo

router.post(
  "/quinipolo/:id/submit-correction",
  QuinipolosController.correctQuinipolo
);

// api/quinipolos/quinipolo/:id/answers-see - uses authenticated user
router.get(
  "/quinipolo/:id/answers-see",
  authenticateToken,
  QuinipolosController.getQuinipoloAnswersAndCorrections
);

// Edit a quinipolo correction
router.post(
  "/quinipolo/:id/submit-correction-edit",
  QuinipolosController.editQuinipoloCorrection
);

// Create a new quinipolo
router.post("/quinipolo/answers", AnswerController.submitQuinipoloAnswer);

// Set a quinipolo as deleted
router.patch(
  "/quinipolo/:id/delete",
  QuinipolosController.setQuinipoloAsDeleted
);

module.exports = router;
