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

// Live Global league. Signup alias "global" resolves to this id.
// After the 2026-27 cutover, set it to the new Global id printed by
// scripts/season-cutover-2026-27.js. Do not commit the real value.
const GLOBAL_LEAGUE_ID = process.env.GLOBAL_LEAGUE_ID || null;

// 2025-2026 Global only. Matchday labels subtract 2 for that season's
// quinipolos. This is not the live Global pointer — do not set it to the
// 2026-2027 league.
const LEGACY_GLOBAL_LEAGUE_2025_2026_ID =
  process.env.LEGACY_GLOBAL_LEAGUE_ID ||
  "351a1949-f6c5-4940-ac70-1c7dd08e8b1a";

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
  LEGACY_GLOBAL_LEAGUE_2025_2026_ID,
  RESTRICTED_USERNAMES,
  SPANISH_SWEAR_AND_HATE_WORDS,
};
