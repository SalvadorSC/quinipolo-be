// controllers/QuinipoloController.js
const {
  getQuinipoloAnswerByUsernameAndQuinipoloId,
} = require("./AnswerController");
const {
  updateLeaderboard,
  updateLeaderboardBatch,
} = require("./LeaderboardController");
const { supabase } = require("../services/supabaseClient");

/**
 * Adds new teams to the Supabase 'teams' table.
 * @param {Object} teamsObj - { waterpolo: [...], football: [...], basketball: [...] }
 */
const addNewTeams = async (teamsObj) => {
  try {
    for (const sport in teamsObj) {
      const teamNames = teamsObj[sport];
      if (!Array.isArray(teamNames)) continue;

      // Fetch existing teams for this sport
      const { data: existingTeams, error } = await supabase
        .from("teams")
        .select("name")
        .eq("sport", sport);

      if (error) throw error;

      const existingNames = new Set(existingTeams.map((t) => t.name));

      // Prepare new teams to insert
      const newTeams = teamNames
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ name, sport }));

      if (newTeams.length > 0) {
        const { error: insertError } = await supabase
          .from("teams")
          .insert(newTeams);

        if (insertError) throw insertError;
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Error adding new teams:", error);
    throw error;
  }
};

const getAllQuinipolo = async (req, res) => {
  try {
    console.log("Fetching all quinipolos");
    const { data: quinipolos, error } = await supabase.from("quinipolos")
      .select(`
        *,
        leagues!inner(league_name)
      `);

    if (error) {
      console.error("Error fetching quinipolos:", error);
      return res.status(500).send("Internal Server Error");
    }

    // Transform to match expected format
    const transformedQuinipolos = quinipolos.map((quinipolo) => ({
      id: quinipolo.id,
      league_id: quinipolo.league_id,
      league_name: quinipolo.leagues.league_name,
      quinipolo: quinipolo.quinipolo,
      end_date: quinipolo.end_date,
      has_been_corrected: quinipolo.has_been_corrected,
      creation_date: quinipolo.creation_date,
      is_deleted: quinipolo.is_deleted,
      participants_who_answered: quinipolo.participants_who_answered || [],
      correct_answers: quinipolo.correct_answers || [],
      // Legacy fields for backward compatibility
      leagueName: quinipolo.leagues.league_name,
      leagueId: quinipolo.league_id,
      endDate: quinipolo.end_date,
      hasBeenCorrected: quinipolo.has_been_corrected,
      creationDate: quinipolo.creation_date,
      _id: quinipolo.id,
    }));

    res.status(200).json(transformedQuinipolos);
  } catch (error) {
    console.error("Error fetching quinipolos:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createNewQuinipolo = async (req, res) => {
  try {
    // Accept snake_case as the canonical naming; support legacy camelCase as fallback
    const leagueId = req.body.league_id || req.body.leagueId;
    const endDate = req.body.end_date || req.body.endDate;
    const creationDate = req.body.creation_date || req.body.creationDate;

    if (endDate) {
      // Get league from Supabase instead of MongoDB
      const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .select("league_name")
        .eq("id", leagueId)
        .single();

      if (leagueError) {
        console.error("Error fetching league:", leagueError);
        return res.status(404).json({ error: "League not found" });
      }

      // Create quinipolo in Supabase
      const { data: newQuinipolo, error: createError } = await supabase
        .from("quinipolos")
        .insert({
          league_id: leagueId,
          quinipolo: req.body.quinipolo,
          end_date: endDate,
          has_been_corrected: false,
          creation_date: creationDate,
          is_deleted: false,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating quinipolo:", createError);
        return res.status(500).json({ error: "Failed to create quinipolo" });
      }

      // Add league_name to the response for frontend convenience (snake_case only)
      const quinipoloWithLeagueName = {
        ...newQuinipolo,
        league_name: league.league_name,
      };

      // Extract teams from quinipolo data
      const teams = extractTeamsFromQuinipolo(req.body.quinipolo);

      // Add new teams to teams collection
      if (teams) {
        await addNewTeams(teams);
      }

      // Send notifications to all users in the league
      // await NotificationService.notifyNewQuinipolo(
      //   newQuinipolo.id,
      //   req.body.leagueId
      // );

      res.status(201).json(quinipoloWithLeagueName);
    } else {
      res.status(500).send("Por favor escoge una fecha de finalización");
    }
  } catch (error) {
    console.error("Error creating Quinipolo:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createQuinipoloForAllLeagues = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quinipolo, end_date, creation_date } = req.body;

    // Check if user has admin privileges
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("role, username")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user has system admin role
    if (userProfile.role !== "admin" && userProfile.role !== "system_admin") {
      return res.status(403).json({
        error:
          "Insufficient permissions. Only system administrators can create quinipolos for all leagues.",
      });
    }

    if (!end_date) {
      return res.status(400).json({ error: "End date is required" });
    }

    // Get all active leagues
    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("id, league_name")
      .eq("status", "active");

    if (leaguesError) {
      console.error("Error fetching leagues:", leaguesError);
      return res.status(500).json({ error: "Failed to fetch leagues" });
    }

    if (!leagues || leagues.length === 0) {
      return res.status(404).json({ error: "No active leagues found" });
    }

    // Create quinipolo for each league
    const createdQuinipolos = [];
    const errors = [];

    for (const league of leagues) {
      try {
        const { data: newQuinipolo, error: createError } = await supabase
          .from("quinipolos")
          .insert({
            league_id: league.id,
            quinipolo: quinipolo,
            end_date: end_date,
            has_been_corrected: false,
            creation_date: creation_date || new Date().toISOString(),
            is_deleted: false,
          })
          .select()
          .single();

        if (createError) {
          console.error(
            `Error creating quinipolo for league ${league.league_name}:`,
            createError
          );
          errors.push({
            league: league.league_name,
            error: createError.message,
          });
        } else {
          createdQuinipolos.push({
            ...newQuinipolo,
            league_name: league.league_name,
          });
        }
      } catch (error) {
        console.error(
          `Error creating quinipolo for league ${league.league_name}:`,
          error
        );
        errors.push({
          league: league.league_name,
          error: error.message,
        });
      }
    }

    // Extract teams from quinipolo data and add to teams collection
    const teams = extractTeamsFromQuinipolo(quinipolo);
    if (teams) {
      try {
        await addNewTeams(teams);
      } catch (error) {
        console.error("Error adding teams:", error);
      }
    }

    const response = {
      message: `Successfully created quinipolos for ${createdQuinipolos.length} out of ${leagues.length} leagues`,
      createdQuinipolos,
      errors: errors.length > 0 ? errors : undefined,
      totalLeagues: leagues.length,
      successfulCreations: createdQuinipolos.length,
      failedCreations: errors.length,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating quinipolos for all leagues:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createQuinipoloForManagedLeagues = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quinipolo, end_date, creation_date } = req.body;

    // Check if user has admin privileges
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("role, username")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user has system admin role
    if (userProfile.role !== "admin" && userProfile.role !== "system_admin") {
      return res.status(403).json({
        error:
          "Insufficient permissions. Only system administrators can create quinipolos for managed leagues.",
      });
    }

    if (!end_date) {
      return res.status(400).json({ error: "End date is required" });
    }

    // Get all active managed leagues only
    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("id, league_name")
      .eq("status", "active")
      .eq("tier", "managed");

    if (leaguesError) {
      console.error("Error fetching managed leagues:", leaguesError);
      return res.status(500).json({ error: "Failed to fetch managed leagues" });
    }

    if (!leagues || leagues.length === 0) {
      return res.status(404).json({ error: "No active managed leagues found" });
    }

    // Create quinipolo for each managed league
    const createdQuinipolos = [];
    const errors = [];

    for (const league of leagues) {
      try {
        const { data: newQuinipolo, error: createError } = await supabase
          .from("quinipolos")
          .insert({
            league_id: league.id,
            quinipolo: quinipolo,
            end_date: end_date,
            has_been_corrected: false,
            creation_date: creation_date || new Date().toISOString(),
            is_deleted: false,
          })
          .select()
          .single();

        if (createError) {
          console.error(
            `Error creating quinipolo for managed league ${league.league_name}:`,
            createError
          );
          errors.push({
            league: league.league_name,
            error: createError.message,
          });
        } else {
          createdQuinipolos.push({
            ...newQuinipolo,
            league_name: league.league_name,
          });
        }
      } catch (error) {
        console.error(
          `Error creating quinipolo for managed league ${league.league_name}:`,
          error
        );
        errors.push({
          league: league.league_name,
          error: error.message,
        });
      }
    }

    // Extract teams from quinipolo data and add to teams collection
    const teams = extractTeamsFromQuinipolo(quinipolo);
    if (teams) {
      try {
        await addNewTeams(teams);
      } catch (error) {
        console.error("Error adding teams:", error);
      }
    }

    const response = {
      message: `Successfully created quinipolos for ${createdQuinipolos.length} out of ${leagues.length} managed leagues`,
      createdQuinipolos,
      errors: errors.length > 0 ? errors : undefined,
      totalLeagues: leagues.length,
      successfulCreations: createdQuinipolos.length,
      failedCreations: errors.length,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating quinipolos for managed leagues:", error);
    res.status(500).json({ error: "Internal server error" });
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

const getQuinipoloByLeague = async (req, res) => {
  try {
    const leagueId = req.params.leagueId;

    // Get quinipolos with league information
    const { data, error } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .eq("league_id", leagueId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Transform the data to include league_name at the top level
    const quinipolosWithLeagueName = data.map((quinipolo) => ({
      ...quinipolo,
      league_name: quinipolo.leagues.league_name,
    }));

    res.status(200).json(quinipolosWithLeagueName);
  } catch (error) {
    res.status(500).send(`Internal Server Error ${req.params.leagueId}`);
  }
};

const getQuinipoloById = async (req, res) => {
  console.log("Fetching quinipolo by id", req.params.id);
  try {
    const { data: quinipolo, error } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    // Transform to match expected format
    const transformedQuinipolo = {
      id: quinipolo.id,
      league_id: quinipolo.league_id,
      league_name: quinipolo.leagues.league_name,
      quinipolo: quinipolo.quinipolo,
      end_date: quinipolo.end_date,
      has_been_corrected: quinipolo.has_been_corrected,
      creation_date: quinipolo.creation_date,
      is_deleted: quinipolo.is_deleted,
      participants_who_answered: quinipolo.participants_who_answered || [],
      correct_answers: quinipolo.correct_answers || [],
      // Legacy fields for backward compatibility
      leagueName: quinipolo.leagues.league_name,
      leagueId: quinipolo.league_id,
      endDate: quinipolo.end_date,
      hasBeenCorrected: quinipolo.has_been_corrected,
      creationDate: quinipolo.creation_date,
      _id: quinipolo.id,
    };

    res.status(200).json(transformedQuinipolo);
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

    // 2. Get all quinipolos for these leagues with league information
    const { data: quinipolos, error: quinipolosError } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .in("league_id", leagueIds);

    if (quinipolosError) {
      return res.status(500).json({ error: "Error fetching quinipolos" });
    }

    // Transform the data to include league_name at the top level
    const quinipolosWithLeagueName = quinipolos.map((quinipolo) => ({
      ...quinipolo,
      league_name: quinipolo.leagues.league_name,
    }));

    res.status(200).json(quinipolosWithLeagueName);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getUserAnswers = async (req, res) => {
  try {
    // Get user by username
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", req.query.username)
      .single();

    if (userError) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's leagues
    const { data: userLeagues, error: leaguesError } = await supabase
      .from("user_leagues")
      .select("league_id")
      .eq("user_id", user.id);

    if (leaguesError) {
      return res.status(500).json({ message: "Error fetching user leagues" });
    }

    const leagueIds = userLeagues.map((ul) => ul.league_id);

    if (leagueIds.length === 0) {
      return res.status(200).json([]);
    }

    // Get quinipolos for user's leagues
    const { data: quinipolos, error: quinipolosError } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .in("league_id", leagueIds);

    if (quinipolosError) {
      return res.status(500).json({ message: "Error fetching quinipolos" });
    }

    // Get answers for each quinipolo
    const answersPromises = quinipolos.map(async (quinipolo) => {
      const { data: answer } = await supabase
        .from("answers")
        .select("*")
        .eq("user_id", user.id)
        .eq("quinipolo_id", quinipolo.id)
        .single();

      // Transform quinipolo to match expected format
      const transformedQuinipolo = {
        id: quinipolo.id,
        league_id: quinipolo.league_id,
        league_name: quinipolo.leagues.league_name,
        quinipolo: quinipolo.quinipolo,
        end_date: quinipolo.end_date,
        has_been_corrected: quinipolo.has_been_corrected,
        creation_date: quinipolo.creation_date,
        is_deleted: quinipolo.is_deleted,
        participants_who_answered: quinipolo.participants_who_answered || [],
        correct_answers: quinipolo.correct_answers || [],
        // Legacy fields for backward compatibility
        leagueName: quinipolo.leagues.league_name,
        leagueId: quinipolo.league_id,
        endDate: quinipolo.end_date,
        hasBeenCorrected: quinipolo.has_been_corrected,
        creationDate: quinipolo.creation_date,
        _id: quinipolo.id,
      };

      return {
        quinipolo: transformedQuinipolo,
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
  const userId = req.user.id; // Get user ID from authenticated user

  try {
    // Get quinipolo
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .eq("id", id)
      .single();

    if (quinipoloError) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    // Get user answers using user_id from authenticated user
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("answers")
      .eq("quinipolo_id", id)
      .eq("user_id", userId) // Use authenticated user ID
      .single();

    if (answersError && answersError.code !== "PGRST116") {
      // PGRST116 is "not found"
      return res
        .status(500)
        .json({ message: "Error fetching answers", error: answersError });
    }

    // Transform quinipolo to match expected format
    const transformedQuinipolo = {
      id: quinipolo.id,
      league_id: quinipolo.league_id,
      league_name: quinipolo.leagues.league_name,
      quinipolo: quinipolo.quinipolo,
      end_date: quinipolo.end_date,
      has_been_corrected: quinipolo.has_been_corrected,
      creation_date: quinipolo.creation_date,
      is_deleted: quinipolo.is_deleted,
      participants_who_answered: quinipolo.participants_who_answered || [],
      correct_answers: quinipolo.correct_answers || [],
      // Legacy fields for backward compatibility
      leagueName: quinipolo.leagues.league_name,
      leagueId: quinipolo.league_id,
      endDate: quinipolo.end_date,
      hasBeenCorrected: quinipolo.has_been_corrected,
      creationDate: quinipolo.creation_date,
      _id: quinipolo.id,
    };

    if (!answers) {
      return res
        .status(200)
        .json({ quinipolo: transformedQuinipolo, answers: [] });
    }

    res.status(200).json({ quinipolo: transformedQuinipolo, ...answers });
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
    // 2. Get all quinipolos for these leagues with league information
    const { data: quinipolos, error: quinipolosError } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .in("league_id", leagueIds);
    if (quinipolosError) {
      return res.status(500).json({ error: "Error fetching quinipolos" });
    }
    // 3. Get all answers for this user
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("quinipolo_id")
      .eq("user_id", userId);
    if (answersError) {
      return res.status(500).json({ error: "Error fetching answers" });
    }
    const answeredQuinipoloIds = new Set(answers.map((a) => a.quinipolo_id));
    // 4. Mark each quinipolo with answered flag and include league_name
    const quinipolosWithAnswerFlag = quinipolos.map((q) => ({
      ...q,
      league_name: q.leagues.league_name,
      answered: answeredQuinipoloIds.has(q.id),
    }));
    res.status(200).json(quinipolosWithAnswerFlag);
  } catch (error) {
    console.error("Error fetching quinipolos to answer:", error);
    res.status(500).send("Internal Server Error");
  }
};

const processAndCorrectAnswers = async (
  quinipoloId,
  correctedAnswers,
  moderatorId,
  isEdit = false
) => {
  const { data: answers, error } = await supabase
    .from("answers")
    .select("*")
    .eq("quinipolo_id", quinipoloId);

  if (error) {
    throw error;
  }

  // Get league ID and correction version
  const { data: quinipolo, error: quinipoloError } = await supabase
    .from("quinipolos")
    .select("league_id, correction_count")
    .eq("id", quinipoloId)
    .single();

  if (quinipoloError) {
    throw quinipoloError;
  }

  const leagueId = quinipolo.league_id;
  const newCorrectionVersion = (quinipolo.correction_count || 0) + 1;

  // Compute per-answer points and deltas
  const perAnswer = answers.map((answer) => {
    let points = 0;
    let correct15thGame = false;
    for (const userAnswer of answer.answers) {
      const correct = correctedAnswers.find(
        (c) => c.matchNumber === userAnswer.matchNumber
      );
      if (!correct) continue;
      if (
        userAnswer.chosenWinner === correct.chosenWinner &&
        userAnswer.matchNumber !== 15
      ) {
        points += 1;
      }
      if (userAnswer.matchNumber === 15) {
        const exact15th =
          userAnswer.chosenWinner === correct.chosenWinner &&
          userAnswer.goalsHomeTeam === correct.goalsHomeTeam &&
          userAnswer.goalsAwayTeam === correct.goalsAwayTeam;
        if (exact15th) {
          correct15thGame = true;
          points += 1;
        }
      }
    }
    const fullCorrectQuinipolo = points === 15 && correct15thGame;
    const pointsDifference = isEdit
      ? points - (answer.points_earned || 0)
      : points;
    const fullCorrectDelta = isEdit
      ? (fullCorrectQuinipolo ? 1 : 0) -
        (answer.points_earned === 15 && (answer.correct15thGame || false)
          ? 1
          : 0)
      : fullCorrectQuinipolo
      ? 1
      : 0;
    const participatedDelta = isEdit ? 0 : 1;
    return {
      answer,
      user_id: answer.user_id,
      points,
      correct15thGame,
      pointsDifference,
      fullCorrectDelta,
      participatedDelta,
    };
  });

  // Bulk fetch usernames
  const userIds = Array.from(new Set(perAnswer.map((r) => r.user_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds);
  if (profilesError) throw profilesError;
  const idToUsername = new Map((profiles || []).map((p) => [p.id, p.username]));

  // Build leaderboard deltas for batch update
  const deltas = perAnswer.map((r) => ({
    user_id: r.user_id,
    pointsDelta: r.pointsDifference,
    fullCorrectDelta: r.fullCorrectDelta,
    participatedDelta: r.participatedDelta,
  }));

  // Apply batch leaderboard update
  const updatedRows = await updateLeaderboardBatch(leagueId, deltas);
  const updatedByUserId = new Map(updatedRows.map((u) => [u.user_id, u]));

  // Snapshot leaderboard history per user for this quinipolo and version
  try {
    const historyRows = perAnswer.map((r) => {
      const updated = updatedByUserId.get(r.user_id);
      return {
        quinipolo_id: quinipoloId,
        league_id: leagueId,
        user_id: r.user_id,
        points_delta: r.pointsDifference,
        total_points_after: updated ? updated.points ?? 0 : 0,
        full_correct_delta: r.fullCorrectDelta,
        participated_delta: r.participatedDelta,
        correction_version: newCorrectionVersion,
      };
    });

    if (historyRows.length > 0) {
      const { error: historyInsertError } = await supabase
        .from("leaderboard_history")
        .upsert(historyRows, {
          onConflict: "quinipolo_id,user_id,correction_version",
        });
      if (historyInsertError) {
        console.warn(
          "Failed to insert leaderboard history:",
          historyInsertError
        );
      }
    }
  } catch (e) {
    console.warn("Unexpected error while inserting leaderboard history:", e);
  }

  // Concurrently update answers
  const concurrency = 10;
  for (let i = 0; i < perAnswer.length; i += concurrency) {
    const slice = perAnswer.slice(i, i + concurrency);
    const updates = slice.map((r) =>
      supabase
        .from("answers")
        .update({
          corrected: true,
          points_earned: r.points,
          correction_version: newCorrectionVersion,
          last_corrected_at: new Date().toISOString(),
        })
        .eq("id", r.answer.id)
    );
    await Promise.allSettled(updates);
  }

  // Update quinipolo metadata
  const { error: quinipoloUpdateError } = await supabase
    .from("quinipolos")
    .update({
      correction_count: newCorrectionVersion,
      last_corrected_by: moderatorId,
    })
    .eq("id", quinipoloId);
  if (quinipoloUpdateError) {
    console.warn(
      "Failed to update quinipolo correction metadata:",
      quinipoloUpdateError
    );
  }

  // Build feedback
  const feedbackForModerator = perAnswer.map((r) => {
    const updated = updatedByUserId.get(r.user_id);
    return {
      username: idToUsername.get(r.user_id) || r.user_id,
      pointsEarned: r.pointsDifference,
      totalPoints: updated ? updated.points : undefined,
      correct15thGame: r.correct15thGame,
      nQuinipolosParticipated: updated
        ? updated.n_quinipolos_participated
        : undefined,
    };
  });

  return feedbackForModerator;
};

const correctQuinipolo = async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;

  try {
    // Check if quinipolo exists and get league_id
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id, league_id")
      .eq("id", id)
      .single();

    if (quinipoloError) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    // Call a function to process and update answers
    console.log("Correcting Quinipolo", id);
    const results = await processAndCorrectAnswers(
      id,
      answers,
      req.user.id,
      false
    );

    // Create correction history entry for initial correction
    const { error: historyError } = await supabase
      .from("correction_history")
      .insert({
        quinipolo_id: id,
        moderator_id: req.user.id,
        previous_correct_answers: [],
        new_correct_answers: answers,
        points_changes: results.reduce((acc, result) => {
          acc[result.username] = result.pointsEarned;
          return acc;
        }, {}),
        correction_type: "initial",
      });

    if (historyError) {
      console.warn("Failed to create correction history:", historyError);
    }

    // Update the quinipolo with corrections
    const { error: updateError } = await supabase
      .from("quinipolos")
      .update({
        correct_answers: answers,
        has_been_corrected: true,
        correction_date: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({
        message: "Failed to update quinipolo corrections",
        error: updateError,
      });
    }

    // Fetch full participants leaderboard for the league (to include non-respondents)
    let participantsLeaderboard = [];
    try {
      const { data: leaderboardRows, error: leaderboardError } = await supabase
        .from("leaderboard")
        .select(
          "user_id, points, n_quinipolos_participated, full_correct_quinipolos"
        )
        .eq("league_id", quinipolo.league_id)
        .order("points", { ascending: false });

      if (!leaderboardError && leaderboardRows && leaderboardRows.length > 0) {
        const userIds = leaderboardRows.map((row) => row.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);
        const userMap = Object.fromEntries(
          (profiles || []).map((p) => [p.id, p.username])
        );
        participantsLeaderboard = leaderboardRows.map((row) => ({
          username: userMap[row.user_id] || "unknown",
          points: row.points,
          totalPoints: row.points,
          nQuinipolosParticipated: row.n_quinipolos_participated,
          fullCorrectQuinipolos: row.full_correct_quinipolos,
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch participants leaderboard:", e);
    }

    res.status(200).json({
      message: "Quinipolo corrected successfully",
      results,
      leagueId: quinipolo.league_id,
      participantsLeaderboard,
    });
  } catch (error) {
    res.status(500).json({
      message: "Quinipolo could not be corrected. Please try again later",
      error,
    });
  }
};

const getUserPointsGained = async (quinipoloId, correctedAnswers) => {
  const { data: answers, error } = await supabase
    .from("answers")
    .select("*")
    .eq("quinipolo_id", quinipoloId);

  if (error) {
    throw error;
  }

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
    // Get username from user_id
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", answer.user_id)
      .single();

    const username = userProfile?.username || answer.user_id;

    // Gather feedback for the moderator
    feedbackForModerator.push({
      username: username,
      pointsEarned: points,
      correct15thGame: correct15thGame,
    });
  }
  return feedbackForModerator;
};

const editQuinipoloCorrection = async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;

  try {
    // Get current quinipolo with corrections
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id, correct_answers, league_id")
      .eq("id", id)
      .single();

    if (quinipoloError) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    // Store correction history before making changes
    const { data: allAnswers, error: answersError } = await supabase
      .from("answers")
      .select("user_id, points_earned")
      .eq("quinipolo_id", id);

    if (answersError) {
      return res.status(500).json({
        message: "Error fetching answers",
        error: answersError,
      });
    }

    // Create correction history entry
    const pointsChanges = {};
    for (const answer of allAnswers) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", answer.user_id)
        .single();

      const username = userProfile?.username || answer.user_id;
      pointsChanges[username] = answer.points_earned || 0;
    }

    const { error: historyError } = await supabase
      .from("correction_history")
      .insert({
        quinipolo_id: id,
        moderator_id: req.user.id,
        previous_correct_answers: quinipolo.correct_answers || [],
        new_correct_answers: answers,
        points_changes: pointsChanges,
        correction_type: "edit",
      });

    if (historyError) {
      console.warn("Failed to create correction history:", historyError);
    }

    // Process the correction with the new answers (this will handle point differences)
    const results = await processAndCorrectAnswers(
      id,
      answers,
      req.user.id,
      true
    );

    // Update the quinipolo with new corrections
    const { error: updateError } = await supabase
      .from("quinipolos")
      .update({
        correct_answers: answers,
        correction_date: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({
        message: "Failed to update quinipolo corrections",
        error: updateError,
      });
    }

    // Fetch full participants leaderboard for the league (to include non-respondents)
    let participantsLeaderboard = [];
    try {
      const { data: leaderboardRows, error: leaderboardError } = await supabase
        .from("leaderboard")
        .select(
          "user_id, points, n_quinipolos_participated, full_correct_quinipolos"
        )
        .eq("league_id", quinipolo.league_id)
        .order("points", { ascending: false });

      if (!leaderboardError && leaderboardRows && leaderboardRows.length > 0) {
        const userIds = leaderboardRows.map((row) => row.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);
        const userMap = Object.fromEntries(
          (profiles || []).map((p) => [p.id, p.username])
        );
        participantsLeaderboard = leaderboardRows.map((row) => ({
          username: userMap[row.user_id] || "unknown",
          points: row.points,
          totalPoints: row.points,
          nQuinipolosParticipated: row.n_quinipolos_participated,
          fullCorrectQuinipolos: row.full_correct_quinipolos,
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch participants leaderboard (edit):", e);
    }

    res.status(200).json({
      message: "Quinipolo correction edited successfully",
      results: results,
      leagueId: quinipolo.league_id,
      participantsLeaderboard,
    });
  } catch (error) {
    console.error("Error editing quinipolo correction:", error);
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
    const { data: quinipolo, error } = await supabase
      .from("quinipolos")
      .select(
        `
        *,
        leagues!inner(league_name)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    // Transform to match expected format
    const transformedQuinipolo = {
      id: quinipolo.id,
      league_id: quinipolo.league_id,
      league_name: quinipolo.leagues.league_name,
      quinipolo: quinipolo.quinipolo,
      end_date: quinipolo.end_date,
      has_been_corrected: quinipolo.has_been_corrected,
      creation_date: quinipolo.creation_date,
      is_deleted: quinipolo.is_deleted,
      participants_who_answered: quinipolo.participants_who_answered || [],
      correct_answers: quinipolo.correct_answers || [],
      // Legacy fields for backward compatibility
      leagueName: quinipolo.leagues.league_name,
      leagueId: quinipolo.league_id,
      endDate: quinipolo.end_date,
      hasBeenCorrected: quinipolo.has_been_corrected,
      creationDate: quinipolo.creation_date,
      _id: quinipolo.id,
    };

    res.status(200).json(transformedQuinipolo);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching Corrected Quinipolo", error });
  }
};

const setQuinipoloAsDeleted = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id")
      .eq("id", id)
      .single();

    if (quinipoloError) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    const { error: updateError } = await supabase
      .from("quinipolos")
      .update({ is_deleted: true })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({
        message: "Failed to mark quinipolo as deleted",
        error: updateError,
      });
    }

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
  createQuinipoloForAllLeagues,
  createQuinipoloForManagedLeagues,
};
