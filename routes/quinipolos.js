// routes/quinipolos.js
const express = require("express");
const router = express.Router();
const QuinipolosController = require("../controllers/QuinipolosController");
const AnswerController = require("../controllers/AnswerController");
const { authenticateToken } = require("../middleware/auth");

// Create an answer

router.post("/", QuinipolosController.createNewQuinipolo);

// Create quinipolo for all leagues (admin only)
router.post(
  "/all-leagues",
  authenticateToken,
  QuinipolosController.createQuinipoloForAllLeagues
);

// Create quinipolo for managed leagues only (admin only)
router.post(
  "/managed-leagues",
  authenticateToken,
  QuinipolosController.createQuinipoloForManagedLeagues
);

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
  authenticateToken,
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
  authenticateToken,
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
