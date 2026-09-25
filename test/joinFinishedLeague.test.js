const test = require("node:test");
const assert = require("node:assert/strict");

process.env.GLOBAL_LEAGUE_ID =
  process.env.GLOBAL_LEAGUE_ID || "11111111-1111-4111-8111-111111111111";

const calls = [];
let respond = () => ({ data: null, error: null });

function run(state, mode) {
  const snapshot = {
    table: state.table,
    op: state.op || "select",
    filters: state.filters.map((filter) => filter.slice()),
    payload: state.payload,
    mode,
  };
  calls.push(snapshot);
  return respond(snapshot);
}

function chain(state) {
  const builder = new Proxy(function query() {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve, reject) =>
          Promise.resolve(run(state, "list")).then(resolve, reject);
      }
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve(run(state, "single"));
      }
      return (...args) => {
        if (prop === "insert" || prop === "update") {
          state.op = prop;
          state.payload = args[0];
        } else if (prop === "select") {
          if (state.op !== "insert" && state.op !== "update") {
            state.op = "select";
          }
        } else if (prop === "eq") {
          state.filters.push([args[0], args[1]]);
        }
        return builder;
      };
    },
  });
  return builder;
}

const supabase = {
  from(table) {
    return chain({ table, op: null, filters: [], payload: null });
  },
};

