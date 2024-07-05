// models/Leagues.js
const mongoose = require("mongoose");

const leaguesSchema = new mongoose.Schema({
  leagueId: {
    type: String,
    required: true,
  },
  moderatorArray: {
    type: Array,
    default: [],
  },
  leagueImage: {
    type: String,
  },
});

const Leagues = mongoose.model("leagues", leaguesSchema);

module.exports = Leagues;
