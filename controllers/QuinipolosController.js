// controllers/UserController.js
const Answer = require("../models/Answers");
const Leagues = require("../models/Leagues");
const Quinipolo = require("../models/Quinipolo");
const Teams = require("../models/Teams");
const User = require("../models/User");
const {
  getQuinipoloAnswerByUsernameAndQuinipoloId,
} = require("./AnswerController");
const {
  updateLeaderboard,
  updateLeaderboardForEditedCorrection,
} = require("./LeaderboardController");

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
      const league = await Leagues.findOne({ leagueId: req.body.leagueId });

      const newQuinipolo = new Quinipolo({
        ...req.body,
        leagueName: league.leagueName,
      });

      // Extract teams from quinipolo data
      const teams = extractTeamsFromQuinipolo(req.body.quinipolo);

      // Add new teams to teams collection
      if (teams) {
        await addNewTeams(teams);
      }

      // Save quinipolo
      await newQuinipolo.save();
      res.status(201).json(newQuinipolo);
    } else {
      res.status(500).send("Por favor escoge una fecha de finalización");
    }
  } catch (error) {
    console.error("Error creating Quinipolo:", error);
    res.status(500).send("Internal Server Error");
  }
};

const extractTeamsFromQuinipolo = (quinipoloItems) => {
  const teams = {
    waterpolo: new Set(),
    football: new Set(),
  };

  quinipoloItems.forEach((item) => {
    const homeTeam = item.homeTeam.split("__")[0];
    const awayTeam = item.awayTeam.split("__")[0];

    if (item.gameType === "waterpolo") {
      teams.waterpolo.add(homeTeam);
      teams.waterpolo.add(awayTeam);
    } else if (item.gameType === "football") {
      teams.football.add(homeTeam);
      teams.football.add(awayTeam);
    }
  });

  return {
    waterpolo: Array.from(teams.waterpolo),
    football: Array.from(teams.football),
  };
};

const addNewTeams = async (teams) => {
  try {
    // Fetch the existing teams
    let existingTeams = await Teams.findOne();

    // Initialize if no teams exist
    if (!existingTeams) {
      existingTeams = new Teams({ waterpolo: [], football: [] });
    }

    const sports = ["waterpolo", "football"];

    for (const sport of sports) {
      const newTeams = teams[sport] || [];
      for (const team of newTeams) {
        if (!existingTeams[sport].includes(team)) {
          existingTeams[sport].push(team);
        }
      }
    }

    // Save updated teams
    await existingTeams.save();
  } catch (error) {
    console.error("Error adding new teams:", error);
    throw error;
  }
};

const getQuinipoloByLeague = async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    console.log("Fetching quinipolos for league", leagueId);
    const quinipolos = await Quinipolo.find({ leagueId: leagueId });
    res.status(200).json(quinipolos);
  } catch (error) {
    console.error("Error fetching Quinipolos:", error);
    res.status(500).send(`Internal Server Error ${req.params.league}`);
  }
};

const getQuinipoloById = async (req, res) => {
  console.log("Fetching quinipolo by id", req.params.id);
  try {
    const quinipolo = await Quinipolo.findById(req.params.id);
    res.status(200).json(quinipolo);
  } catch (error) {
    console.error("Error fetching Quinipolo:", error);
    res.status(500).send(`Internal Server Error ${req.query.id}`);
  }
};

