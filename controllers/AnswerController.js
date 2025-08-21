const { supabase } = require("../services/supabaseClient");

const submitQuinipoloAnswer = async (req, res) => {
  try {
    const { quinipoloId, answers, username } = req.body;
    console.log("Received answer submission:", {
      quinipoloId,
      username,
      answersCount: answers?.length,
    });

    // Validate User by username and get user_id
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (userError) {
      return res.status(404).send("User not found");
    }

    // Validate Quinipolo
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id")
      .eq("id", quinipoloId)
      .single();

    if (quinipoloError) {
      return res.status(404).send("Quinipolo survey not found");
    }

    // Check if the user has already answered this Quinipolo
    const { data: existingAnswer } = await supabase
      .from("answers")
      .select("id")
      .eq("user_id", user.id)
      .eq("quinipolo_id", quinipoloId)
      .single();

    if (existingAnswer) {
      return res.status(409).send("User has already answered this Quinipolo");
    }

    // Clean and validate answers
    const cleanAnswers = answers.map((answer) => {
      // Remove the index suffix from chosenWinner (e.g., "Team Name__0" -> "Team Name")
      const cleanChosenWinner = answer.chosenWinner.split("__")[0];

      // Clean goals for match 15
      let cleanGoalsHomeTeam = answer.goalsHomeTeam;
      let cleanGoalsAwayTeam = answer.goalsAwayTeam;

      if (answer.matchNumber === 15) {
        cleanGoalsHomeTeam = answer.goalsHomeTeam
          ? answer.goalsHomeTeam.split("__")[0]
          : "";
        cleanGoalsAwayTeam = answer.goalsAwayTeam
          ? answer.goalsAwayTeam.split("__")[0]
          : "";
      }

      return {
        ...answer,
        chosenWinner: cleanChosenWinner,
        goalsHomeTeam: cleanGoalsHomeTeam,
        goalsAwayTeam: cleanGoalsAwayTeam,
      };
    });

    const isValidAnswer = (answer) => {
      if (!answer.matchNumber || !answer.chosenWinner) {
        return false;
      }
      return !(
        answer.matchNumber === 15 &&
        (!answer.goalsHomeTeam || !answer.goalsAwayTeam)
      );
    };

    if (!Array.isArray(cleanAnswers) || !cleanAnswers.every(isValidAnswer)) {
      return res.status(400).send("Invalid answers format");
    }

    // Save the answers
    console.log("Saving cleaned answers:", cleanAnswers);
    const { error: insertError } = await supabase.from("answers").insert({
      user_id: user.id,
      quinipolo_id: quinipoloId,
      answers: cleanAnswers,
      submitted_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).send("Failed to save answers");
    }

    // Update participants who answered - handle null array case
    try {
      // First get current participants list
      const { data: currentQuinipolo, error: fetchError } = await supabase
        .from("quinipolos")
        .select("participants_who_answered")
        .eq("id", quinipoloId)
        .single();

      if (fetchError) {
        console.warn("Failed to fetch current participants:", fetchError);
      } else {
        // Update with new participant
        const currentParticipants =
          currentQuinipolo.participants_who_answered || [];
        const updatedParticipants = [...currentParticipants, username];

        const { error: updateError } = await supabase
          .from("quinipolos")
          .update({
            participants_who_answered: updatedParticipants,
          })
          .eq("id", quinipoloId);

        if (updateError) {
          console.warn("Failed to update participants list:", updateError);
        }
      }
    } catch (participantsError) {
      console.warn("Error updating participants:", participantsError);
    }

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
  // First get the user_id from username
  const { data: user, error: userError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (userError) {
    return null;
  }

  const { data: answers, error } = await supabase
    .from("answers")
    .select("*")
    .eq("user_id", user.id)
    .eq("quinipolo_id", quinipoloId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found"
    throw error;
  }

  return answers;
};

module.exports = {
  submitQuinipoloAnswer,
  getQuinipoloAnswerByUsernameAndQuinipoloId,
};
