// controllers/UserController.js
const Answer = require("../models/Answers");
const Leagues = require("../models/Leagues");
const Quinipolo = require("../models/Quinipolo");
const User = require("../models/User");
const { supabase } = require("../services/supabaseClient");
const { validateUsername } = require("../utils/usernameValidation");

const getAllUsers = async (req, res) => {
  try {
    console.log("Fetching all users");
    // Supabase: fetch all users from 'profiles'
    const { data: users, error } = await supabase.from("profiles").select("*");
    if (error) throw error;
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserRole = async (req, res) => {
  try {
    console.log("Fetching user's role", req.params.email);
    const user = await User.getUserByEmail(req.params.email);
    res.status(200).json(user.role);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserBasicData = async (req, res) => {
  try {
    console.log("Fetching user's data", req.params.username);
    const user = await User.getUserByUsername(req.params.username);

    let quinipolosToAnswer = [];
    let leaguesInfo = [];
    if (!user) {
      throw new Error("User not found");
    }

    if (user.leagues && user.leagues.length > 0) {
      // TODO: Refactor Leagues and Quinipolo to use Supabase if not already
      const leaguePromises = user.leagues.map(async (leagueId) => {
        // Placeholder: fetch league and quinipolos from Supabase
        // const league = await Leagues.getLeagueById(leagueId);
        // const quinipolos = await Quinipolo.getActiveByLeagueId(leagueId);
        // For now, fallback to old logic or leave as TODO
        return [];
      });

      const results = await Promise.all(leaguePromises);
      quinipolosToAnswer = results.flat();
    }

    res.status(200).json({
      role: user.role,
      leagues: leaguesInfo,
      quinipolosToAnswer: quinipolosToAnswer,
      userLeagues: user.userLeagues,
      userId: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createUser = async (req, res) => {
  try {
    const newUser = await User.createUser(req.body);

    // Add user to global league if specified in request
    if (req.body.leagues && req.body.leagues.includes("global")) {
      const { joinLeagueByIdSupabase } = require("./LeaguesController");
      await joinLeagueByIdSupabase("global", newUser.id, newUser.username);
    }

    console.log("User created successfully:", newUser);
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserName = async (username) => {
  try {
    const user = await User.getUserByUsername(username);
    return user ? user.full_name : null;
  } catch (error) {
    console.error("Error fetching username:", error);
  }
};

const updateUserSubscription = async (userId, subscriptionId, planId) => {
  await User.updateUser(userId, {
    subscription: {
      id: subscriptionId,
      plan: planId,
      status: "active",
    },
  });
};

// Function to check leagues and add them to user's league list if they don't exist
const checkLeaguesAndUpdateUser = async (leagueId, username) => {
  // TODO: Refactor to use Supabase for leagues and user-league relations
  // Placeholder for now
};

// GET /api/users/me/profile
const getAllUserInformation = async (req, res) => {
  /*
    role: string; --> get from profile in supabase
    leagues: Leagues[]; --> get from user_leagues in supabase
    quinipolosToAnswer: any[]; --> get from answers in supabase
    userId: string; --> get from auth.users.id in supabase
    userLeagues: Array<{league_id: string, role: string}>; --> get from user_leagues in supabase
    emailAddress: string; --> get from profile in supabase (store at signup)
    username: string; --> get from profile in supabase
    hasBeenChecked: boolean; --> do not get for now.

    stripeCustomerId?: string; --> do not get for now.
    isPro?: boolean; --> do not get for now.
    productId?: string; --> do not get for now.
  */
  const userId = req.user.id;
  const userEmail = req.user.email;

  // 1. Get profile data
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // If no profile exists, return an error - profiles should be created during signup
  if (!profile) {
    if (profileError && profileError.code === "PGRST116") {
      console.error("No profile found for user:", userId);
      return res.status(404).json({
        error: "User profile not found. Please complete the signup process.",
      });
    } else if (profileError) {
      // If the error is something else, return it
      console.error("Error fetching profile:", profileError);
      return res.status(500).json({ error: profileError.message });
    }
  }

  // Ensure profile exists before proceeding
  if (!profile) {
    console.error("Profile is null after all attempts to fetch/create");
    return res
      .status(500)
      .json({ error: "Failed to create or fetch user profile" });
  }

  // 2. Get user leagues with roles
  const { data: userLeagues, error: leaguesError } = await supabase
    .from("user_leagues")
    .select("league_id, role")
    .eq("user_id", userId);
  if (leaguesError) {
    console.error("Error fetching user leagues:", leaguesError);
    return res.status(500).json({ error: leaguesError.message });
  }

  const leagues = userLeagues.map((ul) => ul.league_id);

  // 3. Get quinipolos to answer (from answers table)
  const { data: answers, error: answersError } = await supabase
    .from("answers")
    .select("quinipolo_id")
    .eq("user_id", userId);
  if (answersError) {
    console.error("Error fetching answers:", answersError);
    return res.status(500).json({ error: answersError.message });
  }
  const quinipolosToAnswer = answers.map((a) => a.quinipolo_id);

  const userData = {
    role: profile.role,
    leagues: leagues,
    quinipolosToAnswer: quinipolosToAnswer,
    userId: userId,
    userLeagues: userLeagues, // Include full userLeagues with roles
    emailAddress: profile.email, // Only from profiles
    username: profile.username,
  };

  res.status(200).json(userData);
};

// PATCH /api/users/me/profile
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body || {};

    const updates = {};
    if (typeof username === "string" && username.trim().length > 0) {
      // Validate username using utility function
      const validation = await validateUsername(username, userId);

      if (!validation.isValid) {
        return res.status(400).json({
          error: validation.error,
        });
      }

      updates.username = username.trim();
    }
    if (typeof email === "string" && email.trim().length > 0) {
      updates.email = email.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("id, username, email")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res
      .status(200)
      .json({ id: data.id, username: data.username, email: data.email });
  } catch (e) {
    console.error("Error updating profile:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  getUserRole,
  getUserBasicData,
  getUserName,
  updateUserSubscription,
  checkLeaguesAndUpdateUser,
  getAllUserInformation,
  updateMyProfile,
};
