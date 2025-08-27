// routes/auth.js
const express = require("express");
const { supabase } = require("../services/supabaseClient");
const { validateUsername } = require("../utils/usernameValidation");
const router = express.Router();

// Google OAuth signup endpoint
router.post("/google-signup", async (req, res) => {
  try {
    const { userId, email, fullName, username, birthday, isUserOver18 } =
      req.body;

    console.log("Google signup request received:", {
      userId,
      email,
      fullName,
      username,
    });

    if (!userId || !email) {
      return res.status(400).json({
        error: "User ID and email are required for Google signup",
      });
    }

    // Validate age if birthday is provided
    if (birthday) {
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age < 18) {
        return res
          .status(400)
          .json({ error: "You must be 18 or older to sign up" });
      }
    }

    // Validate username if provided
    if (username) {
      const validation = await validateUsername(username);
      if (!validation.isValid) {
        return res.status(400).json({
          error: validation.error,
        });
      }
    }

    // Generate a username from email if not provided
    let finalUsername = username;
    if (!finalUsername) {
      const emailPrefix = email.split("@")[0];
      finalUsername = emailPrefix;

      // Check if username exists and add a number if needed
      let counter = 1;
      let testUsername = finalUsername;
      while (true) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", testUsername)
          .single();

        if (!existingUser) {
          finalUsername = testUsername;
          break;
        }
        testUsername = `${finalUsername}${counter}`;
        counter++;
      }
    }

    // Check if profile already exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (existingProfile) {
      console.log("Profile already exists for Google user:", userId);
      return res.status(200).json({
        message: "User profile already exists",
        username: existingProfile.username,
      });
    }

    // Create profile for Google user
    console.log("Creating profile for Google user:", userId);
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role: "user",
      username: finalUsername,
      email: email,
      full_name: fullName || email.split("@")[0],
      birthday: birthday,
      is_user_over_18: isUserOver18 || true, // Use provided value or default to true
    });

    if (profileError) {
      console.error("Error creating Google user profile:", profileError);
      if (profileError.code === "23505") {
        return res.status(400).json({
          error: "A user with this email already exists",
        });
      }
      return res.status(500).json({ error: profileError.message });
    }

    // Add to global league
    const {
      joinLeagueByIdSupabase,
    } = require("../controllers/LeaguesController");
    await joinLeagueByIdSupabase("global", userId, finalUsername);

    res.status(201).json({
      message: "Google user profile created successfully",
      username: finalUsername,
    });
  } catch (error) {
    console.error("Error creating Google user:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    const { email, username, fullName, leagues, birthday, isUserOver18 } =
      req.body;

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
      // Validate birthday and calculate age
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age < 18) {
        return res
          .status(400)
          .json({ error: "You must be 18 or older to sign up" });
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        role: "user",
        username: username,
        email: email,
        full_name: fullName,
        birthday: birthday,
        is_user_over_18: !!isUserOver18,
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
