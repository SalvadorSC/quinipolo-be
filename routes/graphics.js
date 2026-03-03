const express = require("express");
const router = express.Router();
const GraphicsController = require("../controllers/GraphicsController");

router.post("/generate", GraphicsController.generate);

module.exports = router;
