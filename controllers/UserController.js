// controllers/UserController.js
const User = require("../models/User");

const getAllUsers = async (req, res) => {
  try {
    console.log("Fetching all users");
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getUserRole = async (req, res) => {
  try {
    console.log("Fetching user's role");
    const user = await User.find({ username: req.body.username });
    res.status(200).json(user.role);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createUser = async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    console.log("User created successfully:", newUser);
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { getAllUsers, createUser, getUserRole };
