const mongoose = require("mongoose");

const leaderboardEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  leagueId: {
    type: String,
    required: true,
  },
  points: {
    type: Number,
    default: 0,
  },
  fullCorrectQuinipolos: {
    type: Number,
    default: 0,
  },
});

const Leaderboard = mongoose.model("leaderboards", leaderboardEntrySchema);

module.exports = Leaderboard;
