const { supabase } = require("../services/supabaseClient");
const {
  computeAnswerStatistics,
} = require("../services/stats/computeAnswerStatistics");

/**
 * Get answer statistics for a quinipolo
 * If statistics don't exist and deadline has passed, compute and store them
 */
const getAnswerStatistics = async (req, res) => {
  const { quinipoloId } = req.params;

  try {
    // First, get the quinipolo to check deadline
    const { data: quinipolo, error: quinipoloError } = await supabase
      .from("quinipolos")
      .select("id, end_date")
      .eq("id", quinipoloId)
      .single();

    if (quinipoloError) {
      return res.status(404).json({ message: "Quinipolo not found" });
    }

    const deadlinePassed = new Date(quinipolo.end_date) < new Date();

    // Try to fetch existing statistics
    const { data: existingStats, error: fetchError } = await supabase
      .from("answer_statistics")
      .select("*")
      .eq("quinipolo_id", quinipoloId)
      .single();

    // If statistics exist, return them
    if (existingStats && !fetchError) {
      return res.status(200).json(existingStats);
    }

    // If deadline hasn't passed, return null (no statistics yet)
    if (!deadlinePassed) {
      return res.status(200).json(null);
    }

    // Deadline passed but no statistics - compute them
    const statistics = await computeAnswerStatistics(quinipoloId);

    if (!statistics) {
      // No answers to compute statistics from
      return res.status(200).json(null);
    }

    // Store statistics in database
    const { data: newStats, error: insertError } = await supabase
      .from("answer_statistics")
      .insert({
        quinipolo_id: quinipoloId,
        statistics: statistics,
        computed_at: statistics.computed_at,
        total_responses: statistics.total_responses,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing answer statistics:", insertError);
      // Still return the computed statistics even if storage fails
      return res.status(200).json({
        quinipolo_id: quinipoloId,
        statistics: statistics,
        computed_at: statistics.computed_at,
        total_responses: statistics.total_responses,
      });
    }

    res.status(200).json(newStats);
  } catch (error) {
    console.error("Error fetching/computing answer statistics:", error);
    res.status(500).json({
      message: "Error fetching answer statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAnswerStatistics,
};


