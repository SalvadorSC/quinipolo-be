// routes/auth.js
const express = require("express");
const { supabase } = require("../services/supabaseClient");
const router = express.Router();

// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json({ message: "User registered successfully", data });
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
