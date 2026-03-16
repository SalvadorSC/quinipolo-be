// controllers/SeedController.js
// Seeds mock answer submissions for the latest expired uncorrected quinipolo
// in a given league. Only accessible to systemAdmin users.
// Intended for testing corrections and submission flows in the test league.

const { supabase } = require("../services/supabaseClient");

const GOAL_RANGES = ["-", "11/12", "+"];

const seedLeagueTestData = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = req.user.id;

    // 1. Verify caller is a systemAdmin
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      userProfile.role !== "admin" &&
      userProfile.role !== "system_admin"
    ) {
      return res.status(403).json({
        error:
          "Insufficient permissions. Only system administrators can seed test data.",
      });
    }

    // 2. Find the latest expired uncorrected quinipolo for this league
    const now = new Date().toISOString();
    const { data: quinipolos, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id, quinipolo, end_date")
      .eq("league_id", leagueId)
      .eq("has_been_corrected", false)
      .eq("is_deleted", false)
      .lt("end_date", now)
      .order("end_date", { ascending: false })
      .limit(1);

    if (quinipoloError) {
      return res
        .status(500)
        .json({ error: "Failed to fetch quinipolos", detail: quinipoloError });
    }

    if (!quinipolos || quinipolos.length === 0) {
      return res.status(404).json({
        error: "No expired uncorrected quinipolo found for this league.",
      });
    }

    const quinipolo = quinipolos[0];
    const matches = quinipolo.quinipolo || [];

    if (matches.length === 0) {
      return res
        .status(400)
        .json({ error: "Quinipolo has no matches to generate answers for." });
    }

    // 3. Get all league participants (up to 10)
    const { data: userLeagues, error: ulError } = await supabase
      .from("user_leagues")
      .select("user_id")
      .eq("league_id", leagueId)
      .limit(10);

    if (ulError) {
      return res
        .status(500)
        .json({ error: "Failed to fetch participants", detail: ulError });
    }

    if (!userLeagues || userLeagues.length === 0) {
      return res
        .status(404)
        .json({ error: "No participants found in this league." });
    }

    const participantIds = userLeagues.map((ul) => ul.user_id);

    // 4. Skip participants who already have answers for this quinipolo
    const { data: existingAnswers } = await supabase
      .from("answers")
      .select("user_id")
      .eq("quinipolo_id", quinipolo.id)
      .in("user_id", participantIds);

    const alreadyAnswered = new Set(
      (existingAnswers || []).map((a) => a.user_id)
    );
    const toSeed = participantIds.filter((uid) => !alreadyAnswered.has(uid));

    if (toSeed.length === 0) {
      return res.status(200).json({
        message: "All participants have already answered this quinipolo.",
        quinipoloId: quinipolo.id,
        seededCount: 0,
        skippedCount: participantIds.length,
      });
    }

    // 5. Build random answers for each unseeded participant
    const answerInserts = toSeed.map((uid) => {
      const answers = matches.map((match, index) => {
        const matchNumber = index + 1;
        const chosenWinner =
          Math.random() < 0.5 ? match.homeTeam : match.awayTeam;

        if (matchNumber === 15) {
          return {
            matchNumber,
            chosenWinner,
            goalsHomeTeam:
              GOAL_RANGES[Math.floor(Math.random() * GOAL_RANGES.length)],
            goalsAwayTeam:
              GOAL_RANGES[Math.floor(Math.random() * GOAL_RANGES.length)],
          };
        }
        return { matchNumber, chosenWinner };
      });

      return {
        user_id: uid,
        quinipolo_id: quinipolo.id,
        answers,
        submitted_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase
      .from("answers")
      .insert(answerInserts);

    if (insertError) {
      return res.status(500).json({
        error: "Failed to insert mock answers",
        detail: insertError,
      });
    }

    // 6. Update participants_who_answered on the quinipolo
    const { data: currentQ } = await supabase
      .from("quinipolos")
      .select("participants_who_answered")
      .eq("id", quinipolo.id)
      .single();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", toSeed);

    const newUsernames = (profiles || [])
      .map((p) => p.username)
      .filter(Boolean);
    const existingParticipants = currentQ?.participants_who_answered || [];

    await supabase
      .from("quinipolos")
      .update({
        participants_who_answered: [...existingParticipants, ...newUsernames],
      })
      .eq("id", quinipolo.id);

    console.log(
      `[SeedController] Seeded ${toSeed.length} answers for quinipolo ${quinipolo.id} in league ${leagueId}`
    );

    return res.status(200).json({
      message: `Seeded ${toSeed.length} mock answer(s).`,
      quinipoloId: quinipolo.id,
      seededCount: toSeed.length,
      skippedCount: alreadyAnswered.size,
    });
  } catch (error) {
    console.error("Error seeding test data:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { seedLeagueTestData };
