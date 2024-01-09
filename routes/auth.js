// routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { username, password, email, role, leagues } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      password: hashedPassword,
      email,
      role,
      leagues,
    });

    // Save the user to the database
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("aaaaaa");
  try {
    // Find user by email
    const user = await User.findOne({ email }).exec();
    // Check if user exists
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    // Check password
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Authentication successful
    res.json({ message: "Login successful", user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
