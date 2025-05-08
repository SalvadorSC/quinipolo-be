const mongoose = require("mongoose");

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
  correctionDate: Date,
  participantsWhoAnswered: [String],
  hasBeenCorrected: Boolean,
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

const Quinipolo = mongoose.model("quinipolos", QuinipoloSchema);

module.exports = Quinipolo;
