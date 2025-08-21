const express = require("express");
const router = express.Router();
const LeagueStripeController = require("../controllers/LeagueStripeController");

// Create checkout session for league creation
router.post(
  "/create-checkout-session",
  LeagueStripeController.createLeagueCheckoutSession
);

// Webhook is mounted at app level before express.json in app.js

// Get available league tiers
router.get("/tiers", LeagueStripeController.getLeagueTiers);

// Verify league subscription status
router.get(
  "/verify-subscription/:leagueId/:userId",
  LeagueStripeController.verifyLeagueSubscription
);

// Get checkout session status and created league, if any
router.get(
  "/session/:sessionId",
  LeagueStripeController.getCheckoutSessionStatus
);

module.exports = router;
