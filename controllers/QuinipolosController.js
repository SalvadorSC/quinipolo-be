// controllers/QuinipoloController.js
const Answer = require("../models/Answers");
const Leagues = require("../models/Leagues");
const Quinipolo = require("../models/Quinipolo");
const Teams = require("../models/Teams");
const User = require("../models/User");
const NotificationService = require("../services/NotificationService");
const {
  getQuinipoloAnswerByUsernameAndQuinipoloId,
} = require("./AnswerController");
const {
  updateLeaderboard,
  updateLeaderboardForEditedCorrection,
} = require("./LeaderboardController");
const { supabase } = require("../services/supabaseClient");

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

      // Send notifications to all users in the league
      await NotificationService.notifyNewQuinipolo(
        newQuinipolo._id,
        req.body.leagueId
      );

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
    const { data, error } = await supabase
      .from("quinipolos")
      .select("*")
      .eq("league_id", leagueId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send(`Internal Server Error ${req.params.leagueId}`);
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
    const userId = req.user.id; // Get from JWT/session

    // 1. Get all league_ids for this user
    const { data: userLeagues, error: leaguesError } = await supabase
      .from("user_leagues")
      .select("league_id")
      .eq("user_id", userId);

    if (leaguesError) {
      return res.status(500).json({ error: "Error fetching user leagues" });
    }

    const leagueIds = userLeagues.map((l) => l.league_id);

    if (leagueIds.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Get all quinipolos for these leagues
    const { data: quinipolos, error: quinipolosError } = await supabase
      .from("quinipolos")
      .select("*")
      .in("league_id", leagueIds);

    if (quinipolosError) {
      return res.status(500).json({ error: "Error fetching quinipolos" });
    }

    res.status(200).json(quinipolos);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
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
    if (!answers) {
      return res.status(200).json({ quinipolo, answers: { answers: [] } });
    }

    res.status(200).json({ quinipolo, answers });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
};

// Supabase-based version: Get quinipolos to answer for a user
const getQuinipolosToAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    // 1. Get all league_ids for this user
    const { data: userLeagues, error: leaguesError } = await supabase
      .from('user_leagues')
      .select('league_id')
      .eq('user_id', userId);
    if (leaguesError) {
      return res.status(500).json({ error: 'Error fetching user leagues' });
    }
    const leagueIds = userLeagues.map((l) => l.league_id);
    if (leagueIds.length === 0) {
      return res.status(200).json([]);
    }
    // 2. Get all quinipolos for these leagues
    const { data: quinipolos, error: quinipolosError } = await supabase
      .from('quinipolos')
      .select('*')
      .in('league_id', leagueIds);
    if (quinipolosError) {
      return res.status(500).json({ error: 'Error fetching quinipolos' });
    }
    // 3. Get all answers for this user
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('quinipolo_id')
      .eq('user_id', userId);
    if (answersError) {
      return res.status(500).json({ error: 'Error fetching answers' });
    }
    const answeredQuinipoloIds = new Set(answers.map(a => a.quinipolo_id));
    // 4. Mark each quinipolo with answered flag
    const quinipolosWithAnswerFlag = quinipolos.map(q => ({
      ...q,
      answered: answeredQuinipoloIds.has(q.id),
    }));
    res.status(200).json(quinipolosWithAnswerFlag);
  } catch (error) {
    console.error('Error fetching quinipolos to answer:', error);
    res.status(500).send('Internal Server Error');
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
        if (
          userAnswer.chosenWinner === correct.chosenWinner &&
          userAnswer.matchNumber !== 15
        ) {
          points += 1; // Basic point for correct winner
        }

        // Special handling for the 15th question
        if (userAnswer.matchNumber === 15) {
          correct15thGame =
            userAnswer.chosenWinner === correct.chosenWinner &&
            userAnswer.goalsHomeTeam === correct.goalsHomeTeam &&
            userAnswer.goalsAwayTeam === correct.goalsAwayTeam;
          if (correct15thGame) {
            points += 1;
          }
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
      nQuinipolosParticipated: userLeaderboardUpdate.nQuinipolosParticipated,
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

    // Call a function to process and update answers
    console.log("Correcting Quinipolo", id);
    const results = await processAndCorrectAnswers(id, answers);

    quinipolo.correctAnswers = answers;
    quinipolo.hasBeenCorrected = true;
    quinipolo.correctionDate = new Date();

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

/* const fixUserScores = async (req, res) => {
  const { leagueId } = req.params;

  // get all quinipolos from santfeliu league
  // get all answers from santfeliu league
  // Ignore and delete any answers from quinipolos that aren't in the database.
  // For each answer, find the 15th game and see who got it right.
  // Check if the result is the correct one. If it isn't correct, subtract one point from the user.
  // Update the leaderboard with the new scores.
  // Send the updated leaderboard as a response.

  try {
    const quinipolos = await Quinipolo.find({ leagueId: leagueId });
    const correctedQuinipolos = quinipolos.filter((q) => q.hasBeenCorrected);
    // console.log(correctedQuinipolos);
    const usersToReducePoints = [];
    // find answers from quinipolosId 67098e1d9ce8783992fba35e, 671253659ce8783992fc18d4 and 671c01ec9ce8783992fce4f7
    const answers = await Answer.find({
      quinipoloId: { $in: correctedQuinipolos.map((q) => q._id) },
    });
    // console.log(answers);

    // Ignore and delete any answers from quinipolos that aren't in the database.
    for (const answer of answers) {
      
      const getNewPoints = async (id) => {
        if (answer.quinipoloId == id) {
          const correct15thGame = quinipolos.filter((q) => q.id === id)[0]
            .correctAnswers[14];

          if (
            answer.answers[14].chosenWinner === correct15thGame.chosenWinner &&
            !(
              answer.answers[14].chosenWinner ===
                correct15thGame.chosenWinner &&
              answer.answers[14].goalsHomeTeam ===
                correct15thGame.goalsHomeTeam &&
              answer.answers[14].goalsAwayTeam === correct15thGame.goalsAwayTeam
            )
          ) {
            const user = usersToReducePoints.find(
              (u) => u.username === answer.username
            );

            if (user) {
              console.log("aaa");
              user.numberOfDeductedPoints += 1;
            } else {
              console.log("bbb");
              usersToReducePoints.push({
                username: answer.username,
                numberOfDeductedPoints: 1,
              });
            }
          }
        }
      };
    }
    console.log(usersToReducePoints);

    res.status(200).json(usersToReducePoints);

    // For each answer, find the 15th game and see who got it right.
  } catch (error) {
    console.error("Error fixing user scores:", error);
    res.status(500).send("Internal Server Error");
  }
}; */

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

  // fixUserScores,
};
