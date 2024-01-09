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

// Define the full survey schema using an array of survey items
const QuinipoloSchema = new mongoose.Schema({
  league: {
    type: String,
    required: true,
  },
  quinipolo: [surveyItemSchema],
});

const Quinipolo = mongoose.model("quinipolos", QuinipoloSchema);

module.exports = Quinipolo;
