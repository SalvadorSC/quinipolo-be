// routes/users.js
const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");
const QuinipolosController = require("../controllers/QuinipolosController");
const { authenticateToken } = require('../middleware/auth');

// Define a route for fetching all users
// router.get("/users", UserController.getAllUsers);
// Create a new user
router.post("/", UserController.createUser);

// Get quinipolos to answer of the user

router.get('/me/quinipolos', authenticateToken, QuinipolosController.getQuinipolosFromUserLeagues);

// Get user's profile and leagues
router.get('/me/profile', authenticateToken, UserController.getAllUserInformation);

// Get user's basic data
router.get("/user/data/:username", UserController.getUserBasicData);

// Get an user's role
router.get("/api/user/role/:email", UserController.getUserRole);


module.exports = router;
