// routes/auth.js
const express = require("express");
const User = require("../models/User");
const Leagues = require("../models/Leagues");
const { joinLeagueById } = require("../controllers/LeaguesController");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, role, leagues, username, fullName } = req.body;

    // Hash the password
    //const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      // userId,
      //password: hashedPassword,
      email,
      role,
      leagues,
      username,
      fullName,
    });
    joinLeagueById("global", username);
    // Save the user to the database
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/checkUser?:username", async (req, res) => {
  const username = req.query.username;
  try {
    // Find user by email
    const user = await User.findOne({ username }).exec();
    // Check if user exists
    if (!user) {
      return res.json({
        message: "User does not exist",
        messageCode: "USER_NOT_FOUND",
      });
    }
    // Authentication successful
    res.json({
      message: "User exists",
      messageCode: "USER_FOUND",
      user: { userId: user._id, role: user.role, username: user.username },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
