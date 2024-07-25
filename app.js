// app.js

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
const { getAllTeams } = require("./controllers/TeamsController.js");

require("dotenv").config();
// Enable CORS for all routes
app.use(cors()); // Add this line

// Add middleware for parsing JSON requests
app.use(bodyParser.json());

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

app.use("/api/auth", authRoutes);

app.use("/api/leagues", leaguesRoutes);

app.use("/api/users", usersRoutes);

app.use("/api/quinipolos", quinipolosRoutes);
