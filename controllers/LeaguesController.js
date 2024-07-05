// controllers/LeaguesController.js
const Leagues = require("../models/Leagues");

const getAllLeaguesData = async (req, res) => {
  try {
    console.log("Fetching all leagues");
    const leagues = await Leagues.find();
    res.status(200).json(leagues);
  } catch (error) {
    console.error("Error fetching leagues:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getLeagueData = async (req, res) => {
  try {
    console.log("Fetching league data");
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    res.status(200).json(league);
  } catch (error) {
    console.error("Error fetching league data:", error);
    res.status(500).send("Internal Server Error");
  }
};

// create new league

const createNewLeague = async (req, res) => {
  try {
    const newLeague = new Leagues({
      ...req.body,
      createdAt: new Date(),
      lastUpdated: new Date(),
    });
    await newLeague.save();
    res.status(201).json(newLeague);
  } catch (error) {
    console.error("Error creating league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const updateLeague = async (req, res) => {
  try {
    const league = await Leagues.findOneAndUpdate(
      { leagueId: req.params.leagueId },
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    );
    res.status(200).json(league);
  } catch (error) {
    console.error("Error updating league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const deleteLeague = async (req, res) => {
  try {
    const league = await Leagues.findOneAndDelete({
      leagueId: req.params.leagueId,
    });
    res.status(200).json(league);
  } catch (error) {
    console.error("Error deleting league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const joinLeague = async (req, res) => {
  try {
    const league = await Leagues.findOneAndUpdate(
      { leagueId: req.params.leagueId },
      { $push: { users: req.body.userId } },
      { new: true }
    );
    res.status(200).json(league);
  } catch (error) {
    console.error("Error joining league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const addLeagueImage = async (req, res) => {
  try {
    const league = await Leagues.findOneAndUpdate(
      { leagueId: req.params.leagueId },
      { leagueImage: req.body.leagueImage },
      { new: true }
    );
    res.status(200).json(league);
  } catch (error) {
    console.error("Error adding league image:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  getAllLeaguesData,
  getLeagueData,
  createNewLeague,
  deleteLeague,
  updateLeague,
  joinLeague,
  addLeagueImage,
};
