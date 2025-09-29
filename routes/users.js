// routes/users.js
const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");
const QuinipolosController = require("../controllers/QuinipolosController");
const { authenticateToken } = require("../middleware/auth");

// Define a route for fetching all users
// router.get("/users", UserController.getAllUsers);
// Create a new user
router.post("/", UserController.createUser);

// Get quinipolos to answer of the user

router.get(
  "/me/quinipolos",
  authenticateToken,
  QuinipolosController.getQuinipolosFromUserLeagues
);

// Get user's profile and leagues
router.get(
  "/me/profile",
  authenticateToken,
  UserController.getAllUserInformation
);
router.patch("/me/profile", authenticateToken, UserController.updateMyProfile);

// Get user's basic data
// Deprecated: removed endpoint for fetching user basic data by username

// Get an user's role
router.get("/api/user/role/:email", UserController.getUserRole);

module.exports = router;
