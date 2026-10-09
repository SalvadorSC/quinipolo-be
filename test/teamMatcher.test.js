process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test-service-key";
process.env.NODE_ENV ||= "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  installTeamMap,
  resetTeamMap,
  matchTeamNameSync,
  titleCaseTeamName,
} = require("../services/scraper/teamMatcher");

// Snapshot of GET https://quinipolo.onrender.com/api/teams/waterpolo
const teams = require("./fixtures/waterpolo-teams.json");

test.before(() => {
  installTeamMap(teams);
});

test.after(() => {
  resetTeamMap();
});

function match(name, leagueId) {
  const champions = leagueId === "CL" || leagueId === "CLF";
  return matchTeamNameSync(name, champions, leagueId);
}

test("reserve squads follow the competition and an explicit B or 2", () => {
  assert.equal(match("Real Canoe", "DHM"), "Real Canoe N.C. M");
  assert.equal(match("REAL CANOE N.C.", "SDM"), "Real Canoe N.C. 2 M");
  assert.equal(match("Real Canoe 2", "DHM"), "Real Canoe N.C. 2 M");
  assert.equal(match("Echeyde", "DHM"), "C.N. Echeyde M");
  assert.equal(match("C.N. ECHEYDE", "PDM"), "C.N. Echeyde M");
  assert.equal(match("Echeyde B", "PDM"), "C.N. Echeyde B M");
  assert.equal(match("C.D. WATERPOLO NAVARRA", "SDM"), "C. Waterpolo Navarra M");
  assert.equal(match("REAL CANOE N.C.", "DHF"), "Real Canoe N.C. F");
});

test("gendered team wins over the ungendered duplicate for that league", () => {
  assert.equal(match("C.D. WATERPOLO TURIA", "PDM"), "C.D. Waterpolo Turia M");
  assert.equal(match("Waterpolo Turia", "PDF"), "C.D. Waterpolo Turia F");
  assert.equal(match("C.N. LAS PALMAS", "PDM"), "C.N. Las Palmas M");
  assert.equal(match("CN Las Palmas", "PDM"), "C.N. Las Palmas M");
  assert.equal(match("C.N. SANT FELIU", "PDM"), "C.N. Sant Feliu M");
  assert.equal(match("Sant Feliu", "PDF"), "C.N. Sant Feliu F");
  assert.equal(match("C.N. CIUDAD DE ALCORCON", "SDM"), "C.C Ciudad de Alcorcon M");
  assert.equal(match("CN Ciudad de Alcorcón", "SDM"), "C.C Ciudad de Alcorcon M");
  assert.equal(match("C.D. WATERPOLO MALAGA", "SDM"), "C.D. Waterpolo Malaga M");
  assert.equal(match("Waterpolo Málaga", "PDF"), "C.D. Waterpolo Malaga F");
  assert.equal(match("C.N. METROPOLE", "SDM"), "C.N. Metropole M");
  assert.equal(match("Metropole", "SDM"), "C.N. Metropole M");
});

test("known clubs map, and unknown names are title-cased", () => {
  assert.equal(match("CLUB WATERPOLO ELX", "PDM"), "C. Waterpolo Elx M");
  assert.equal(match("CLUB WATERPOLO ELX", "PDF"), "C. Waterpolo Elx F");
  assert.equal(match("C. ASKARTZA", "PDM"), "Claret Askartza M");
  assert.equal(match("C. ASKARTZA", "PDF"), "Askartza F");
  assert.equal(match("LEIOA I.T.", "PDF"), "Leioa Waterpolo F");
  assert.equal(match("CLUB NOU GODELLA NATACIÓN", "SDM"), "C.N. Godella M");
  assert.equal(
    match("FAUCA UNIÓN WATERPOLO TENERIFE", "SDM"),
    "Unión Waterpolo Tenerife M"
  );
  assert.equal(match("E.M. EL OLIVAR", "SDM"), "E.M. El Olivar");
  assert.equal(match("Spandau F", "CLF"), "Spandau F");
  assert.equal(titleCaseTeamName("E.M. EL OLIVAR"), "E.M. El Olivar");
});

test("other weekend names still land on the gendered first team", () => {
  assert.equal(match("Barceloneta", "DHM"), "C.N. Atlètic-Barceloneta M");
  assert.equal(match("Sabadell", "DHM"), "C.N. Sabadell M");
  assert.equal(match("Sabadell F", "CLF"), "C.N. Sabadell F");
  assert.equal(match("Mataró", "DHM"), "C.N. Mataró M");
  assert.equal(match("C.W. DOS HERMANAS", "SDM"), "C. Waterpolo Dos Hermanas M");
  assert.equal(match("C.W. DOS HERMANAS", "PDF"), "C. Waterpolo Dos Hermanas F");
  assert.equal(match("U.E. HORTA", "PDM"), "U.E Horta M");
  assert.equal(
    match("C. WATERPOLO CIUDAD DE RIVAS", "PDF"),
    "Waterpolo Ciudad de Rivas F"
  );
});
