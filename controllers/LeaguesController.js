// controllers/LeaguesController.js
const Leaderboard = require("../models/Leaderboard");
const User = require("../models/User");
const { createLeaderboard } = require("./LeaderboardController");
const { supabase } = require("../services/supabaseClient");

const getAllLeaguesData = async (req, res) => {
  try {
    // 1. Get all leagues
    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("*");
    if (leaguesError) {
      return res.status(500).json({ error: leaguesError.message });
    }

    // 2. For each league, get participants (user_id, role) and usernames
    const result = await Promise.all(
      leagues.map(async (league) => {
        // Fetch user_leagues with roles
        const { data: userLeagues, error: userLeaguesError } = await supabase
          .from("user_leagues")
          .select("user_id, role")
          .eq("league_id", league.id);

        let participants = [];
        if (userLeagues && userLeagues.length > 0) {
          const userIds = userLeagues.map((u) => u.user_id);
          // Fetch usernames
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", userIds);

          if (profiles) {
            participants = userLeagues.map((ul) => ({
              user_id: ul.user_id,
              username:
                profiles.find((p) => p.id === ul.user_id)?.username ||
                "unknown",
              role: ul.role,
            }));
          }
        }

        // Petitions fields (default to [] if missing)
        const participantPetitions = league.participant_petitions || [];
        const moderatorPetitions = league.moderator_petitions || [];

        return {
          ...league,
          participants,
          participantsCount: participants.length,
          participantPetitions,
          moderatorPetitions,
        };
      })
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching leagues:", error);
    res.status(500).send("Internal Server Error");
  }
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

    // 4. Get moderator petitions and participant petitions
    const participantPetitions = league.participant_petitions || [];
    const moderatorPetitions = league.moderator_petitions || [];

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
    const { name, leagueName, isPrivate, tier, userId } = req.body;

    if (!name || !tier || !userId) {
      return res
        .status(400)
        .json({ error: "Name, tier, and userId are required" });
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
        league_name: leagueName || name,
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

// Ensure global league exists
const ensureGlobalLeagueExists = async () => {
  try {
    // Check if global league exists by Supabase ID
    const { data: globalLeague, error: checkError } = await supabase
      .from("leagues")
      .select("*")
      .eq("id", "351a1949-f6c5-4940-ac70-1c7dd08e8b1a")
      .single();

    if (checkError && checkError.code === "PGRST116") {
      // Global league doesn't exist, create it with a proper UUID
      const { data: newLeague, error: createError } = await supabase
        .from("leagues")
        .insert({
          name: "Global League",
          is_private: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating global league:", createError);
        return false;
      }
      console.log("Global league created successfully with ID:", newLeague.id);
      return newLeague.id;
    } else if (checkError) {
      console.error("Error checking global league:", checkError);
      return false;
    }

    return globalLeague.id; // Return the existing global league ID
  } catch (error) {
    console.error("Error ensuring global league exists:", error);
    return false;
  }
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

const createPetition = async (req, res, petitionType) => {
  const petitionField = `${petitionType}Petitions`; // moderatorPetitions, participantPetitions

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
  const arrayField =
    petitionType === "participant"
      ? `${petitionType}s`
      : `${petitionType}Array`;
  try {
    const league = await Leagues.findOne({ leagueId: req.params.leagueId });
    const petition = league[petitionField].id(req.params.petitionId);

    petition.status = newStatus;

    console.log(arrayField);
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
