const { supabase } = require("../services/supabaseClient");
const {
  fetchAllEq,
  fetchProfilesByIds,
  selectInBatches,
} = require("../services/batchedQuery");

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
      const currentPoints = existingEntry.points ?? 0;
      const currentParticipated = existingEntry.n_quinipolos_participated ?? 0;
      const currentFullCorrect = existingEntry.full_correct_quinipolos ?? 0;
      const { data: updatedEntry, error: updateError } = await supabase
        .from("leaderboard")
        .update({
          points: currentPoints + points,
          n_quinipolos_participated: currentParticipated + 1,
          full_correct_quinipolos:
            currentFullCorrect + (fullCorrectQuinipolo ? 1 : 0),
        })
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .select()
        .single();

      if (updateError) {
        console.error("Supabase update error (leaderboard)", updateError);
        throw new Error(
          `Error updating leaderboard entry: ${
            updateError.message || updateError
          }`
        );
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
 *   leagueId: "<league-uuid>",
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
// Full league leaderboard with usernames. Throws if the profile lookup fails
// so callers cannot turn a transport error into a board of "unknown" names.
// A username is "unknown" only when that profile row is actually missing.
async function loadParticipantsLeaderboard(leagueId) {
  const rows = await fetchAllEq(supabase, {
    table: "leaderboard",
    columns:
      "user_id, points, n_quinipolos_participated, full_correct_quinipolos",
    column: "league_id",
    value: leagueId,
    order: [
      { column: "points", ascending: false },
      { column: "user_id", ascending: true },
    ],
  });
  if (rows.length === 0) return [];

  const profiles = await fetchProfilesByIds(
    supabase,
    rows.map((row) => row.user_id)
  );
  const usernames = new Map(
    profiles.map((profile) => [profile.id, profile.username])
  );
  return rows.map((row) => ({
    username: usernames.get(row.user_id) || "unknown",
    points: row.points,
    totalPoints: row.points, // for compatibility with FE
    nQuinipolosParticipated: row.n_quinipolos_participated,
    fullCorrectQuinipolos: row.full_correct_quinipolos,
  }));
}

const getLeaderboardByLeagueId = async (req, res) => {
  const leagueId = req.params.leagueId;
  try {
    const participantsLeaderboard = await loadParticipantsLeaderboard(leagueId);
    return res.status(200).json({
      leagueId,
      participantsLeaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({
      error: error?.message || "Internal Server Error",
    });
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
  loadParticipantsLeaderboard,
  updateLeaderboardForEditedCorrection,
  createLeaderboard,
};

// New batched update to minimize per-user roundtrips
/**
 * Batch update leaderboard entries for a given league.
 * userDeltas: Array of { user_id, username?, pointsDelta, fullCorrectDelta, participatedDelta }
 * Returns: Map username -> { username, totalPoints, nQuinipolosParticipated, fullCorrectQuinipolos, changeInPoints }
 */
const updateLeaderboardBatch = async (leagueId, userDeltas) => {
  try {
    if (!userDeltas || userDeltas.length === 0) return [];

    const uniqueUserIds = Array.from(new Set(userDeltas.map((u) => u.user_id)));

    // Existing rows, batched. One `.in(user_id)` of every answerer overflows
    // the request URL on a large league and aborts the correction.
    const existingRows = await selectInBatches(supabase, {
      table: "leaderboard",
      columns:
        "user_id, points, n_quinipolos_participated, full_correct_quinipolos",
      column: "user_id",
      ids: uniqueUserIds,
      refine: (query) => query.eq("league_id", leagueId),
    });

    const existingByUserId = new Map(
      (existingRows || []).map((r) => [r.user_id, r])
    );

    // Prepare work items with computed new values
    const updates = [];
    const inserts = [];

    for (const delta of userDeltas) {
      const current = existingByUserId.get(delta.user_id);
      if (current) {
        updates.push({
          user_id: delta.user_id,
          points: (current.points ?? 0) + (delta.pointsDelta ?? 0),
          n_quinipolos_participated:
            (current.n_quinipolos_participated ?? 0) +
            (delta.participatedDelta ?? 0),
          full_correct_quinipolos:
            (current.full_correct_quinipolos ?? 0) +
            (delta.fullCorrectDelta ?? 0),
        });
      } else {
        inserts.push({
          user_id: delta.user_id,
          league_id: leagueId,
          points: delta.pointsDelta ?? 0,
          n_quinipolos_participated: delta.participatedDelta ?? 0,
          full_correct_quinipolos: delta.fullCorrectDelta ?? 0,
        });
      }
    }

    // Execute DB writes; we need per-row updates because values differ per user
    const results = [];

    // Inserts can be done in one call
    if (inserts.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("leaderboard")
        .insert(inserts)
        .select(
          "user_id, points, n_quinipolos_participated, full_correct_quinipolos"
        );
      if (insertError) throw insertError;
      results.push(...(inserted || []));
    }

    // Updates: run concurrently with a reasonable fanout
    const concurrency = 10;
    for (let i = 0; i < updates.length; i += concurrency) {
      const slice = updates.slice(i, i + concurrency);
      // Per-row update calls because each has distinct values
      const promises = slice.map((row) =>
        supabase
          .from("leaderboard")
          .update({
            points: row.points,
            n_quinipolos_participated: row.n_quinipolos_participated,
            full_correct_quinipolos: row.full_correct_quinipolos,
          })
          .eq("league_id", leagueId)
          .eq("user_id", row.user_id)
          .select(
            "user_id, points, n_quinipolos_participated, full_correct_quinipolos"
          )
          .single()
      );
      const res = await Promise.allSettled(promises);
      for (const r of res) {
        if (r.status === "fulfilled" && r.value && r.value.data) {
          results.push(r.value.data);
        }
      }
    }

    return results;
  } catch (error) {
    console.error("Error in updateLeaderboardBatch:", error);
    throw error;
  }
};

module.exports.updateLeaderboardBatch = updateLeaderboardBatch;
