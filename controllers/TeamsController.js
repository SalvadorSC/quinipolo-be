// controllers/UserController.js
const Teams = require("../models/Teams");

const getAllTeams = async (req, res) => {
  try {
    console.log("Fetching all teams");
    const teams = await Teams.find();
    res.status(200).json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { getAllTeams };
