// controllers/LeaguesController.js
const Leagues = require("../models/Leagues");
const { createLeaderboard } = require("./LeaderboardController");

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
    // create leaderboard for the league
    await createLeaderboard(newLeague.leagueId);

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
    console.log("Joining league", req.body.username, req.body.leagueId);
    // first find league, then save the user to the league
    const league = await Leagues.findOne({ leagueId: req.body.leagueId });
    league.participants.push(req.body.username);
    await league.save();

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

const createModerationPetition = async (req, res) => {
  // find if user has a pending petition in the league
  const userHasPendingPetition = await Leagues.findOne({
    leagueId: req.params.leagueId,
    "moderatorPetitions.userId": req.body.userId,
    "moderatorPetitions.status": "pending",
  });
  // find if user had a cancelled petition in the league
  const userHasCancelledPetition = await Leagues.findOne({
    leagueId: req.params.leagueId,
    "moderatorPetitions.userId": req.body.userId,
    "moderatorPetitions.status": "cancelled",
  });
  // if user had a pending petition, return an error
  if (userHasPendingPetition) {
    return res.status(400).send("User already has a pending petition");
  }
  // if user has a cancelled petition, change it to pending, update date, and return the league object
  if (userHasCancelledPetition) {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league.moderatorPetitions.id(
      userHasCancelledPetition.moderatorPetitions[0]._id
    );
    petition.status = "pending";
    petition.date = new Date();
    await league.save();
    return res.status(200).json(league);
  }
  // if user has no pending or cancelled petitions, create a new petition
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    league.moderatorPetitions.push({
      ...req.body,
      status: "pending",
      date: new Date(),
    });
    await league.save();
    res.status(200).json(league);
  } catch (error) {
    console.error("Error creating moderation petition:", error);
    res.status(500).send("Internal Server Error");
  }
};

const acceptModerationPetition = async (req, res) => {
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league.moderatorPetitions.id(req.params.petitionId);
    petition.status = "accepted";
    league.moderatorArray.push(petition.username);

    await league.save();
    res.status(200).json(league);
  } catch (error) {
    console.error("Error accepting moderation petition:", error);
    res.status(500).send("Internal Server Error");
  }
};

const rejectModerationPetition = async (req, res) => {
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league.moderatorPetitions.id(req.params.petitionId);
    petition.status = "rejected";
    await league.save();
    res.status(200).json(league);
  } catch (error) {
    console.error("Error rejecting moderation petition:", error);
    res.status(500).send("Internal Server Error");
  }
};

const cancelModerationPetition = async (req, res) => {
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league.moderatorPetitions.id(req.params.petitionId);
    petition.status = "cancelled";
    await league.save();
    res.status(200).json(league);
  } catch (error) {
    console.error("Error cancelling moderation petition:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getModerationPetitions = async (req, res) => {
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    res.status(200).json(league.moderatorPetitions);
  } catch (error) {
    console.error("Error fetching moderation petitions:", error);
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
  createModerationPetition,
  getModerationPetitions,
  acceptModerationPetition,
  rejectModerationPetition,
  cancelModerationPetition,
};
