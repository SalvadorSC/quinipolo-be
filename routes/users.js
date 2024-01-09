// routes/users.js
const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");

// Define a route for fetching all users
router.get("/users", UserController.getAllUsers);

module.exports = router;
