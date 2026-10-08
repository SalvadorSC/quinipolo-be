// 2026/27 RFEN tournament ids on Leverade. Optional env overrides let a new
// season be pointed at without a code change. Flashscore stays the primary
// source; Leverade only fills leagues that are short inside the auto-fill window.
function envTournamentId(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : fallback;
}

// League configurations
const leagues = [
  {
    id: "DHM",
    name: "División de Honor Masculina",
    quota: 4,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/division-de-honor/",
    rfenCompetitionId: 1510,
    leveradeTournamentId: envTournamentId("LEVERADE_TOURNAMENT_DHM", 1338504),
  },
  {
    id: "DHF",
    name: "División de Honor Femenina",
    quota: 4,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/division-de-honor-femenina/",
    rfenCompetitionId: 1511,
    leveradeTournamentId: envTournamentId("LEVERADE_TOURNAMENT_DHF", 1338505),
  },
  {
    id: "PDM",
    name: "Primera División Masculina",
    quota: 3,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/primera-division/",
    rfenCompetitionId: 1512,
    leveradeTournamentId: envTournamentId("LEVERADE_TOURNAMENT_PDM", 1338507),
  },
  {
    id: "PDF",
    name: "Primera División Femenina",
    quota: 3,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/primera-division-femenina/",
    rfenCompetitionId: 1513,
    leveradeTournamentId: envTournamentId("LEVERADE_TOURNAMENT_PDF", 1338508),
  },
  {
    id: "SDM",
    name: "Segunda División Masculina",
    quota: 1,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/segunda-division/",
    rfenCompetitionId: 1514,
    leveradeTournamentId: envTournamentId("LEVERADE_TOURNAMENT_SDM", 1338515),
  },
];

const championsLeagueFeeds = [
  {
    label: "Champions League (Men)",
    flashscoreUrl: "https://www.flashscore.es/waterpolo/europa/champions-league/",
  },
  {
    label: "Champions League (Women)",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/europa/champions-league-women/",
  },
];

const championsLeagueReplacementOrder = ["DHM", "DHF", "SDM"];

// Champions League women may only fill domestic shortfalls, and never more
// than this many matches in a preset. They do not displace a league that
// already has its quota of real fixtures.
const maxClfFill = 3;

const rfenBaseResultsUrl =
  "https://rfen.es/especialidades/waterpolo/competicion";

module.exports = {
  leagues,
  championsLeagueFeeds,
  championsLeagueReplacementOrder,
  maxClfFill,
  rfenBaseResultsUrl,
};

