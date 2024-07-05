// app.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Add this line
const app = express();
const PORT = 3000;
const bodyParser = require("body-parser"); // Add this line for parsing JSON requests
const authRoutes = require("./routes/auth.js");
const leaguesRoutes = require("./routes/leagues.js");
const {
  createUser,
  getAllUsers,
  getUserRole,
  getUserBasicData,
} = require("./controllers/UserController.js");
const { getAllTeams } = require("./controllers/TeamsController.js");
const {
  createNewQuinipolo,
  getAllQuinipolo,
  getQuinipoloByLeague,
  getQuinipoloById,
  getQuinipolosToAnswer,
  correctQuinipolo,
} = require("./controllers/QuinipolosController.js");
const { submitQuinipoloAnswer } = require("./controllers/AnswerController.js");
require("dotenv").config();
// Enable CORS for all routes
app.use(cors()); // Add this line

// Add middleware for parsing JSON requests
app.use(bodyParser.json());

// Connect to MongoDB

const connectWithRetry = () => {
  try {
    mongoose.connect(
      `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASSWORD}@${process.env.DBURL}/`,
      {}
    );
  } catch {
    (err) => {
      if (err) {
        console.error(
          "Failed to connect to mongo on startup - retrying in 5 sec",
          err
        );
        setTimeout(connectWithRetry, 5000);
      }
    };
  }
};

connectWithRetry();

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// CREATE //
// Create a new user
app.post("/api/users", createUser);

// Create a new quinipolo
app.post("/api/quinipolo/answers", submitQuinipoloAnswer);

// Create an answer

app.post("/api/quinipolos", createNewQuinipolo);

// Correct a quinipolo

app.post("/api/quinipolo/:id/corrections", correctQuinipolo);

// READ //
// Get all users
app.get("/api/users", getAllUsers);

// Get an user's role
app.get("/api/user/role/:email", getUserRole);

// Get user's basic data
app.get("/api/user/data/:username", getUserBasicData);

// Get quinipolos to answer of the user

app.get("/api/user/quinipolos?:email", getQuinipolosToAnswer);

// Get all teams
app.get("/api/teamOptions", getAllTeams);

// Get All Quinipolos
app.get("/api/quinipolos", getAllQuinipolo);

// Get quinipolos for a league
app.get("/api/quinipolos/:league", getQuinipoloByLeague);
// Get quinipolos for a league
app.get("/api/quinipolo", getQuinipoloById);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.use("/api/auth", authRoutes);

app.use("/api/leagues", leaguesRoutes);
