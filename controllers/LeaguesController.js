// controllers/LeaguesController.js
const Leaderboard = require("../models/Leaderboard");
const User = require("../models/User");
const { supabase } = require("../services/supabaseClient");
const { GLOBAL_LEAGUE_ID } = require("../config");

const getAllLeaguesData = async (req, res) => {
  try {
    const result = await buildAllLeaguesResponse();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching leagues:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Helper to build enriched leagues list
const buildAllLeaguesResponse = async () => {
  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("*");
  if (leaguesError) throw leaguesError;

  const result = await Promise.all(
    leagues.map(async (league) => {
      // Fetch user_leagues with roles
      const { data: userLeagues } = await supabase
        .from("user_leagues")
        .select("user_id, role")
        .eq("league_id", league.id);

      let participants = [];
      if (userLeagues && userLeagues.length > 0) {
        const userIds = userLeagues.map((u) => u.user_id);
        // Fetch usernames
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);

        if (profiles) {
          participants = userLeagues.map((ul) => ({
            user_id: ul.user_id,
            username:
              profiles.find((p) => p.id === ul.user_id)?.username || "unknown",
            role: ul.role,
          }));
        }
      }

      // Petitions from league_petitions table
      let participantPetitions = [];
      let moderatorPetitions = [];
      const { data: petitionsData } = await supabase
        .from("league_petitions")
        .select("id, user_id, username, status, type, date")
        .eq("league_id", league.id);
      if (petitionsData) {
        participantPetitions = petitionsData
          .filter((p) => p.type === "participant")
          .map((p) => ({
            _id: p.id,
            userId: p.user_id,
            username: p.username,
            status: p.status,
            date: p.date,
          }));
        moderatorPetitions = petitionsData
          .filter((p) => p.type === "moderator")
          .map((p) => ({
            _id: p.id,
            userId: p.user_id,
            username: p.username,
            status: p.status,
            date: p.date,
          }));
      }

      return {
        ...league,
        participants,
        participantsCount: participants.length,
        participantPetitions,
        moderatorPetitions,
      };
    })
  );

  return result;
};

const getLeagueData = async (req, res) => {
  try {
    const leagueId = req.params.leagueId;

    // 1. Get league info with creator details
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select(
        `
        *,
        creator:profiles!leagues_created_by_fkey(username, full_name)
      `
      )
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) {
      return res.status(404).json({ error: "League not found" });
    }

    // FE will handle hiding special leagues like "Test" for non-moderators

    // 2. Get user_ids and roles from user_leagues
    const { data: userLeagues, error: userLeaguesError } = await supabase
      .from("user_leagues")
      .select("user_id, role")
      .eq("league_id", leagueId);

    if (userLeaguesError) {
      return res.status(500).json({ error: userLeaguesError.message });
    }
    const userIds = userLeagues.map((u) => u.user_id);

    let participants = [];
    if (userIds.length > 0) {
      // 3. Get usernames from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      if (profilesError) {
        return res.status(500).json({ error: profilesError.message });
      }
      participants = userLeagues.map((ul) => ({
        user_id: ul.user_id,
        username:
          profiles.find((p) => p.id === ul.user_id)?.username || "unknown",
        role: ul.role,
      }));
    }

    // 4. Get moderator petitions and participant petitions from league_petitions table
    let participantPetitions = [];
    let moderatorPetitions = [];
    const { data: petitionsData } = await supabase
      .from("league_petitions")
      .select("id, user_id, username, status, type, date")
      .eq("league_id", leagueId);
    if (petitionsData) {
      participantPetitions = petitionsData
        .filter((p) => p.type === "participant")
        .map((p) => ({
          _id: p.id,
          userId: p.user_id,
          username: p.username,
          status: p.status,
          date: p.date,
        }));
      moderatorPetitions = petitionsData
        .filter((p) => p.type === "moderator")
        .map((p) => ({
          _id: p.id,
          userId: p.user_id,
          username: p.username,
          status: p.status,
          date: p.date,
        }));
    }

    // 5. Get quinipolos to answer and correct
    const { data: quinipolosToAnswer, error: quinipolosError } = await supabase
      .from("quinipolos")
      .select("*")
      .eq("league_id", leagueId)
      .eq("has_been_corrected", false)
      .eq("is_deleted", false)
      .gte("end_date", new Date().toISOString());

    const { data: leaguesToCorrect, error: correctError } = await supabase
      .from("quinipolos")
      .select("*")
      .eq("league_id", leagueId)
      .eq("has_been_corrected", false)
      .eq("is_deleted", false)
      .lt("end_date", new Date().toISOString());

    res.status(200).json({
      ...league,
      participants,
      participantPetitions,
      moderatorPetitions,
      quinipolosToAnswer: quinipolosToAnswer || [],
      leaguesToCorrect: leaguesToCorrect || [],
      moderatorArray: participants
        .filter((p) => p.role === "moderator")
        .map((p) => p.username),
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

// create new league - Updated for Supabase and Stripe integration
const createNewLeague = async (req, res) => {
  try {
    const { leagueName, isPrivate, tier, userId } = req.body;

    // Accept either `name` or `leagueName` for backwards compatibility
    if (!leagueName || !tier || !userId) {
      return res
        .status(400)
        .json({ error: "Name or leagueName, tier, and userId are required" });
    }

    // Check if user has permission to create leagues
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    // For now, allow any user to create a league (payment will be handled by Stripe)
    // In the future, you might want to check if user has moderator role or active subscription

    // Create the league in Supabase (align with DB: league_name)
    const { data: newLeague, error: leagueError } = await supabase
      .from("leagues")
      .insert({
        league_name: leagueName,
        description: req.body.description || null,
        is_private: isPrivate || false,
        tier: tier,
        created_by: userId,
        status: "active",
      })
      .select()
      .single();

    if (leagueError) {
      console.error("Error creating league:", leagueError);
      return res.status(500).json({ error: "Failed to create league" });
    }

    // Add creator as moderator to the league
    const { error: userLeagueError } = await supabase
      .from("user_leagues")
      .insert({
        user_id: userId,
        league_id: newLeague.id,
        role: "moderator",
      });

    if (userLeagueError) {
      console.error("Error adding user to league:", userLeagueError);
    }

    // Create leaderboard entry for the creator
    const { error: leaderboardError } = await supabase
      .from("leaderboard")
      .insert({
        user_id: userId,
        league_id: newLeague.id,
        points: 0,
        full_correct_quinipolos: 0,
        n_quinipolos_participated: 0,
      });

    if (leaderboardError) {
      console.error("Error creating leaderboard entry:", leaderboardError);
    }

    res.status(201).json({
      id: newLeague.id,
      league_name: newLeague.league_name,
      isPrivate: newLeague.is_private,
      tier: newLeague.tier,
      createdBy: newLeague.created_by,
      status: newLeague.status,
    });
  } catch (error) {
    console.error("Error creating league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const updateLeague = async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    const { leagueName, description } = req.body;

    // Update the league in Supabase
    const { data: updatedLeague, error: updateError } = await supabase
      .from("leagues")
      .update({
        league_name: leagueName,
        description: description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leagueId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating league:", updateError);
      return res.status(500).json({ error: "Failed to update league" });
    }

    res.status(200).json(updatedLeague);
  } catch (error) {
    console.error("Error updating league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const deleteLeague = async (req, res) => {
  try {
    const leagueId = req.params.leagueId;

    // Delete the league from Supabase
    const { error: deleteError } = await supabase
      .from("leagues")
      .delete()
      .eq("id", leagueId);

    if (deleteError) {
      console.error("Error deleting league:", deleteError);
      return res.status(500).json({ error: "Failed to delete league" });
    }

    res.status(200).json({ message: "League deleted successfully" });
  } catch (error) {
    console.error("Error deleting league:", error);
    res.status(500).send("Internal Server Error");
  }
};

const joinLeague = async (req, res) => {
  try {
    const { leagueId, username } = req.body;
    console.log("Joining league", username, leagueId);

    // Get user ID from username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (profileError) {
      console.error("Error finding user profile:", profileError);
      return res.status(404).json({ error: "User not found" });
    }

    // Use the Supabase version to join the league
    await joinLeagueByIdSupabase(leagueId, profile.id, username);

    // Get updated league data
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("*")
      .eq("id", leagueId)
      .single();

    if (leagueError) {
      console.error("Error fetching league:", leagueError);
      return res.status(500).json({ error: "Error fetching league" });
    }

    res.status(200).json(league);
  } catch (error) {
    console.error("Error joining league:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Old MongoDB-based joinLeagueById function - deprecated
// const joinLeagueById = async (leagueId, username) => {
//   try {
//     console.log("Joining league (by Id)", username, leagueId);
//     // first find league, then save the user to the league
//     const league = await Leagues.findOne({ leagueId: leagueId });
//     checkLeaguesAndUpdateUser(leagueId, username);

//     // check if user is already in the league
//     if (league.participants.includes(username)) {
//       return;
//     }

//     const leaderboard = await Leaderboard.findOne({
//       leagueId: leagueId,
//     });

//     // if participant is in leaderboard
//     if (
//       leaderboard.participantsLeaderboard.find(
//         (participant) => participant.username === username
//       )
//     ) {
//       return;
//     }

//     leaderboard.participantsLeaderboard.push({
//       username: username,
//       points: 0,
//       fullCorrectQuinipolos: 0,
//       nQuinipolosParticipated: 0,
//     });
//     await leaderboard.save();

//     league.participants.push(username);
//     await league.save();
//   } catch (error) {
//     console.error("Error joining league:", error);
//   }
// };

// Check if a league exists by ID. Returns league id if exists, null if not found, false on error
const checkLeagueExistsById = async (leagueId) => {
  try {
    const { data: league, error } = await supabase
      .from("leagues")
      .select("id")
      .eq("id", leagueId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // not found
      }
      console.error("Error checking league by id:", error);
      return false;
    }

    return league.id;
  } catch (error) {
    console.error("Error checking league existence:", error);
    return false;
  }
};

// Wrapper: check if the Global league exists by ID
const ensureGlobalLeagueExists = async () => {
  return await checkLeagueExistsById(GLOBAL_LEAGUE_ID);
};

// Supabase version of joinLeagueById
const joinLeagueByIdSupabase = async (leagueId, userId, username) => {
  try {
    console.log("Joining league (Supabase)", username, leagueId);

    // Ensure global league exists if joining global league
    if (leagueId === "global") {
      const globalLeagueId = await ensureGlobalLeagueExists();
      if (!globalLeagueId) {
        console.error("Failed to ensure global league exists");
        return;
      }
      leagueId = globalLeagueId; // Use the actual UUID instead of "global"
    }

    // Check if user is already in the league
    const { data: existingUserLeague, error: checkError } = await supabase
      .from("user_leagues")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", leagueId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing user league:", checkError);
      return;
    }

    if (existingUserLeague) {
      console.log("User already in league");
      return;
    }

    // Add user to user_leagues table
    const { error: userLeagueError } = await supabase
      .from("user_leagues")
      .insert({
        user_id: userId,
        league_id: leagueId,
        role: "participant",
      });

    if (userLeagueError) {
      console.error("Error adding user to league:", userLeagueError);
      return;
    }

    // Check if user already has a leaderboard entry
    const { data: existingLeaderboard, error: leaderboardCheckError } =
      await supabase
        .from("leaderboard")
        .select("*")
        .eq("user_id", userId)
        .eq("league_id", leagueId)
        .single();

    if (leaderboardCheckError && leaderboardCheckError.code !== "PGRST116") {
      console.error(
        "Error checking existing leaderboard:",
        leaderboardCheckError
      );
      return;
    }

    if (existingLeaderboard) {
      console.log("User already has leaderboard entry");
      return;
    }

    // Add user to leaderboard
    const { error: leaderboardError } = await supabase
      .from("leaderboard")
      .insert({
        user_id: userId,
        league_id: leagueId,
        points: 0,
        n_quinipolos_participated: 0,
        full_correct_quinipolos: 0,
      });

    if (leaderboardError) {
      console.error("Error adding user to leaderboard:", leaderboardError);
      return;
    }

    console.log("Successfully joined league:", leagueId, "for user:", username);
  } catch (error) {
    console.error("Error joining league (Supabase):", error);
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

// Helper to map petition type to Supabase JSONB column name
const getPetitionColumnName = (petitionType) =>
  petitionType === "moderator"
    ? "moderator_petitions"
    : "participant_petitions";

// Build league response similar to getLeagueData
const buildLeagueResponse = async (leagueId) => {
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select(
      `
        *,
        creator:profiles!leagues_created_by_fkey(username, full_name)
      `
    )
    .eq("id", leagueId)
    .single();

  if (leagueError || !league)
    throw leagueError || new Error("League not found");

  const { data: userLeagues } = await supabase
    .from("user_leagues")
    .select("user_id, role")
    .eq("league_id", leagueId);

  const userIds = (userLeagues || []).map((u) => u.user_id);
  let profiles = [];
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    profiles = profilesData || [];
  }

  const participants = (userLeagues || []).map((ul) => ({
    user_id: ul.user_id,
    username: profiles.find((p) => p.id === ul.user_id)?.username || "unknown",
    role: ul.role,
  }));

  // Fetch petitions from league_petitions table (align with getLeagueData)
  let participantPetitions = [];
  let moderatorPetitions = [];
  const { data: petitionsData, error: petitionsError } = await supabase
    .from("league_petitions")
    .select("id, user_id, username, status, type, date")
    .eq("league_id", leagueId);
  if (!petitionsError && petitionsData) {
    participantPetitions = petitionsData
      .filter((p) => p.type === "participant")
      .map((p) => ({
        _id: p.id,
        userId: p.user_id,
        username: p.username,
        status: p.status,
        date: p.date,
      }));
    moderatorPetitions = petitionsData
      .filter((p) => p.type === "moderator")
      .map((p) => ({
        _id: p.id,
        userId: p.user_id,
        username: p.username,
        status: p.status,
        date: p.date,
      }));
  }

  const { data: quinipolosToAnswer } = await supabase
    .from("quinipolos")
    .select("*")
    .eq("league_id", leagueId)
    .eq("has_been_corrected", false)
    .eq("is_deleted", false)
    .gte("end_date", new Date().toISOString());

  const { data: leaguesToCorrect } = await supabase
    .from("quinipolos")
    .select("*")
    .eq("league_id", leagueId)
    .eq("has_been_corrected", false)
    .eq("is_deleted", false)
    .lt("end_date", new Date().toISOString());

  return {
    ...league,
    participants,
    participantPetitions,
    moderatorPetitions,
    quinipolosToAnswer: quinipolosToAnswer || [],
    leaguesToCorrect: leaguesToCorrect || [],
    moderatorArray: participants
      .filter((p) => p.role === "moderator")
      .map((p) => p.username),
  };
};

const createPetition = async (req, res, petitionType) => {
  try {
    const leagueId = req.params.leagueId;
    const { userId, username } = req.body;

    // Ensure league exists
    const { error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("id", leagueId)
      .single();
    if (leagueError) {
      if (leagueError.code === "PGRST116") {
        return res.status(404).json({ error: "League not found" });
      }
      console.error("Supabase error fetching league:", leagueError);
      return res
        .status(500)
        .json({ error: leagueError?.message || "Error fetching league" });
    }

    // Check existing pending
    const { data: existingPending, error: pendingError } = await supabase
      .from("league_petitions")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .eq("type", petitionType)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingError && pendingError.code !== "PGRST116") {
      console.error("Error checking pending petition:", pendingError);
      return res.status(500).send("Internal Server Error");
    }
    if (existingPending) {
      return res.status(400).send("User already has a pending petition");
    }

    // Flip cancelled to pending if exists
    const { data: cancelled, error: cancelledError } = await supabase
      .from("league_petitions")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .eq("type", petitionType)
      .eq("status", "cancelled")
      .maybeSingle();
    if (cancelledError && cancelledError.code !== "PGRST116") {
      console.error("Error checking cancelled petition:", cancelledError);
      return res.status(500).send("Internal Server Error");
    }

    if (cancelled) {
      const { error: updateErr } = await supabase
        .from("league_petitions")
        .update({ status: "pending", date: new Date().toISOString() })
        .eq("id", cancelled.id);
      if (updateErr) {
        console.error("Error updating petition to pending:", updateErr);
        return res.status(500).send("Internal Server Error");
      }
    } else {
      const { error: insertErr } = await supabase
        .from("league_petitions")
        .insert({
          league_id: leagueId,
          user_id: userId,
          username,
          type: petitionType,
          status: "pending",
          date: new Date().toISOString(),
        });
      if (insertErr) {
        console.error("Error creating petition:", insertErr);
        return res.status(500).send("Internal Server Error");
      }
    }

    // For LeagueList flow, return full list
    const listResponse = await buildAllLeaguesResponse();
    return res.status(200).json(listResponse);
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
  try {
    const leagueId = req.params.leagueId;
    const petitionId = req.params.petitionId;

    // Fetch petition row
    const { data: petitionRow, error: petitionError } = await supabase
      .from("league_petitions")
      .select("id, user_id, username, type, status")
      .eq("id", petitionId)
      .eq("league_id", leagueId)
      .maybeSingle();
    if (petitionError && petitionError.code !== "PGRST116") {
      console.error("Error fetching petition:", petitionError);
      return res.status(500).send("Internal Server Error");
    }
    if (!petitionRow) {
      return res.status(404).json({ error: "Petition not found" });
    }

    // Update status
    const { error: updateError } = await supabase
      .from("league_petitions")
      .update({ status: newStatus })
      .eq("id", petitionId)
      .eq("league_id", leagueId);
    if (updateError) {
      console.error(`Error updating ${petitionType} petition:`, updateError);
      return res.status(500).send("Internal Server Error");
    }

    // If accepted, update user_leagues/leaderboard roles or membership
    if (addToArray && newStatus === "accepted") {
      // Ensure user is in user_leagues
      const { data: existingUserLeague, error: checkError } = await supabase
        .from("user_leagues")
        .select("*")
        .eq("user_id", petitionRow.user_id)
        .eq("league_id", leagueId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking user_leagues:", checkError);
      }

      const roleToSet =
        petitionType === "moderator" ? "moderator" : "participant";

      if (existingUserLeague) {
        // Update role if needed
        if (existingUserLeague.role !== roleToSet) {
          const { error: roleUpdateError } = await supabase
            .from("user_leagues")
            .update({ role: roleToSet })
            .eq("user_id", petitionRow.user_id)
            .eq("league_id", leagueId);
          if (roleUpdateError) {
            console.error("Error updating role:", roleUpdateError);
          }
        }
      } else {
        // Insert membership
        const { error: insertError } = await supabase
          .from("user_leagues")
          .insert({
            user_id: petitionRow.user_id,
            league_id: leagueId,
            role: roleToSet,
          });
        if (insertError) {
          console.error("Error inserting user_leagues:", insertError);
        }
      }

      // Ensure leaderboard entry exists
      const { data: existingLeaderboard, error: leaderboardCheckError } =
        await supabase
          .from("leaderboard")
          .select("*")
          .eq("user_id", petitionRow.user_id)
          .eq("league_id", leagueId)
          .single();
      if (leaderboardCheckError && leaderboardCheckError.code !== "PGRST116") {
        console.error("Error checking leaderboard:", leaderboardCheckError);
      }
      if (!existingLeaderboard) {
        const { error: leaderboardError } = await supabase
          .from("leaderboard")
          .insert({
            user_id: petitionRow.user_id,
            league_id: leagueId,
            points: 0,
            n_quinipolos_participated: 0,
            full_correct_quinipolos: 0,
          });
        if (leaderboardError) {
          console.error("Error inserting leaderboard:", leaderboardError);
        }
      }
    }

    const response = await buildLeagueResponse(leagueId);
    return res.status(200).json(response);
  } catch (error) {
    console.error(`Error updating ${petitionType} petition:`, error);
    res.status(500).send("Internal Server Error");
  }
};

const getPetitions = async (req, res, petitionType) => {
  try {
    const leagueId = req.params.leagueId;
    // Ensure league exists
    const { error: leagueError } = await supabase
      .from("leagues")
      .select("id")
      .eq("id", leagueId)
      .single();
    if (leagueError) {
      if (leagueError.code === "PGRST116") {
        return res.status(404).json({ error: "League not found" });
      }
      console.error("Supabase error fetching league:", leagueError);
      return res
        .status(500)
        .json({ error: leagueError?.message || "Error fetching league" });
    }
    const { data, error } = await supabase
      .from("league_petitions")
      .select("id, user_id, username, status, type, date")
      .eq("league_id", leagueId)
      .eq("type", petitionType);
    if (error) {
      console.error("Error fetching petitions:", error);
      return res.status(500).send("Internal Server Error");
    }
    const mapped = (data || []).map((p) => ({
      _id: p.id,
      userId: p.user_id,
      username: p.username,
      status: p.status,
      date: p.date,
    }));
    res.status(200).json(mapped);
  } catch (error) {
    console.error(`Error fetching ${petitionType} petitions:`, error);
    res.status(500).send("Internal Server Error");
  }
};

// PETITIONS
const createModerationPetition = (req, res) =>
  createPetition(req, res, "moderator");
const createParticipantPetition = (req, res) =>
  createPetition(req, res, "participant");

// MODERATION PETITIONS
const acceptModerationPetition = (req, res) =>
  updatePetitionStatus(req, res, "moderator", "accepted", true);

const rejectModerationPetition = (req, res) =>
  updatePetitionStatus(req, res, "moderator", "rejected", false);

const cancelModerationPetition = (req, res) =>
  updatePetitionStatus(req, res, "moderator", "cancelled", false);

// PARTICIPANT PETITIONS
const acceptParticipantPetition = (req, res) =>
  updatePetitionStatus(req, res, "participant", "accepted", true);

const rejectParticipantPetition = (req, res) =>
  updatePetitionStatus(req, res, "participant", "rejected", false);

const cancelParticipantPetition = (req, res) =>
  updatePetitionStatus(req, res, "participant", "cancelled", false);

// GET PETITIONS
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
  joinLeagueByIdSupabase,
  ensureGlobalLeagueExists,
};
