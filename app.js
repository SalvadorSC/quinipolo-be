// app.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Add this line
const app = express();
const PORT = 3000;
const bodyParser = require("body-parser"); // Add this line for parsing JSON requests
const authRoutes = require("./routes/auth.js");
const { createUser, getAllUsers } = require("./controllers/UserController.js");
const { getAllTeams } = require("./controllers/TeamsController.js");
const {
  createNewQuinipolo,
  getAllQuinipolo,
  getQuinipoloByLeague,
} = require("./controllers/QuinipolosController.js");
require("dotenv").config();
// Enable CORS for all routes
app.use(cors()); // Add this line

// Add middleware for parsing JSON requests
app.use(bodyParser.json());

// Connect to MongoDB

mongoose.connect(
  `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASSWORD}@${process.env.DBURL}/`,
  {}
);

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// CREATE //
// Create a new user
app.post("/api/users", createUser);

// Create a new quinipolo
app.post("/api/quinipolos", createNewQuinipolo);

// READ //
// Get all users
app.get("/api/users", getAllUsers);

// Get all teams
app.get("/api/teamOptions", getAllTeams);

// Get All Quinipolos
app.get("/api/quinipolos", getAllQuinipolo);

// Get quinipolos for a league
app.get("/api/quinipolos/:league", getQuinipoloByLeague);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.use("/api/auth", authRoutes);
