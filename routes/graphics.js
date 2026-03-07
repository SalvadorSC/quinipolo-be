const express = require("express");
const router = express.Router();
const GraphicsController = require("../controllers/GraphicsController");

router.post("/generate", GraphicsController.generate);
router.get("/teams", GraphicsController.generateTeams);

module.exports = router;
