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
  subscription: {
    id: String,
    status: String,
    plan: String,
  },
  stripeCustomerId: String,
  subscriptionType: {
    type: String,
    enum: ["pro", "moderator", "none"],
    default: "none",
  },
});

const User = mongoose.model("users", userSchema);

module.exports = User;
