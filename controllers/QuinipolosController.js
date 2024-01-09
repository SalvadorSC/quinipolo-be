// controllers/UserController.js
const Quinipolo = require("../models/Quinipolo");

const getAllQuinipolo = async (req, res) => {
  try {
    console.log("Fetching all quinipolos");
    const quinipolos = await Quinipolo.find();
    res.status(200).json(quinipolos);
  } catch (error) {
    console.error("Error fetching quinipolos:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createNewQuinipolo = async (req, res) => {
  try {
    const newQuinipolo = new Quinipolo(req.body);
    await newQuinipolo.save();
    console.log("Quinipolo created successfully:", newQuinipolo);
    res.status(201).json(newQuinipolo);
  } catch (error) {
    console.error("Error creating Quinipolo:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getQuinipoloByLeague = async (req, res) => {
  try {
    const league = req.params.league;
    const quinipolos = await Quinipolo.find({ league: league });
    res.status(200).json(quinipolos);
  } catch (error) {
    console.error("Error fetching Quinipolos:", error);
    res.status(500).send(`Internal Server Error ${req.params.league}`);
  }
};

module.exports = { getAllQuinipolo, createNewQuinipolo, getQuinipoloByLeague };
