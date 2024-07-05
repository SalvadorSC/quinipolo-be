const Answers = require("../models/Answers");
const User = require("../models/User");
const Quinipolo = require("../models/Quinipolo");

const submitQuinipoloAnswer = async (req, res) => {
  try {
    const { userId, quinipoloId, answers } = req.body;

    // Validate User
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Validate Quinipolo
    const quinipolo = await Quinipolo.findById(quinipoloId);
    if (!quinipolo) {
      return res.status(404).send("Quinipolo survey not found");
    }

    // Check if the user has already answered this Quinipolo
    const existingAnswer = await Answers.findOne({ userId, quinipoloId });
    if (existingAnswer) {
      return res.status(409).send("User has already answered this Quinipolo");
    }

    // Validate Answers
    const isValidAnswer = (answer) => {
      if (!answer.matchNumber || !answer.chosenWinner) {
        console.log("Invalid answer:", answer.matchNumber);
        return false;
      }
      return !(
        answer.matchNumber === 15 &&
        (!answer.goalsHomeTeam || !answer.goalsAwayTeam)
      );
    };

    if (!Array.isArray(answers) || !answers.every(isValidAnswer)) {
      return res.status(400).send("Invalid answers format");
    }

    // Save the answers
    const newAnswer = new Answers({
      userId,
      quinipoloId,
      answers,
    });
    await newAnswer.save();

    res.status(200).json({ message: "Answers submitted successfully" });
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  submitQuinipoloAnswer,
};
