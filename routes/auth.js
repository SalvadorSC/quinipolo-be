// routes/auth.js
const express = require("express");
const User = require("../models/User");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { userId, email, role, leagues, username, fullName } = req.body;

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

    // Save the user to the database
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

/* router.post("/login", async (req, res) => {
  const { email, password } = req.body;
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
    res.json({
      message: "Login successful",
      user: { userId: user._id, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}); */

router.post("/checkUser?:username", async (req, res) => {
  const username = req.query.username;
  console.log("params", username);
  console.log("username", username);
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
      user: { userId: user._id, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