function stub(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

stub("../services/supabaseClient", { supabase });
stub("../models/Leaderboard", {});
stub("../models/User", {});

const {
  joinLeague,
  joinLeagueByIdSupabase,
  joinLeagueByShareLink,
  acceptParticipantPetition,
  updateLeagueModerators,
} = require("../controllers/LeaguesController");
const { finishedLeagueErrorBody } = require("../services/leagueStatus");

const GLOBAL_ID = process.env.GLOBAL_LEAGUE_ID;

function filterValue(call, column) {
  const found = call.filters.find((filter) => filter[0] === column);
  return found ? found[1] : undefined;
}

function memberInserts() {
  return calls.filter(
    (call) => call.table === "user_leagues" && call.op === "insert"
  );
}

function useLeague({
  status,
  members = [],
  profileId = "user-1",
  petitionUserId = "user-1",
}) {
  respond = (call) => {
    if (call.table === "profiles") {
      if (call.mode === "list") {
        return {
          data: [{ id: profileId, username: "ana" }],
          error: null,
        };
      }
      return { data: { id: profileId }, error: null };
    }

    if (call.table === "leagues") {
      return {
        data: {
          id: filterValue(call, "id") || "league-1",
          status,
          league_name: "Liga",
          description: "Temporada",
          created_by: "creator",
        },
        error: null,
      };
    }

    if (call.table === "user_leagues" && call.op === "select") {
      if (call.mode === "list") {
        return { data: members, error: null };
      }
      const userId = filterValue(call, "user_id");
      const member = members.find((row) => row.user_id === userId);
      return member
        ? { data: member, error: null }
        : { data: null, error: null };
    }

    if (call.table === "league_share_links" && call.op === "select") {
      return {
        data: {
          id: "link-1",
          league_id: "league-1",
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          max_uses: null,
          uses_count: 0,
          is_active: true,
        },
        error: null,
      };
    }

    if (
      call.table === "league_petitions" &&
      call.op === "select" &&
      call.mode === "single"
    ) {
      return {
        data: {
          id: "pet-1",
          user_id: petitionUserId,
          username: "ana",
          type: "participant",
          status: "pending",
        },
        error: null,
      };
    }

    return { data: null, error: null };
  };
}

function mockRes() {
  return {
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
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test.beforeEach(() => {
  calls.length = 0;
});

test("join by id rejects a finished league with the create-blocked error", async () => {
  useLeague({ status: "finished" });
  const res = mockRes();

  await joinLeague(
    { body: { leagueId: "league-1", username: "ana" } },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, finishedLeagueErrorBody());
  assert.equal(memberInserts().length, 0);
});

test("join by id still adds a member to active, inactive, and suspended leagues", async () => {
  for (const status of ["active", "inactive", "suspended"]) {
    calls.length = 0;
    useLeague({ status });
    const res = mockRes();

    await joinLeague(
      { body: { leagueId: "league-1", username: "ana" } },
      res
    );

    assert.equal(res.statusCode, 200, status);
    assert.equal(memberInserts().length, 1, status);
    assert.deepEqual(memberInserts()[0].payload, {
      user_id: "user-1",
      league_id: "league-1",
      role: "participant",
    });
  }
});

test("joining a finished league is a no-op for someone already in it", async () => {
  useLeague({
    status: "finished",
    members: [{ user_id: "user-1", role: "participant" }],
  });
  const res = mockRes();

  await joinLeague(
    { body: { leagueId: "league-1", username: "ana" } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(memberInserts().length, 0);
});

test("share link join rejects a finished league and does not consume the link", async () => {
  useLeague({ status: "finished" });
  const res = mockRes();

  await joinLeagueByShareLink(
    {
      params: { shareToken: "tok" },
      body: { userId: "user-1", username: "ana" },
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "LEAGUE_FINISHED");
  assert.equal(memberInserts().length, 0);
  assert.equal(
    calls.filter(
      (call) => call.table === "league_share_links" && call.op === "update"
    ).length,
    0
  );
});

test("share link join still enrolls into an active league", async () => {
  useLeague({ status: "active" });
  const res = mockRes();

  await joinLeagueByShareLink(
    {
      params: { shareToken: "tok" },
      body: { userId: "user-1", username: "ana" },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Successfully joined league");
  assert.equal(memberInserts().length, 1);
  assert.equal(
    calls.filter(
      (call) => call.table === "league_share_links" && call.op === "update"
    ).length,
    1
  );
});

test("auto-enroll alias global follows the live league status", async () => {
  useLeague({ status: "finished" });
  const refused = await joinLeagueByIdSupabase("global", "user-1", "ana");
  assert.equal(refused.league.status, "finished");
  assert.equal(refused.league.id, GLOBAL_ID);
  assert.equal(memberInserts().length, 0);

  calls.length = 0;
  useLeague({ status: "active" });
  const joined = await joinLeagueByIdSupabase("global", "user-1", "ana");
  assert.equal(joined, undefined);
  assert.equal(memberInserts().length, 1);
  assert.equal(memberInserts()[0].payload.league_id, GLOBAL_ID);
  assert.equal(memberInserts()[0].payload.role, "participant");
});

test("accepting a participant petition does not join a finished league", async () => {
  useLeague({ status: "finished" });
  const res = mockRes();

  await acceptParticipantPetition(
    { params: { leagueId: "league-1", petitionId: "pet-1" } },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, finishedLeagueErrorBody());
  assert.equal(memberInserts().length, 0);
  assert.equal(
    calls.filter(
      (call) => call.table === "league_petitions" && call.op === "update"
    ).length,
    0
  );
});

test("accepting a petition for an existing member of a finished league does not insert", async () => {
  useLeague({
    status: "finished",
    members: [{ user_id: "user-1", role: "participant" }],
  });
  const res = mockRes();

  await acceptParticipantPetition(
    { params: { leagueId: "league-1", petitionId: "pet-1" } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(memberInserts().length, 0);
});

test("moderator update cannot add a new member to a finished league", async () => {
  useLeague({
    status: "finished",
    members: [{ user_id: "creator", role: "moderator" }],
  });
  const res = mockRes();

  await updateLeagueModerators(
    {
      params: { leagueId: "league-1" },
      body: { moderatorIds: ["new-user"] },
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "LEAGUE_FINISHED");
  assert.equal(memberInserts().length, 0);
});

test("moderator role edits on a finished league still apply to current members", async () => {
  useLeague({
    status: "finished",
    members: [{ user_id: "creator", role: "moderator" }],
  });
  const res = mockRes();

  await updateLeagueModerators(
    {
      params: { leagueId: "league-1" },
      body: { moderatorIds: ["creator"] },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(memberInserts().length, 0);
});
