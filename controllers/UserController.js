// controllers/UserController.js
const Answer = require("../models/Answers");
const Leagues = require("../models/Leagues");
const Quinipolo = require("../models/Quinipolo");
const User = require("../models/User");
const { supabase } = require('../services/supabaseClient');

const getAllUsers = async (req, res) => {
  try {
    console.log("Fetching all users");
    // Supabase: fetch all users from 'profiles'
    const { data: users, error } = await supabase.from('profiles').select('*');
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
      moderatedLeagues: user.moderatedLeagues,
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
    // TODO: Implement joinLeagueById for Supabase if needed
    // joinLeagueById("global", newUser.username);
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
    moderatedLeagues: string[]; --> do not get for now.
    emailAddress: string; --> get from profile in supabase (store at signup)
    username: string; --> get from profile in supabase
    hasBeenChecked: boolean; --> do not get for now.
    isRegistered: boolean; --> do not get for now.
    stripeCustomerId?: string; --> do not get for now.
    isPro?: boolean; --> do not get for now.
    productId?: string; --> do not get for now.
  */
  const userId = req.user.id;
  const userEmail = req.user.email;

  // 1. Get profile data
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Only insert if the error is "no rows found" (PGRST116)
  if (!profile) {
    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: newProfileError } = await supabase
        .from('profiles')
        .insert({ id: userId, role: 'user', username: userEmail, email: userEmail })
        .single();
      if (newProfileError) {
        console.error('Error creating new profile:', newProfileError);
        return res.status(500).json({ error: newProfileError.message });
      }
      profile = newProfile;
    } else if (profileError) {
      // If the error is something else, return it
      console.error('Error fetching profile:', profileError);
      return res.status(500).json({ error: profileError.message });
    }
  }

  // 2. Get user leagues
  const { data: userLeagues, error: leaguesError } = await supabase
    .from('user_leagues')
    .select('*')
    .eq('user_id', userId);
  if (leaguesError) {
    console.error('Error fetching user leagues:', leaguesError);
    return res.status(500).json({ error: leaguesError.message });
  }
  const leagues = userLeagues.map(ul => ul.league_id);

  // 3. Get quinipolos to answer (from answers table)
  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('quinipolo_id')
    .eq('user_id', userId);
  if (answersError) {
    console.error('Error fetching answers:', answersError);
    return res.status(500).json({ error: answersError.message });
  }
  const quinipolosToAnswer = answers.map(a => a.quinipolo_id);

  const userData = {
    role: profile.role,
    leagues: leagues,
    quinipolosToAnswer: quinipolosToAnswer,
    userId: userId,
    emailAddress: profile.email, // Only from profiles
    username: profile.username,
  };
  
  res.status(200).json(userData);
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
};
