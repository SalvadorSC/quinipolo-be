// routes/auth.js
const express = require("express");
const { supabase } = require("../services/supabaseClient");
const { validateUsername } = require("../utils/usernameValidation");
const router = express.Router();

// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    const { email, password, username, fullName, leagues } = req.body;

    console.log("Signup request received:", {
      email,
      username,
      fullName,
      userId: req.body.userId,
      bodyKeys: Object.keys(req.body),
    });

    // Validate username - it's required
    if (!username || username.trim().length === 0) {
      return res.status(400).json({
        error: "Username is required and cannot be empty",
      });
    }

    const validation = await validateUsername(username);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    // Get user ID from request body (provided by frontend after Supabase auth)
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({
        error:
          "User ID is required. Please complete Supabase authentication first.",
      });
    }

    // Create profile for the user (user already created in Supabase auth)
    const {
      joinLeagueByIdSupabase,
    } = require("../controllers/LeaguesController");

    // Create profile if it doesn't exist
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileCheckError && profileCheckError.code === "PGRST116") {
      console.log("Creating profile for user:", userId);
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        role: "user",
        username: username,
        email: email,
        full_name: fullName,
      });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        // If it's a duplicate key error, the profile already exists, which is fine
        if (profileError.code !== "23505") {
          return res.status(500).json({ error: profileError.message });
        }
      }
    } else {
      console.log("Profile already exists for user:", userId);
    }

    // Add to global league if specified
    if (leagues && leagues.includes("global")) {
      await joinLeagueByIdSupabase("global", userId, username);
    }

    res.status(201).json({ message: "User profile created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(200).json({ message: "Login successful", data });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
