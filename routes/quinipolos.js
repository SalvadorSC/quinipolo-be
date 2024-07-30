// routes/quinipolos.js
const express = require("express");
const router = express.Router();
const QuinipolosController = require("../controllers/QuinipolosController");
const AnswerController = require("../controllers/AnswerController");

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

// api/quinipolos/quinipolo/668bf4504d16cd5b651c803f/answers-see/username
router.get(
  "/quinipolo/:id/answers-see/:username",
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
