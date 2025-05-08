const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["new_quinipolo", "reminder", "correction"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  quinipoloId: {
    type: String,
  },
  leagueId: {
    type: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification = mongoose.model("notifications", notificationSchema);

module.exports = Notification; 