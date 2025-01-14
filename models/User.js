const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "pro", "moderator"],
    default: "user",
  },
  points: {
    type: Number,
    default: 0,
  },
  leagues: Array,
  moderatedLeagues: [String],
  isBanned: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },
  priceId: String,
  stripeCustomerId: String,
  isPro: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model("users", userSchema);

module.exports = User;
