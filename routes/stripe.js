const express = require("express");
const router = express.Router();
const StripeController = require("../controllers/StripeController");

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  StripeController.handleSubscriptionEvent
);

module.exports = router;
