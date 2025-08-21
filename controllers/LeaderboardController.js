const { supabase } = require("../services/supabaseClient");

const updateLeaderboard = async (
  username,
  leagueId,
  points,
  fullCorrectQuinipolo
) => {
  try {
    // Get user ID from username
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (userError || !user) {
      throw new Error("User not found");
    }

    // Check if leaderboard entry exists
    const { data: existingEntry, error: checkError } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("user_id", user.id)
      .eq("league_id", leagueId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "not found" error
      throw new Error("Error checking leaderboard entry");
    }

    if (existingEntry) {
      // Update existing entry
      console.log("Updating existing leaderboard entry");
      const { data: updatedEntry, error: updateError } = await supabase
        .from("leaderboard")
        .update({
          points: existingEntry.points + points,
          n_quinipolos_participated:
            existingEntry.n_quinipolos_participated + 1,
          full_correct_quinipolos:
            existingEntry.full_correct_quinipolos +
            (fullCorrectQuinipolo ? 1 : 0),
        })
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .select()
        .single();

      if (updateError) {
        throw new Error("Error updating leaderboard entry");
      }

      return {
        username: username,
        totalPoints: updatedEntry.points,
        fullCorrectQuinipolos: updatedEntry.full_correct_quinipolos,
        changeInPoints: points,
        nQuinipolosParticipated: updatedEntry.n_quinipolos_participated,
      };
    } else {
      // Create new entry
      console.log("Creating new leaderboard entry");
      const { data: newEntry, error: insertError } = await supabase
        .from("leaderboard")
        .insert({
          user_id: user.id,
          league_id: leagueId,
          points: points,
          n_quinipolos_participated: 1,
          full_correct_quinipolos: fullCorrectQuinipolo ? 1 : 0,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error("Error creating leaderboard entry");
      }

      return {
        username: username,
        totalPoints: newEntry.points,
        fullCorrectQuinipolos: newEntry.full_correct_quinipolos,
        changeInPoints: points,
        nQuinipolosParticipated: newEntry.n_quinipolos_participated,
      };
    }
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    throw error;
  }
};

/**
 * Example response:
 * {
 *   leagueId: "351a1949-f6c5-4940-ac70-1c7dd08e8b1a",
 *   participantsLeaderboard: [
 *     {
 *       username: "user1",
 *       points: 100,
 *       totalPoints: 100,
 *       nQuinipolosParticipated: 5,
 *       fullCorrectQuinipolos: 2
 *     },
 *     ...
 *   ]
 * }
 */
const getLeaderboardByLeagueId = async (req, res) => {
  const leagueId = req.params.leagueId;
  try {
    // 1. Get leaderboard rows for this league
    const { data: leaderboardRows, error: leaderboardError } = await supabase
      .from("leaderboard")
      .select(
        "user_id, points, n_quinipolos_participated, full_correct_quinipolos"
      )
      .eq("league_id", leagueId)
      .order("points", { ascending: false });

    if (leaderboardError) {
      return res.status(500).json({ error: leaderboardError.message });
    }

    if (!leaderboardRows || leaderboardRows.length === 0) {
      return res.status(200).json({ leagueId, participantsLeaderboard: [] });
    }

    // 2. Get usernames for all user_ids
    const userIds = leaderboardRows.map((row) => row.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    if (profilesError) {
      return res.status(500).json({ error: profilesError.message });
    }

    const userMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p.username])
    );

    // 3. Map leaderboard rows to include username
    const participantsLeaderboard = leaderboardRows.map((row) => ({
      username: userMap[row.user_id] || "unknown",
      points: row.points,
      totalPoints: row.points, // for compatibility with FE
      nQuinipolosParticipated: row.n_quinipolos_participated,
      fullCorrectQuinipolos: row.full_correct_quinipolos,
    }));

    return res.status(200).json({
      leagueId,
      participantsLeaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({ error: "Internal Server Error" });
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

      // Get user ID from username
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", newResult.username)
        .single();

      if (userError || !user) {
        console.error("User not found:", newResult.username);
        continue;
      }

      // Check if leaderboard entry exists
      const { data: existingEntry, error: checkError } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking leaderboard entry:", checkError);
        continue;
      }

      if (existingEntry) {
        // Update existing entry
        const { data: updatedEntry, error: updateError } = await supabase
          .from("leaderboard")
          .update({
            points: existingEntry.points + pointsDifference,
            full_correct_quinipolos:
              existingEntry.full_correct_quinipolos + fullCorrectDifference,
          })
          .eq("user_id", user.id)
          .eq("league_id", leagueId)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating leaderboard entry:", updateError);
          continue;
        }

        updates.push({
          username: newResult.username,
          pointsEarned: pointsDifference,
          totalPoints: updatedEntry.points,
          correct15thGame: newResult.correct15thGame,
        });
      } else {
        // Create new entry if user doesn't exist in leaderboard
        const { data: newEntry, error: insertError } = await supabase
          .from("leaderboard")
          .insert({
            user_id: user.id,
            league_id: leagueId,
            points: newResult.pointsEarned,
            n_quinipolos_participated: 1,
            full_correct_quinipolos: newResult.correct15thGame ? 1 : 0,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating leaderboard entry:", insertError);
          continue;
        }

        updates.push({
          username: newResult.username,
          pointsEarned: newResult.pointsEarned,
          totalPoints: newEntry.points,
          correct15thGame: newResult.correct15thGame,
        });
      }
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
