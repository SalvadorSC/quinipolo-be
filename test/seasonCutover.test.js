const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isLeagueFinished,
  finishedLeagueErrorBody,
  rejectIfLeagueFinished,
  LEAGUE_STATUS_FINISHED,
} = require("../services/leagueStatus");
const { matchdayNumber } = require("../services/globalMatchday");
const {
  NEW_GLOBAL_LEAGUE_ID,
  NEW_GLOBAL_LEAGUE_NAME,
  PREVIOUS_GLOBAL_LEAGUE_ID,
  isCnberasLeague,
  labelPreviousGlobalName,
  planSeasonCutover,
} = require("../services/seasonCutover");

const PREVIOUS = PREVIOUS_GLOBAL_LEAGUE_ID;
const CNBERAS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function league(partial) {
  return {
    status: "active",
    tier: "managed",
    created_by: "user-1",
    ...partial,
  };
}

test("finished league error is stable for the frontend", () => {
  const body = finishedLeagueErrorBody();
  assert.equal(body.code, "LEAGUE_FINISHED");
  assert.equal(body.league_status, "finished");
  assert.match(body.error, /finalizada/i);
  assert.equal(isLeagueFinished("finished"), true);
  assert.equal(isLeagueFinished({ status: "active" }), false);
  assert.equal(isLeagueFinished(null), false);
});

test("rejectIfLeagueFinished sends 409 only for finished leagues", () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  assert.equal(rejectIfLeagueFinished(res, { status: "active" }), false);
  assert.equal(res.statusCode, null);

  assert.equal(
    rejectIfLeagueFinished(res, { status: LEAGUE_STATUS_FINISHED }),
    true
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "LEAGUE_FINISHED");
});

test("2025-2026 Global keeps the matchday offset; the new Global does not", () => {
  assert.equal(matchdayNumber(PREVIOUS, 3, PREVIOUS), 1);
  assert.equal(matchdayNumber(PREVIOUS, 1, PREVIOUS), 1);
  assert.equal(matchdayNumber(NEW_GLOBAL_LEAGUE_ID, 3, PREVIOUS), 3);
  assert.equal(matchdayNumber(OTHER, 4, PREVIOUS), 4);
});

test("previous Global name gains a single 2025-2026 label", () => {
  assert.equal(labelPreviousGlobalName("Global"), "Global (2025-2026)");
  assert.equal(
    labelPreviousGlobalName("Liga Waterpolo España"),
    "Liga Waterpolo España (2025-2026)"
  );
  assert.equal(
    labelPreviousGlobalName("Global (2025-2026)"),
    "Global (2025-2026)"
  );
  assert.equal(
    labelPreviousGlobalName("Liga 2025–2026"),
    "Liga 2025–2026"
  );
});

test("CNBeras matches name variants and an explicit id, not similar leagues", () => {
  assert.equal(isCnberasLeague(league({ league_name: "CNBeras" })), true);
  assert.equal(isCnberasLeague(league({ league_name: "  cn beras " })), true);
  assert.equal(isCnberasLeague(league({ league_name: "CN-Beras" })), true);
  assert.equal(isCnberasLeague(league({ league_name: "CN Berás" })), true);
  assert.equal(isCnberasLeague(league({ league_name: "CNBeras Amigos" })), false);
  assert.equal(
    isCnberasLeague(
      league({ id: CNBERAS, league_name: "Beras privado" }),
      CNBERAS
    ),
    true
  );
});

test("cutover finishes every league except CNBeras and the new Global", () => {
  const plan = planSeasonCutover([
    league({
      id: PREVIOUS,
      league_name: "Liga Waterpolo España",
    }),
    league({ id: CNBERAS, league_name: "CNBeras" }),
    league({ id: OTHER, league_name: "Liga Amigos", status: "inactive" }),
    league({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      league_name: "Ya cerrada",
      status: "finished",
    }),
  ]);

  assert.equal(plan.blocked, false);
  assert.equal(plan.rename.to, "Liga Waterpolo España (2025-2026)");
  assert.deepEqual(
    plan.toFinish.map((row) => row.id).sort(),
    [PREVIOUS, OTHER].sort()
  );
  assert.equal(plan.alreadyFinished.length, 1);
  assert.equal(plan.cnberasMatches.length, 1);
  assert.equal(plan.cnberasMatches[0].id, CNBERAS);
  assert.equal(
    plan.toFinish.some((row) => row.league_name === "CNBeras"),
    false
  );
  assert.equal(plan.enrollmentLeagueId, NEW_GLOBAL_LEAGUE_ID);
  assert.equal(plan.newGlobalName, NEW_GLOBAL_LEAGUE_NAME);
});

test("cutover refuses to finish leagues when CNBeras cannot be identified", () => {
  const plan = planSeasonCutover([
    league({ id: PREVIOUS, league_name: "Global" }),
    league({ id: OTHER, league_name: "Otra liga" }),
  ]);

  assert.equal(plan.blocked, true);
  assert.match(plan.blockedReasons.join(" "), /CNBeras/);
  assert.equal(plan.cnberasMatches.length, 0);
});

test("explicit CNBeras id excludes that row even when the name differs", () => {
  const plan = planSeasonCutover(
    [
      league({ id: PREVIOUS, league_name: "Global" }),
      league({ id: CNBERAS, league_name: "Liga del club" }),
    ],
    { cnberasId: CNBERAS }
  );

  assert.equal(plan.blocked, false);
  assert.deepEqual(
    plan.toFinish.map((row) => row.id),
    [PREVIOUS]
  );
  assert.equal(plan.cnberasRepair.length, 0);
});

test("CNBeras already finished is repaired, not left closed", () => {
  const plan = planSeasonCutover([
    league({ id: PREVIOUS, league_name: "Global" }),
    league({ id: CNBERAS, league_name: "CNBeras", status: "finished" }),
  ]);

  assert.equal(plan.blocked, false);
  assert.equal(plan.cnberasRepair.length, 1);
  assert.equal(
    plan.toFinish.some((row) => row.id === CNBERAS),
    false
  );
});

test("existing Global 2026-2027 is reused and not finished", () => {
  const existingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const plan = planSeasonCutover([
    league({ id: PREVIOUS, league_name: "Global (2025-2026)" }),
    league({ id: CNBERAS, league_name: "CNBeras" }),
    league({
      id: existingId,
      league_name: NEW_GLOBAL_LEAGUE_NAME,
      status: "finished",
    }),
  ]);

  assert.equal(plan.blocked, false);
  assert.equal(plan.rename.changed, false);
  assert.equal(plan.enrollmentLeagueId, existingId);
  assert.equal(plan.newGlobalNeedsReactivate, true);
  assert.equal(
    plan.toFinish.some((row) => row.id === existingId),
    false
  );
  assert.equal(plan.warnings.length > 0, true);
});

test("missing previous Global blocks the cutover", () => {
  const plan = planSeasonCutover([
    league({ id: CNBERAS, league_name: "CNBeras" }),
  ]);
  assert.equal(plan.blocked, true);
  assert.match(plan.blockedReasons.join(" "), /Previous Global/);
});
