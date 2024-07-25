const mongoose = require("mongoose");

const leaderboardEntrySchema = new mongoose.Schema({
  leagueId: {
    type: String,
    required: true,
  },

  participantsLeaderboard: [
    {
      username: {
        type: String,
      },
      points: {
        type: Number,
        default: 0,
      },
      fullCorrectQuinipolos: {
        type: Number,
        default: 0,
      },
      nQuinipolosParticipated: {
        type: Number,
        default: 0,
      },
    },
  ],
});

const Leaderboard = mongoose.model("leaderboards", leaderboardEntrySchema);

module.exports = Leaderboard;
