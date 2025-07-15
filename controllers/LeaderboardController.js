const mongoose = require("mongoose");
const Leaderboard = require("../models/Leaderboard");
const User = require("../models/User");
const { supabase } = require("../services/supabaseClient");

const updateLeaderboard = async (
  username,
  leagueId,
  points,
  fullCorrectQuinipolo
) => {
  try {
    const leagueLeaderboard = await Leaderboard.findOne({ leagueId });
    if (!leagueLeaderboard) {
      throw new Error("Leaderboard not found");
    }

    const user = await User.findOne({ username });
    if (!user) {
      throw new Error("User not found");
    }

    // Find participant in the leaderboard
    const participantEntry = leagueLeaderboard.participantsLeaderboard.find(
      (participant) => participant.username === username
    );

    if (participantEntry) {
      console.log("Updating existing entry");
      participantEntry.points += points;
      participantEntry.nQuinipolosParticipated += 1;
      if (fullCorrectQuinipolo) {
        participantEntry.fullCorrectQuinipolos += 1;
      }
    } else {
      console.log("Creating new entry");
      leagueLeaderboard.participantsLeaderboard.push({
        username,
        points,
        fullCorrectQuinipolos: fullCorrectQuinipolo ? 1 : 0,
        nQuinipolosParticipated: 1,
      });
    }

    // Save the updated leaderboard
    await leagueLeaderboard.save();

    const updatedEntry = leagueLeaderboard.participantsLeaderboard.find(
      (participant) => participant.username === username
    );

    const response = {
      username: user.username,
      totalPoints: updatedEntry.points,
      fullCorrectQuinipolos: updatedEntry.fullCorrectQuinipolos,
      changeInPoints: points,
      nQuinipolosParticipated: updatedEntry.nQuinipolosParticipated,
    };

    return response;
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    throw error;
  }
};

const getLeaderboardByLeagueId = async (req, res) => {
  const leagueId = req.params.leagueId;
  try {
    // 1. Get user_ids
    const { data: userLeagues, error: userLeaguesError } = await supabase
      .from('user_leagues')
      .select('user_id')
      .eq('league_id', leagueId);

    if (userLeaguesError) {
      return res.status(500).json({ error: userLeaguesError.message });
    }
    const userIds = userLeagues.map(u => u.user_id);

    let participantUsernames = [];
    if (userIds.length > 0) {
      // 2. Get usernames from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('username')
        .in('id', userIds);

      if (profilesError) {
        return res.status(500).json({ error: profilesError.message });
      }
      participantUsernames = profiles.map(p => p.username);
    }

    // 1. Get leaderboard rows for this league
    const { data: leaderboardRows, error } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('league_id', leagueId)
      .order('points', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // If no leaderboard exists, return an empty array (or create one if you want)
    res.status(200).json({
      leagueId,
      participantsLeaderboard: leaderboardRows || [],
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateLeaderboardForEditedCorrection = async (
  previousResults,
  newResults,
  leagueId
) => {
  try {
    // Ensure both arrays have the same length
    if (previousResults.length !== newResults.length) {
      throw new Error("Results arrays do not match in length");
    }

    const updates = [];

    // Iterate over the results
    for (let i = 0; i < previousResults.length; i++) {
      const prevResult = previousResults[i];
      const newResult = newResults[i];

      // Calculate the difference in points
      const pointsDifference = newResult.pointsEarned - prevResult.pointsEarned;
      const fullCorrectDifference =
        (newResult.correct15thGame ? 1 : 0) -
        (prevResult.correct15thGame ? 1 : 0);

      // Update the leaderboard for each user
      const leagueLeaderboard = await Leaderboard.findOne({
        leagueId,
      });
      if (!leagueLeaderboard) {
        throw new Error("Leaderboard not found");
      }

      const participantEntry = leagueLeaderboard.participantsLeaderboard.find(
        (participant) => participant.username === newResult.username
      );

      if (participantEntry) {
        participantEntry.points += pointsDifference;
        if (fullCorrectDifference !== 0) {
          participantEntry.fullCorrectQuinipolos += fullCorrectDifference;
        }
      } else {
        // If the user is not found in the leaderboard, create a new entry
        leagueLeaderboard.participantsLeaderboard.push({
          username: newResult.username,
          points: newResult.pointsEarned,
          fullCorrectQuinipolos: newResult.correct15thGame ? 1 : 0,
          nQuinipolosParticipated: 1,
        });
      }

      // Save the updated leaderboard
      await leagueLeaderboard.save();

      // Find the updated entry
      const updatedEntry = leagueLeaderboard.participantsLeaderboard.find(
        (participant) => participant.username === newResult.username
      );

      updates.push({
        username: updatedEntry.username,
        pointsEarned: pointsDifference,
        totalPoints: updatedEntry.points,
        correct15thGame: newResult.correct15thGame,
      });
    }

    console.log("Leaderboard updated successfully");
    return updates;
  } catch (error) {
    console.error("Error updating leaderboard for edited correction:", error);
    throw error;
  }
};

const createLeaderboard = async (leagueId) => {
  try {
    // Fetch all players in the league
    console.log("Creating leaderboard for league", leagueId);

    const players = await User.find({ leagues: leagueId });

    console.log("Players found:", players);
    if (!players) {
      throw new Error("No players found for the league");
    }

    players.forEach((player) => console.log(player));

    // Create the participantsLeaderboard array
    const participantsLeaderboard = players.map((player) => ({
      username: player.username,
      points: 0,
      fullCorrectQuinipolos: 0,
      nQuinipolosParticipated: 0,
    }));

    // Create the new leaderboard with the populated participantsLeaderboard
    const newLeaderboard = new Leaderboard({
      leagueId,
      participantsLeaderboard,
    });

    await newLeaderboard.save();
    console.log("Leaderboard created successfully");
    return newLeaderboard;
  } catch (error) {
    console.error("Error creating leaderboard:", error);
    throw error;
  }
};
module.exports = {
  updateLeaderboard,
  getLeaderboardByLeagueId,
  updateLeaderboardForEditedCorrection,
  createLeaderboard,
};
