const mongoose = require("mongoose");

// Define the survey item schema
const surveyItemSchema = new mongoose.Schema({
  gameType: {
    type: String,
    enum: ["waterpolo", "football"],
  },
  homeTeam: {
    type: String,
  },
  awayTeam: {
    type: String,
  },
  isGame15: {
    type: Boolean,
  },
});

const correctAnswerSchema = new mongoose.Schema({
  matchNumber: Number,
  chosenWinner: String,
  goalsHomeTeam: String,
  goalsAwayTeam: String,
});

// Define the full survey schema using an array of survey items
const QuinipoloSchema = new mongoose.Schema({
  leagueId: {
    type: String,
    required: true,
  },
  leagueName: {
    type: String,
    required: true,
  },
  quinipolo: [surveyItemSchema],
  correctAnswers: [correctAnswerSchema],
  creationDate: Date,
  endDate: Date,
  participantsWhoAnswered: [String],
  hasBeenCorrected: Boolean,
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

const Quinipolo = mongoose.model("quinipolos", QuinipoloSchema);

module.exports = Quinipolo;
