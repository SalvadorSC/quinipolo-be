const SPANISH_SWEAR_AND_HATE_WORDS = require("./restricted/spanish");

// Centralized configuration for backend services
// Read-only module to avoid duplicating env handling across files

const isDevelopment = process.env.REACT_APP_ENV === "development";

// Stripe
const STRIPE_KEY = isDevelopment
  ? process.env.STRIPE_SECRET_KEY_TEST
  : process.env.STRIPE_SECRET_KEY;

// Stripe price IDs for league tiers
const STRIPE_PRICE_IDS = {
  managed: process.env.STRIPE_MANAGED_LEAGUE_PRICE_ID,
  self_managed: process.env.STRIPE_SELF_MANAGED_LEAGUE_PRICE_ID,
};

// Global league handling
const GLOBAL_LEAGUE_ID = process.env.GLOBAL_LEAGUE_ID || null; // allow dynamic creation fallback

// Username restrictions (static list; extend as needed)
const RESTRICTED_USERNAMES = [
  "quinipolo",
  "admin",
  "administrator",
  "moderator",
  "support",
  "staff",
  "system",
];

// Spanish profanity/hate roots

module.exports = {
  isDevelopment,
  STRIPE_KEY,
  STRIPE_PRICE_IDS,
  GLOBAL_LEAGUE_ID,
  RESTRICTED_USERNAMES,
  SPANISH_SWEAR_AND_HATE_WORDS,
};
