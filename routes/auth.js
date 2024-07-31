// routes/auth.js
const express = require("express");
const User = require("../models/User");
const { joinLeagueById } = require("../controllers/LeaguesController");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, role, leagues, username, fullName } = req.body;

    const newUser = new User({
      email,
      role,
      leagues,
      username,
      fullName,
    });
    joinLeagueById("global", username);
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
    // Find user by username
    const user = await User.findOne({ username }).exec();
    // Check if user exists
    if (!user) {
      return res.json({
        message: "User does not exist",
        messageCode: "USER_NOT_FOUND",
      });
    }

    // Check subscription status
    let subscription = null;
    if (user.subscription?.id) {
      subscription = await stripe.subscriptions.retrieve(user.subscription.id);
    }

    // Update role if no active subscription and user role is not "user"
    if (!subscription || subscription.status !== "active") {
      user.role = "user";
      await user.save();
    }

    // Authentication successful
    res.json({
      message: "User exists",
      messageCode: "USER_FOUND",
      user: { userId: user._id, role: user.role, username: user.username },
    });
  } catch (error) {
    console.error("Check user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
