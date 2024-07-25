const mongoose = require("mongoose");

const answerItemSchema = new mongoose.Schema({
  matchNumber: {
    type: Number,
    required: true,
  },
  chosenWinner: {
    type: String,
    required: true,
  },
  goalsHomeTeam: {
    type: String,
    required: function () {
      return this.matchNumber === 15;
    },
  },
  goalsAwayTeam: {
    type: String,
    required: function () {
      return this.matchNumber === 15;
    },
  },
});

const answerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  quinipoloId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "quinipolos",
    required: true,
  },
  answers: [answerItemSchema],
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const Answer = mongoose.model("answers", answerSchema);

module.exports = Answer;
