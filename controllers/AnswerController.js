const Answers = require("../models/Answers");
const User = require("../models/User");
const Quinipolo = require("../models/Quinipolo");

const submitQuinipoloAnswer = async (req, res) => {
  try {
    const { quinipoloId, answers, username } = req.body;

    // Validate User by username
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Validate Quinipolo
    const quinipolo = await Quinipolo.findById(quinipoloId);
    if (!quinipolo) {
      return res.status(404).send("Quinipolo survey not found");
    }

    // Check if the user has already answered this Quinipolo
    const existingAnswer = await Answers.findOne({ username, quinipoloId });
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

    console.log("Answers:", answers);

    // Save the answers
    const newAnswer = new Answers({
      username,
      quinipoloId,
      answers,
    });
    await newAnswer.save();

    console.log("Answers saved successfully");
    console.log(
      "Participants who answered:",
      quinipolo.participantsWhoAnswered
    );
    console.log("Username:", username);
    quinipolo.participantsWhoAnswered.push(username);
    await quinipolo.save();

    res.status(200).json({ message: "Answers submitted successfully" });
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getQuinipoloAnswerByUsernameAndQuinipoloId = async (
  username,
  quinipoloId
) => {
  const answers = await Answers.findOne({ username, quinipoloId });
  if (!answers) {
    return res.status(404).json({ message: "Answers not found" });
  }
  return answers;
};

module.exports = {
  submitQuinipoloAnswer,
  getQuinipoloAnswerByUsernameAndQuinipoloId,
};
