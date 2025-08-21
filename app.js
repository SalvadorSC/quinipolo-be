// app.js
require("dotenv").config();
const STRIPE_KEY =
  process.env.REACT_APP_ENV === "development"
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(STRIPE_KEY);
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;
//const bodyParser = require("body-parser");
const authRoutes = require("./routes/auth.js");
const leaguesRoutes = require("./routes/leagues.js");
const usersRoutes = require("./routes/users.js");
const quinipolosRoutes = require("./routes/quinipolos.js");
const subscriptionsRoutes = require("./routes/subscriptions.js");
const leagueStripeRoutes = require("./routes/leagueStripe.js");
const LeagueStripeController = require("./controllers/LeagueStripeController");
const teamsRoutes = require("./routes/teams.js");

// Enable CORS for all routes
app.use(cors()); // Add this line

// Stripe webhook must receive the raw body (place BEFORE express.json)
app.post(
  "/api/league-stripe/webhook",
  express.raw({ type: "application/json" }),
  LeagueStripeController.handleLeaguePaymentWebhook
);

// Parse JSON bodies - for all other routes
app.use(express.json());

/* connectWithRetry(); */

// Get all teams
// app.get("/api/teamOptions", getAllTeams);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// console.log every time a request is made
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes);

app.use("/api/leagues", leaguesRoutes);

app.use("/api/users", usersRoutes);

app.use("/api/quinipolos", quinipolosRoutes);

app.use("/api/subscriptions", subscriptionsRoutes);

app.use("/api/league-stripe", leagueStripeRoutes);

app.use("/api/teams", teamsRoutes);
