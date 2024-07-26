// controllers/LeaguesController.js
const Leaderboard = require("../models/Leaderboard");
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

    // join leaderboard for the league

    const leaderboard = await Leaderboard.findOne({
      leagueId: req.body.leagueId,
    });
    leaderboard.participantsLeaderboard.push(req.body.username);
    await leaderboard.save();

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

const createPetition = async (req, res, petitionType) => {
  const petitionField = `${petitionType}Petitions`;

  // find if user has a pending petition in the league
  const userHasPendingPetition = await Leagues.findOne({
    leagueId: req.params.leagueId,
    [`${petitionField}.userId`]: req.body.userId,
    [`${petitionField}.status`]: "pending",
  });

  // find if user had a cancelled petition in the league
  const userHasCancelledPetition = await Leagues.findOne({
    leagueId: req.params.leagueId,
    [`${petitionField}.userId`]: req.body.userId,
    [`${petitionField}.status`]: "cancelled",
  });

  // if user had a pending petition, return an error
  if (userHasPendingPetition) {
    return res.status(400).send("User already has a pending petition");
  }

  // if user has a cancelled petition, change it to pending, update date, and return the league object
  if (userHasCancelledPetition) {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league[petitionField].id(
      userHasCancelledPetition[petitionField][0]._id
    );
    petition.status = "pending";
    petition.date = new Date();
    await league.save();
    return res.status(200).json(league);
  }

  // if user has no pending or cancelled petitions, create a new petition
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    league[petitionField].push({
      ...req.body,
      status: "pending",
      date: new Date(),
    });
    await league.save();
    res.status(200).json(league);
  } catch (error) {
    console.error(`Error creating ${petitionType} petition:`, error);
    res.status(500).send("Internal Server Error");
  }
};

const updatePetitionStatus = async (
  req,
  res,
  petitionType,
  newStatus,
  addToArray
) => {
  const petitionField = `${petitionType}Petitions`;
  const arrayField = `${petitionType}Array`;

  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league[petitionField].id(req.params.petitionId);
    petition.status = newStatus;

    if (addToArray) {
      league[arrayField].push(petition.username);
    }

    await league.save();
    res.status(200).json(league);
  } catch (error) {
    console.error(`Error updating ${petitionType} petition:`, error);
    res.status(500).send("Internal Server Error");
  }
};

const getPetitions = async (req, res, petitionType) => {
  const petitionField = `${petitionType}Petitions`;

  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    res.status(200).json(league[petitionField]);
  } catch (error) {
    console.error(`Error fetching ${petitionType} petitions:`, error);
    res.status(500).send("Internal Server Error");
  }
};

const createModerationPetition = (req, res) =>
  createPetition(req, res, "moderator");
const createParticipantPetition = (req, res) =>
  createPetition(req, res, "participant");

const acceptModerationPetition = (req, res) =>
  updatePetitionStatus(req, res, "moderator", "accepted", true);
const rejectModerationPetition = (req, res) =>
  updatePetitionStatus(req, res, "moderator", "rejected", false);
const cancelModerationPetition = (req, res) =>
  updatePetitionStatus(req, res, "moderator", "cancelled", false);

const acceptParticipantPetition = (req, res) =>
  updatePetitionStatus(req, res, "participant", "accepted", true);
const rejectParticipantPetition = (req, res) =>
  updatePetitionStatus(req, res, "participant", "rejected", false);
const cancelParticipantPetition = (req, res) =>
  updatePetitionStatus(req, res, "participant", "cancelled", false);

const getModerationPetitions = (req, res) =>
  getPetitions(req, res, "moderator");
const getParticipantPetitions = (req, res) =>
  getPetitions(req, res, "participant");

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
  createParticipantPetition,
  acceptParticipantPetition,
  rejectParticipantPetition,
  cancelParticipantPetition,
  getParticipantPetitions,
};
