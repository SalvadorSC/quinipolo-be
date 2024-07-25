// routes/users.js
const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");
const QuinipolosController = require("../controllers/QuinipolosController");

// Define a route for fetching all users
router.get("/users", UserController.getAllUsers);
// Create a new user
router.post("/", UserController.createUser);

// Get quinipolos to answer of the user

router.get(
  "/user/quinipolos?:username",
  QuinipolosController.getQuinipolosFromUserLeagues
);

// Get user's basic data
router.get("/user/data/:username", UserController.getUserBasicData);

// Get an user's role
router.get("/api/user/role/:email", UserController.getUserRole);

module.exports = router;
