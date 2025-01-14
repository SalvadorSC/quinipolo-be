// app.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Add this line
const app = express();
const PORT = 3000;
const bodyParser = require("body-parser"); // Add this line for parsing JSON requests
const authRoutes = require("./routes/auth.js");
const leaguesRoutes = require("./routes/leagues.js");
const usersRoutes = require("./routes/users.js");
const quinipolosRoutes = require("./routes/quinipolos.js");
const subscriptionsRoutes = require("./routes/subscriptions.js");
const stripeRoutes = require("./routes/stripe.js");
const { getAllTeams } = require("./controllers/TeamsController.js");
const { plans } = require("./controllers/StripeController.js");

require("dotenv").config();
// Enable CORS for all routes
app.use(cors()); // Add this line

// Connect to MongoDB

const connectWithRetry = async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASSWORD}@${process.env.DBURL}/`,
      {}
    );
    console.log("Successfully connected to MongoDB");
  } catch (err) {
    console.error(
      "Failed to connect to mongo on startup - retrying in 5 sec",
      err
    );
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Get all teams
app.get("/api/teamOptions", getAllTeams);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// console.log every time a request is made
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(
  "/api/webhook/",
  express.raw({ type: "application/json" }),
  stripeRoutes
);

// Add middleware for parsing JSON requests
app.use(bodyParser.json());

app.use("/api/auth", authRoutes);

app.use("/api/leagues", leaguesRoutes);

app.use("/api/users", usersRoutes);

app.use("/api/quinipolos", quinipolosRoutes);

app.use("/api/subscriptions", subscriptionsRoutes);
