// models/Teams.js
const mongoose = require("mongoose");

const teamsSchema = new mongoose.Schema({
  waterpolo: Array, // Array of strings
  football: Array, // Array of strings
});

const Teams = mongoose.model("teams", teamsSchema);

module.exports = Teams;
