// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  /* userId: {
    type: String,
    required: true,
  }, */
  /* password: {
    type: String,
    required: true,
  }, */
  role: {
    type: String,
    enum: ["user", "moderator"],
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
});

const User = mongoose.model("users", userSchema);

module.exports = User;