const getQuinipolosFromUserLeagues = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.query.username });

    if (user?.leagues.length > 0) {
      const leaguePromises = user.leagues.map(async (league) => {
        const quinipolos = await Quinipolo.find({
          leagueId: league,
        }).sort({ endDate: -1 });

        return quinipolos;
      });

      const results = await Promise.all(leaguePromises);
      const quinipolosFromUserLeagues = results.flat();

      res.status(200).json(quinipolosFromUserLeagues);
    } else {
      res.status(200).json([]);
    }
  } catch (error) {
    console.error("Error fetching quinipolos from user leagues:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserAnswers = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.query.username });
    const quinipolos = await Quinipolo.find({
      leagueId: user.leagues,
    });

    const answersPromises = quinipolos.map(async (quinipolo) => {
      const answer = await Answer.findOne({
        username: req.query.username,
        quinipoloId: quinipolo._id,
      });

      return {
        quinipolo,
        answer,
      };
    });

    const results = await Promise.all(answersPromises);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching user answers:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getQuinipoloAnswersAndCorrections = async (req, res) => {
  const { id } = req.params;

  try {
    const quinipolo = await Quinipolo.findById(id);
    const answers = await getQuinipoloAnswerByUsernameAndQuinipoloId(
      req.params.username,
      quinipolo._id
    );
    if (!quinipolo) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    res.status(200).json({ quinipolo, answers });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
};

const getQuinipolosToAnswer = async (req, res) => {
  try {
    console.log("Fetching Quinipolos to answer");
    console.log(req.query.username);
    const user = await User.findOne({ username: req.query.username });
    let quinipolosToAnswer = [];
    if (user.leagues.length > 0) {
      const leaguePromises = user.leagues.map(async (league) => {
        const quinipolos = await Quinipolo.find({
          leagueId: league,
          // endDate: { $gt: new Date() },
        }).sort({ endDate: -1 });
        const quinipolosWithAnswerFlag = [];

        for (const quinipolo of quinipolos) {
          // Check if the user has already answered this quinipolo
          const answerExists = await Answer.findOne({
            username: req.query.username,
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

const processAndCorrectAnswers = async (quinipoloId, correctedAnswers) => {
  const answers = await Answer.find({ quinipoloId });
  let feedbackForModerator = [];

  const leagueId = (await Quinipolo.findById(quinipoloId)).leagueId;

  for (let answer of answers) {
    let points = 0;
    let correct15thGame = false;

    // Calculate points for each answer
    answer.answers.forEach((userAnswer) => {
      const correct = correctedAnswers.find(
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

    const fullCorrectQuinipolo = points === 15 && correct15thGame;
    // Update points in the leaderboard
    const userLeaderboardUpdate = await updateLeaderboard(
      answer.username,
      leagueId,
      points,
      fullCorrectQuinipolo
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
  console.log(feedbackForModerator);
  return feedbackForModerator;
};

const correctQuinipolo = async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  /*  Find if quinipolo already has correction */

  try {
    const quinipolo = await Quinipolo.findById(id);

    if (!quinipolo) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    // Call a function to process and update answers
    console.log("Correcting Quinipolo", id);
    const results = await processAndCorrectAnswers(id, answers);

    quinipolo.correctAnswers = answers;
    quinipolo.hasBeenCorrected = true;

    await quinipolo.save();
    res
      .status(200)
      .json({ message: "Quinipolo corrected successfully", results });
  } catch (error) {
    res.status(500).json({
      message: "Quinipolo could not be corrected. Please try again later",
      error,
    });
  }
};

const getUserPointsGained = async (quinipoloId, correctedAnswers) => {
  const answers = await Answer.find({ quinipoloId });
  let feedbackForModerator = [];
  for (let answer of answers) {
    let points = 0;
    let correct15thGame = false;

    // Calculate points for each answer
    answer.answers.forEach((userAnswer) => {
      const correct = correctedAnswers.find(
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
    // Gather feedback for the moderator
    feedbackForModerator.push({
      username: answer.username,
      pointsEarned: points,
      correct15thGame: correct15thGame,
    });
  }
  console.log(feedbackForModerator);
  return feedbackForModerator;
};

const editQuinipoloCorrection = async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  /*  Find if quinipolo already has correction */

  try {
    const quinipolo = await Quinipolo.findById(id);

    if (!quinipolo) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    const previousResults = await getUserPointsGained(
      id,
      quinipolo.correctAnswers
    );

    const newResults = await getUserPointsGained(id, answers);

    console.log("previousResults", previousResults);
    console.log("newResults", newResults);
    const updatedLeaderboard = await updateLeaderboardForEditedCorrection(
      previousResults,
      newResults,
      quinipolo.leagueId
    );

    quinipolo.correctAnswers = answers;

    await quinipolo.save();

    res.status(200).json({
      message: "Quinipolo correction edited successfully",
      results: updatedLeaderboard,
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Quinipolo correction could not be edited. Please try again later",
      error,
    });
  }
};

const getQuinipoloCorrectedById = async (req, res) => {
  const { id } = req.params;

  try {
    const quinipolo = await Quinipolo.findById(id);

    if (!quinipolo) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    res.status(200).json(quinipolo);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching Corrected Quinipolo", error });
  }
};

const setQuinipoloAsDeleted = async (req, res) => {
  const { id } = req.params;

  try {
    const quinipolo = await Quinipolo.findById(id);

    if (!quinipolo) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    quinipolo.isDeleted = true;

    await quinipolo.save();

    res
      .status(200)
      .json({ message: "Quinipolo marked as deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message:
        "Quinipolo could not be marked as deleted. Please try again later",
      error,
    });
  }
};
module.exports = {
  getAllQuinipolo,
  createNewQuinipolo,
  getQuinipoloByLeague,
  getQuinipoloById,
  getQuinipolosToAnswer,
  correctQuinipolo,
  getQuinipoloCorrectedById,
  getQuinipolosFromUserLeagues,
  getQuinipoloAnswersAndCorrections,
  editQuinipoloCorrection,
  setQuinipoloAsDeleted,
};
