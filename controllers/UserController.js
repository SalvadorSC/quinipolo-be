// controllers/UserController.js
const Answer = require("../models/Answers");
const Leaderboard = require("../models/Leaderboard");
const Leagues = require("../models/Leagues");
const Quinipolo = require("../models/Quinipolo");
const User = require("../models/User");

const getAllUsers = async (req, res) => {
  try {
    console.log("Fetching all users");
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserRole = async (req, res) => {
  try {
    console.log("Fetching user's role", req.params.email);
    const user = await User.findOne({ email: req.params.email });
    res.status(200).json(user.role);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserBasicData = async (req, res) => {
  try {
    console.log("Fetching user's data", req.params.username);
    const user = await User.findOne({ username: req.params.username });

    let quinipolosToAnswer = [];
    let leaguesInfo = [];
    if (!user) {
      throw new Error("User not found");
    }

    if (user.leagues.length > 0) {
      const leaguePromises = user.leagues.map(async (leagueId) => {
        const league = await Leagues.findOne({ leagueId });

        const quinipolos = await Quinipolo.find({
          league: leagueId,
          endDate: { $gt: new Date() },
        });

        const quinipolosWithAnswerFlag = [];

        for (const quinipolo of quinipolos) {
          // Check if the user has already answered this quinipolo
          const answerExists = await Answer.findOne({
            username: user.username,
            quinipoloId: quinipolo._id,
          });

          quinipolosWithAnswerFlag.push({
            ...quinipolo.toObject(),
            answered: !!answerExists,
          });
        }

        leaguesInfo.push({
          ...league.toObject(),
          quinipolos: quinipolosWithAnswerFlag,
        });

        return quinipolosWithAnswerFlag;
      });

      const results = await Promise.all(leaguePromises);
      quinipolosToAnswer = results.flat();
    }

    res.status(200).json({
      role: user.role,
      leagues: leaguesInfo,
      quinipolosToAnswer: quinipolosToAnswer,
      moderatedLeagues: user.moderatedLeagues,
      userId: user._id,
      username: user.username,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createUser = async (req, res) => {
  try {
    const newUser = new User(req.body);

    const globalLeague = await Leagues.findOne({ leagueId: "global" });
    joinLeagueById("global", newUser.username);

    await newUser.save();
    console.log("User created successfully:", newUser);
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserName = async (username) => {
  try {
    const user = await User.findOne({ username: username });
    return user.name;
  } catch (error) {
    console.error("Error fetching username:", error);
  }
};

const updateUserSubscription = async (userId, subscriptionId, planId) => {
  await User.findByIdAndUpdate(userId, {
    subscription: {
      id: subscriptionId,
      plan: planId,
      status: "active",
    },
  });
};

module.exports = {
  getAllUsers,
  createUser,
  getUserRole,
  getUserBasicData,
  getUserName,
  updateUserSubscription,
};
