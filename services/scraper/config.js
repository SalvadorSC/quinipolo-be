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
  },
  {
    id: "DHF",
    name: "División de Honor Femenina",
    quota: 4,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/division-de-honor-femenina/",
    rfenCompetitionId: 1511,
  },
  {
    id: "PDM",
    name: "Primera División Masculina",
    quota: 3,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/primera-division/",
    rfenCompetitionId: 1512,
  },
  {
    id: "PDF",
    name: "Primera División Femenina",
    quota: 3,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/primera-division-femenina/",
    rfenCompetitionId: 1513,
  },
  {
    id: "SDM",
    name: "Segunda División Masculina",
    quota: 1,
    primarySource: "flashscore",
    flashscoreUrl:
      "https://www.flashscore.es/waterpolo/espana/segunda-division/",
    rfenCompetitionId: 1514,
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

const rfenBaseResultsUrl =
  "https://rfen.es/especialidades/waterpolo/competicion";

module.exports = {
  leagues,
  championsLeagueFeeds,
  championsLeagueReplacementOrder,
  rfenBaseResultsUrl,
};

