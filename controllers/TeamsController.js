// controllers/TeamsController.js
const { supabase } = require("../services/supabaseClient");

const getAllTeams = async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("name, sport, gender, alias")
      .order("name");

    if (error) {
      console.error("Error fetching teams from Supabase:", error);
      return res.status(500).send("Internal Server Error");
    }

    // Group teams by sport
    const grouped = {};
    teams.forEach(({ name, sport, gender, alias }) => {
      if (!grouped[sport]) grouped[sport] = [];
      grouped[sport].push({
        name,
        sport,
        gender: gender ?? null,
        aliases: Array.isArray(alias) ? alias : [],
      });
    });

    res.status(200).json(grouped);
  } catch (error) {
    console.error("Error in getAllTeams:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { getAllTeams };
