/* const Leaderboard = require("../models/Leaderboard");
const Quinipolo = require("../models/Quinipolo");
const Answers = require("../models/Answers");
const { updateLeaderboard } = require("./LeaderboardController");

const recalculateLeaderboardScores = async (req, res) => {
  const leagueId = req.params.leagueId;

  try {
    // Retrieve all Quinipolos for the league
    const quinipolos = await Quinipolo.find({ leagueId });
    if (!quinipolos || quinipolos.length === 0) {
      throw new Error("No Quinipolos found for this league.");
    }

    // Initialize a leaderboard object to accumulate scores
    const leaderboard = {};

    // Loop through each Quinipolo and process each user's answers
    for (const quinipolo of quinipolos) {
      const answers = await Answers.find({ quinipoloId: quinipolo._id });
      const correctedAnswers = quinipolo.correctAnswers; // These are the official correct answers for comparison

      for (const answer of answers) {
        let points = 0;
        let correct15thGame = false;

        // Calculate points based on corrected scoring rules
        answer.answers.forEach((userAnswer) => {
          const correctAnswer = correctedAnswers.find(
            (c) => c.matchNumber === userAnswer.matchNumber
          );

          if (
            correctAnswer &&
            userAnswer.chosenWinner === correctAnswer.chosenWinner
          ) {
            points += 1;
          }

          // Special check for 15th question's full correctness
          if (userAnswer.matchNumber === 15) {
            correct15thGame =
              userAnswer.goalsHomeTeam === correctAnswer.goalsHomeTeam &&
              userAnswer.goalsAwayTeam === correctAnswer.goalsAwayTeam;
          }
        });

        const fullCorrectQuinipolo = points === 15 && correct15thGame;
        const correctedPoints = fullCorrectQuinipolo ? points : points - 1; // Subtract a point if the 15th question isn't fully correct

        // Accumulate points in the leaderboard object
        if (!leaderboard[answer.username]) {
          leaderboard[answer.username] = {
            username: answer.username,
            totalPoints: 0,
            fullCorrectQuinipolos: 0,
          };
        }

        // Update the leaderboard for this user
        leaderboard[answer.username].totalPoints += correctedPoints;
        if (fullCorrectQuinipolo) {
          leaderboard[answer.username].fullCorrectQuinipolos += 1;
        }
      }
    }

    // Convert leaderboard object to an array and sort it by totalPoints in descending order
    const sortedLeaderboard = Object.values(leaderboard).sort(
      (a, b) => b.totalPoints - a.totalPoints
    );

    console.log("New leaderboard:", sortedLeaderboard);

    // Send the sorted leaderboard as a response
    res.status(200).json(sortedLeaderboard);
  } catch (error) {
    console.error("Error recalculating leaderboard scores:", error);
    res.status(500).json({
      error: "An error occurred while recalculating leaderboard scores.",
    });
  }
};
const calculatePointsToSubtract = async (req, res) => {
  const leagueId = req.params.leagueId;

  try {
    // Retrieve all Quinipolos for the league
    const quinipolos = await Quinipolo.find({ leagueId });
    if (!quinipolos || quinipolos.length === 0) {
      throw new Error("No Quinipolos found for this league.");
    }

    // Initialize a subtraction object to accumulate points to subtract per user
    const pointsToSubtract = {};

    // Loop through each Quinipolo and process each user's answers
    console.log("STARTING TO CALCULATE POINTS TO SUBTRACT");
    console.log(quinipolos.length);
    for (const quinipolo of quinipolos) {
      if (new Date(quinipolo.creationDate) < new Date("2024-09-20")) {
        console.log("Skipped quinipolo is older than 2024-09-20");
      } else {
        const answers = await Answers.find({ quinipoloId: quinipolo._id });
        const correctedAnswers = quinipolo.correctAnswers; // These are the official correct answers for comparison
        for (const answer of answers) {
          let points = 0;
          let correct15thGame = false;

          // Calculate points based on corrected scoring rules

          answer.answers.forEach((userAnswer) => {
            const correctAnswer = correctedAnswers.find(
              (c) => c.matchNumber === userAnswer.matchNumber
            );

            if (
              correctAnswer &&
              userAnswer.chosenWinner === correctAnswer.chosenWinner
            ) {
              points += 1;
            }

            // Special check for 15th question's full correctness
            if (userAnswer.matchNumber === 15) {
              correct15thGame =
                userAnswer.goalsHomeTeam === correctAnswer.goalsHomeTeam &&
                userAnswer.goalsAwayTeam === correctAnswer.goalsAwayTeam &&
                userAnswer.chosenWinner === correctAnswer.chosenWinner;

              // Log details about the 15th question for debugging
              console.log(
                `User: ${answer.username}, Match 15 - User's Answer: ${userAnswer.goalsHomeTeam}:${userAnswer.goalsAwayTeam}, Correct Answer: ${correctAnswer.goalsHomeTeam}:${correctAnswer.goalsAwayTeam}, Full Correct: ${correct15thGame}`
              );
            }
          });

          // Calculate if points should be subtracted
          if (!correct15thGame && points === 15) {
            // This means the 15th question was partially correct, so one point should be subtracted
            if (!pointsToSubtract[answer.username]) {
              pointsToSubtract[answer.username] = 0;
            }
            pointsToSubtract[answer.username] += 1; // Accumulate the points to subtract

            console.log(
              `Point to be subtracted for user ${
                answer.username
              }. Total to subtract: ${pointsToSubtract[answer.username]}`
            );
          }
        }
      }
    }
    console.log("FINISHED CALCULATING POINTS TO SUBTRACT");


    // Send the results as a response
    res.status(200).json(pointsToSubtract);
  } catch (error) {
    console.error("Error calculating points to subtract:", error);
    res.status(500).json({
      error: "An error occurred while calculating points to subtract.",
    });
  }
};

module.exports = {
  calculatePointsToSubtract,
};

const previewLeaderboardCorrections = async (req, res) => {
  const leagueId = req.params.leagueId;
  try {
    // Retrieve all Quinipolos for the league
    const quinipolos = await Quinipolo.find({ leagueId });
    if (!quinipolos) {
      throw new Error("No Quinipolos found for this league.");
    }

    // Store changes to preview
    const changesPreview = [];

    // Loop through each Quinipolo and process each user's answers
    for (const quinipolo of quinipolos) {
      const answers = await Answers.find({ quinipoloId: quinipolo._id });
      const correctedAnswers = quinipolo.correctAnswers; // These are the official correct answers for comparison

      for (const answer of answers) {
        let points = 0;
        let correct15thGame = false;

        // Calculate points based on corrected scoring rules
        answer.answers.forEach((userAnswer) => {
          const correctAnswer = correctedAnswers.find(
            (c) => c.matchNumber === userAnswer.matchNumber
          );

          if (
            correctAnswer &&
            userAnswer.chosenWinner === correctAnswer.chosenWinner
          ) {
            points += 1;
          }

          // Special check for 15th question's full correctness
          if (userAnswer.matchNumber === 15) {
            correct15thGame =
              userAnswer.goalsHomeTeam === correctAnswer.goalsHomeTeam &&
              userAnswer.goalsAwayTeam === correctAnswer.goalsAwayTeam;
          }
        });

        const fullCorrectQuinipolo = points === 15 && correct15thGame;
        const correctedPoints = fullCorrectQuinipolo ? points : points - 1; // Subtract the point if the 15th question isn't fully correct

        // Prepare change entry without updating the leaderboard yet
        changesPreview.push({
          username: answer.username,
          leagueId,
          previousPoints: answer.points || 0, // assuming points were stored previously
          newPoints: correctedPoints,
          fullCorrectQuinipolo,
        });
      }
    }

    // Log all changes
    console.log("Preview of leaderboard corrections:", changesPreview);

    return changesPreview; // Return changes preview for further action if needed
  } catch (error) {
    console.error("Error previewing leaderboard corrections:", error);
    throw error;
  }
};

module.exports = {
  recalculateLeaderboardScores,
  previewLeaderboardCorrections,
  calculatePointsToSubtract,
};
 */
