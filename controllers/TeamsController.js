// controllers/TeamsController.js
const { supabase } = require("../services/supabaseClient");
const {
  resolveTeamLogoSource,
  findClosestMatchFromIndex,
} = require("../graphics/utils/teamLogoResolver");
const teamNameToImage = require("../graphics/data/teamNameToImage.json");
const { detectDuplicateGroups } = require("../services/teamDuplicateDetector");

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

const getWaterpoloTeams = async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .ilike("sport", "waterpolo")
      .order("name");

    if (error) {
      console.error("Error fetching waterpolo teams from Supabase:", error);
      return res.status(500).send("Internal Server Error");
    }

    res.status(200).json(teams ?? []);
  } catch (error) {
    console.error("Error in getWaterpoloTeams:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getWaterpoloTeamsFull = async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .ilike("sport", "waterpolo")
      .order("name");

    if (error) {
      console.error("Error fetching waterpolo teams from Supabase:", error);
      return res.status(500).send("Internal Server Error");
    }

    const withLogoAudit = await Promise.all(
      (teams ?? []).map(async (team) => {
        const aliases = Array.isArray(team.alias) ? team.alias : [];
        const logoFile = await resolveTeamLogoSource(team.name, teamNameToImage, aliases);
        const closestMatch =
          !logoFile && findClosestMatchFromIndex(team.name);
        return {
          ...team,
          alias: aliases,
          logoStatus: logoFile
            ? { resolved: true, logoFile }
            : { resolved: false, closestMatch: closestMatch || null },
        };
      })
    );

    res.status(200).json(withLogoAudit);
  } catch (err) {
    console.error("Error in getWaterpoloTeamsFull:", err);
    res.status(500).send("Internal Server Error");
  }
};

const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { gender, alias, name, sport } = req.body;

    const updates = {};
    if (gender !== undefined) updates.gender = gender === null || gender === "" ? null : gender;
    if (alias !== undefined) updates.alias = Array.isArray(alias) ? alias : [];
    if (name !== undefined && typeof name === "string" && name.trim()) updates.name = name.trim();
    if (sport !== undefined && typeof sport === "string" && sport.trim()) updates.sport = sport.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const { data, error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating team:", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error in updateTeam:", err);
    res.status(500).send("Internal Server Error");
  }
};

const getDuplicateGroups = async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("id, name")
      .ilike("sport", "waterpolo");

    if (error) {
      console.error("Error fetching teams:", error);
      return res.status(500).send("Internal Server Error");
    }

    const groups = detectDuplicateGroups(teams ?? []);
    res.status(200).json(groups);
  } catch (err) {
    console.error("Error in getDuplicateGroups:", err);
    res.status(500).send("Internal Server Error");
  }
};

const mergeTeams = async (req, res) => {
  try {
    const { canonicalId, duplicateId } = req.body;

    if (!canonicalId || !duplicateId) {
      return res.status(400).json({ error: "canonicalId and duplicateId required" });
    }

    if (canonicalId === duplicateId) {
      return res.status(400).json({ error: "Cannot merge team into itself" });
    }

    const { data: canonical, error: errCanonical } = await supabase
      .from("teams")
      .select("id, name, alias")
      .eq("id", canonicalId)
      .single();

    if (errCanonical || !canonical) {
      return res.status(404).json({ error: "Canonical team not found" });
    }

    const { data: duplicate, error: errDuplicate } = await supabase
      .from("teams")
      .select("id, name, alias")
      .eq("id", duplicateId)
      .single();

    if (errDuplicate || !duplicate) {
      return res.status(404).json({ error: "Duplicate team not found" });
    }

    const { data: quinipolos, error: errQ } = await supabase
      .from("quinipolos")
      .select("id, quinipolo")
      .not("quinipolo", "is", null);

    if (errQ) {
      return res.status(500).json({ error: "Failed to fetch quinipolos" });
    }

    const duplicateName = duplicate.name;
    const canonicalName = canonical.name;
    let quinipolosUpdated = 0;

    for (const q of quinipolos ?? []) {
      const items = Array.isArray(q.quinipolo) ? q.quinipolo : [];
      let changed = false;
      const updated = items.map((item) => {
        let home = item.homeTeam || "";
        let away = item.awayTeam || "";
        const homeBase = home.split("__")[0];
        const awayBase = away.split("__")[0];
        const homeSuffix = home.includes("__") ? "__" + home.split("__").slice(1).join("__") : "";
        const awaySuffix = away.includes("__") ? "__" + away.split("__").slice(1).join("__") : "";

        if (homeBase === duplicateName) {
          home = canonicalName + homeSuffix;
          changed = true;
        }
        if (awayBase === duplicateName) {
          away = canonicalName + awaySuffix;
          changed = true;
        }
        return { ...item, homeTeam: home, awayTeam: away };
      });

      if (changed) {
        const { error: updateErr } = await supabase
          .from("quinipolos")
          .update({ quinipolo: updated })
          .eq("id", q.id);
        if (!updateErr) quinipolosUpdated++;
      }
    }

    const existingAliases = Array.isArray(canonical.alias) ? canonical.alias : [];
    const newAliases = [...new Set([...existingAliases, duplicateName])];

    const { error: updateErr } = await supabase
      .from("teams")
      .update({ alias: newAliases })
      .eq("id", canonicalId);

    if (updateErr) {
      return res.status(500).json({ error: "Failed to update canonical team aliases" });
    }

    const { error: deleteErr } = await supabase.from("teams").delete().eq("id", duplicateId);

    if (deleteErr) {
      return res.status(500).json({ error: "Failed to delete duplicate team" });
    }

    res.status(200).json({
      merged: true,
      canonicalId,
      duplicateId,
      quinipolosUpdated,
    });
  } catch (err) {
    console.error("Error in mergeTeams:", err);
    res.status(500).send("Internal Server Error");
  }
};

const getQuinipoloCountForTeam = async (req, res) => {
  try {
    const teamName = req.query.teamName;
    if (!teamName) {
      return res.status(400).json({ error: "teamName required" });
    }

    const { data: quinipolos, error } = await supabase
      .from("quinipolos")
      .select("id, quinipolo")
      .not("quinipolo", "is", null);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    let count = 0;
    for (const q of quinipolos ?? []) {
      const items = Array.isArray(q.quinipolo) ? q.quinipolo : [];
      for (const item of items) {
        const homeBase = (item.homeTeam || "").split("__")[0];
        const awayBase = (item.awayTeam || "").split("__")[0];
        if (homeBase === teamName || awayBase === teamName) {
          count++;
          break;
        }
      }
    }
    res.status(200).json({ count });
  } catch (err) {
    console.error("Error in getQuinipoloCountForTeam:", err);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  getAllTeams,
  getWaterpoloTeams,
  getWaterpoloTeamsFull,
  updateTeam,
  getDuplicateGroups,
  mergeTeams,
  getQuinipoloCountForTeam,
};
