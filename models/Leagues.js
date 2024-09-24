// models/Leagues.js
const mongoose = require("mongoose");

const petitionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["accepted", "rejected", "pending", "cancelled"],
    required: true,
  },
});

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
  participants: {
    type: Array,
    default: [],
  },
  moderatorPetitions: {
    type: [petitionSchema],
    default: [],
  },
  participantPetitions: {
    type: [petitionSchema],
    default: [],
  },
  leagueName: {
    type: String,
    required: true,
  },
  isPrivate: {
    type: Boolean,
    required: true,
  },
});

const Leagues = mongoose.model("leagues", leaguesSchema);

module.exports = Leagues;
