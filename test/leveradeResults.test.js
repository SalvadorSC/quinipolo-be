process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ||= "test-service-key";
process.env.NODE_ENV ||= "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseLeveradeResults } = require("../services/scraper/leverade");
const { matchResultsToQuestions } = require("../services/scraper/resultsService");

const PDM = { id: "PDM", name: "Primera División Masculina" };

function result(id, teamId, value, periodId = null) {
  return {
    type: "result",
    id,
    attributes: { value },
    relationships: {
      team: { data: { type: "team", id: teamId } },
      period: { data: periodId ? { type: "period", id: periodId } : null },
    },
  };
}

function match(id, attrs, homeId, awayId, resultIds) {
  return {
    type: "match",
    id,
    attributes: {
      datetime: "2026-10-17 10:30:00",
      finished: true,
      canceled: false,
      postponed: false,
      rest: false,
      ...attrs,
    },
    meta: { home_team: homeId, away_team: awayId },
    relationships: {
      // Leverade's teams order is not home/away; meta is.
      teams: { data: [{ type: "team", id: awayId }, { type: "team", id: homeId }] },
      results: { data: resultIds.map((rid) => ({ type: "result", id: rid })) },
    },
  };
}

const teams = [
  { type: "team", id: "t-premia", attributes: { name: "C.N. PREMIA" } },
  { type: "team", id: "t-palma", attributes: { name: "C.N. CIUTAT DE PALMA" } },
];

test("finished Leverade match gives match-level score with meta home/away", () => {
  const payload = {
    data: [match("145435770", {}, "t-premia", "t-palma", ["r1", "r2", "r3", "r4"])],
    included: [
      ...teams,
      result("r1", "t-premia", 10),
      result("r2", "t-palma", 11),
      // per-period rows must be ignored
      result("r3", "t-premia", 3, "p1"),
      result("r4", "t-palma", 2, "p1"),
    ],
  };

  const [row] = parseLeveradeResults(payload, PDM);
  assert.equal(row.homeTeam, "C.N. PREMIA");
  assert.equal(row.awayTeam, "C.N. CIUTAT DE PALMA");
  assert.equal(row.homeScore, 10);
  assert.equal(row.awayScore, 11);
  assert.equal(row.source, "leverade");
  assert.equal(row.startTime, "2026-10-17T10:30:00.000Z");
});

test("unfinished, postponed or scoreless matches are not results", () => {
  const payload = {
    data: [
      match("1", { finished: false }, "t-premia", "t-palma", ["a1", "a2"]),
      match("2", { postponed: true }, "t-premia", "t-palma", ["b1", "b2"]),
      match("3", {}, "t-premia", "t-palma", []),
    ],
    included: [
      ...teams,
      result("a1", "t-premia", 0),
      result("a2", "t-palma", 0),
      result("b1", "t-premia", 0),
      result("b2", "t-palma", 0),
    ],
  };
  assert.deepEqual(parseLeveradeResults(payload, PDM), []);
});

test("fallback only fills the questions it is given", () => {
  const questions = [
    { homeTeam: "C.N. Barcelona M", awayTeam: "C.N. Terrassa M", date: "2026-10-18T11:30:00.000Z" },
    { homeTeam: "C.N. Premià M", awayTeam: "C.N. Ciutat de Palma M", date: "2026-10-17T10:30:00.000Z" },
  ];
  const teamMap = [
    { id: "premia", name: "C.N. Premià M" },
    { id: "palma", name: "C.N. Ciutat de Palma M" },
  ];
  const results = [
    {
      leagueId: "PDM",
      homeTeam: "C.N. PREMIA",
      awayTeam: "C.N. CIUTAT DE PALMA",
      homeTeamMatched: "C.N. Premià M",
      awayTeamMatched: "C.N. Ciutat de Palma M",
      homeTeamId: "premia",
      awayTeamId: "palma",
      startTime: "2026-10-17T10:30:00.000Z",
      homeScore: 10,
      awayScore: 11,
      source: "leverade",
    },
  ];

  const filled = matchResultsToQuestions(results, questions, "league-uuid", teamMap, [1]);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].matchNumber, 2);
  assert.equal(filled[0].outcome, "C.N. Ciutat de Palma M");
  assert.equal(filled[0].source, "leverade");

  assert.deepEqual(matchResultsToQuestions(results, questions, "league-uuid", teamMap, [0]), []);
});
