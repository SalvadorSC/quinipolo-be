// controllers/UserController.js
const Answer = require("../models/Answers");
const Quinipolo = require("../models/Quinipolo");
const User = require("../models/User");
const { updateLeaderboard } = require("./LeaderboardController");
const { getUserName, getUserBasicData } = require("./UserController");

const getAllQuinipolo = async (req, res) => {
  try {
    console.log("Fetching all quinipolos");
    const quinipolos = await Quinipolo.find();
    res.status(200).json(quinipolos);
  } catch (error) {
    console.error("Error fetching quinipolos:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createNewQuinipolo = async (req, res) => {
  try {
    if (req.body.endDate) {
      const newQuinipolo = new Quinipolo(req.body);
      await newQuinipolo.save();
      res.status(201).json(newQuinipolo);
    } else {
      //throw new Error("No endDate");
      res.status(500).send("Por favor escoge una fecha de finalización");
    }
  } catch (error) {
    console.error("Error creating Quinipolo:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getQuinipoloByLeague = async (req, res) => {
  try {
    const league = req.params.league;
    const quinipolos = await Quinipolo.find({ league: league });
    res.status(200).json(quinipolos);
  } catch (error) {
    console.error("Error fetching Quinipolos:", error);
    res.status(500).send(`Internal Server Error ${req.params.league}`);
  }
};

const getQuinipoloById = async (req, res) => {
  try {
    const quinipolo = await Quinipolo.findById(req.query.id);
    res.status(200).json(quinipolo);
  } catch (error) {
    console.error("Error fetching Quinipolo:", error);
    res.status(500).send(`Internal Server Error ${req.query.id}`);
  }
};

const getQuinipolosToAnswer = async (req, res) => {
  try {
    console.log("Fetching Quinipolos to answer", req.query.email);
    const user = await User.findOne({ email: req.query.email });

    let quinipolosToAnswer = [];
    if (user.leagues.length > 0) {
      const leaguePromises = user.leagues.map(async (league) => {
        const quinipolos = await Quinipolo.find({
          league: league,
          // endDate: { $gt: new Date() },
        }).sort({ endDate: -1 });
        const quinipolosWithAnswerFlag = [];

        for (const quinipolo of quinipolos) {
          // Check if the user has already answered this quinipolo
          const answerExists = await Answer.findOne({
            userId: user._id,
            quinipoloId: quinipolo._id,
          });

          quinipolosWithAnswerFlag.push({
            ...quinipolo.toObject(),
            answered: !!answerExists,
          });
        }

        return quinipolosWithAnswerFlag;
      });

      const results = await Promise.all(leaguePromises);
      quinipolosToAnswer = results.flat();
    }

    res.status(200).json(quinipolosToAnswer);
  } catch (error) {
    console.error("Error fetching quinipolos to answer:", error);
    res.status(500).send("Internal Server Error");
  }
};

const processAndCorrectAnswers = async (quinipoloId, correctAnswers) => {
  const answers = await Answer.find({ quinipoloId });
  let feedbackForModerator = [];

  const leagueId = (await Quinipolo.findById(quinipoloId)).league;

  for (let answer of answers) {
    let points = 0;
    let correct15thGame = false;

    // Calculate points for each answer
    answer.answers.forEach((userAnswer) => {
      const correct = correctAnswers.find(
        (c) => c.matchNumber === userAnswer.matchNumber
      );
      if (correct) {
        if (userAnswer.chosenWinner === correct.chosenWinner) {
          points += 1; // Basic point for correct winner
        }

        // Special handling for the 15th question
        if (userAnswer.matchNumber === 15) {
          correct15thGame =
            userAnswer.goalsHomeTeam === correct.goalsHomeTeam &&
            userAnswer.goalsAwayTeam === correct.goalsAwayTeam;
        }
      }
    });

    // Update points in the leaderboard

    const userLeaderboardUpdate = await updateLeaderboard(
      answer.userId,
      leagueId,
      points,
      correct15thGame
    );

    // Mark the answer as corrected
    answer.corrected = true;
    await answer.save();

    // Gather feedback for the moderator
    feedbackForModerator.push({
      username: userLeaderboardUpdate.username,
      pointsEarned: points,
      totalPoints: userLeaderboardUpdate.totalPoints,
      correct15thGame: correct15thGame,
    });
  }
  return feedbackForModerator;
};

const correctQuinipolo = async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;

  try {
    const quinipolo = await Quinipolo.findById(id);

    if (!quinipolo) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }
    quinipolo.correctAnswers = answers;
    quinipolo.hasBeenCorrected = true;
    await quinipolo.save();
    // Call a function to process and update answers
    const results = await processAndCorrectAnswers(
      id /* quinipoloId */,
      answers
    );

    res
      .status(200)
      .json({ message: "Quinipolo corrected successfully", results });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
};

module.exports = {
  getAllQuinipolo,
  createNewQuinipolo,
  getQuinipoloByLeague,
  getQuinipoloById,
  getQuinipolosToAnswer,
  correctQuinipolo,
};
