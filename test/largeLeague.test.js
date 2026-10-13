const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  IN_FILTER_BATCH_SIZE,
  PAGE_SIZE,
  countEq,
  fetchAllEq,
  fetchProfilesByIds,
} = require("../services/batchedQuery");

const GLOBAL_ID = "d1380c88-eaea-43a6-be7d-3d556b8fedce";
const SMALL_ID = "small-league";

function memberId(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function usernameFor(id) {
  return `player-${id.slice(-4)}`;
}

function postgrestProfilesUrl(ids) {
  const filter = `id=in.(${ids.join(",")})`;
  const base =
    "https://xxxxxxxxxxxxxxxxxxxx.supabase.co/rest/v1/profiles?select=id,username&";
  return base + filter;
}

test("400 profile ids overflow a typical 8KB request URL; one batch does not", () => {
  const ids = Array.from({ length: 400 }, (_, index) => memberId(index));
  const full = postgrestProfilesUrl(ids);
  const batched = postgrestProfilesUrl(ids.slice(0, IN_FILTER_BATCH_SIZE));
  assert.ok(full.length > 8000, `full filter was only ${full.length} chars`);
  assert.ok(
    batched.length < 8000,
    `batch filter was ${batched.length} chars`
  );
});

test("fetchProfilesByIds splits 400 ids into safe batches", async () => {
  const ids = Array.from({ length: 400 }, (_, index) => memberId(index));
  const batchSizes = [];
  const client = {
    from(table) {
      assert.equal(table, "profiles");
      let inIds = [];
      const builder = {
        select() {
          return builder;
        },
        in(_column, values) {
          inIds = values.slice();
          return builder;
        },
        then(resolve, reject) {
          batchSizes.push(inIds.length);
          const result =
            inIds.length > IN_FILTER_BATCH_SIZE
              ? { data: null, error: { message: "TypeError: fetch failed" } }
              : {
                  data: inIds.map((id) => ({ id, username: usernameFor(id) })),
                  error: null,
                };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  const profiles = await fetchProfilesByIds(client, ids);
  assert.deepEqual(batchSizes, [100, 100, 100, 100]);
  assert.equal(profiles.length, 400);
  assert.equal(
    profiles.filter((profile) => profile.username === "unknown").length,
    0
  );
});

test("a profile query error is thrown instead of an empty list", async () => {
  const client = {
    from() {
      const builder = {
        select() {
          return builder;
        },
        in() {
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: null,
            error: { message: "TypeError: fetch failed" },
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  await assert.rejects(
    () => fetchProfilesByIds(client, [memberId(0)]),
    /TypeError: fetch failed/
  );
});

test("countEq refuses a missing count instead of reporting zero", async () => {
  const client = {
    from() {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: null, count: null, error: null }).then(
            resolve,
            reject
          );
        },
      };
      return builder;
    },
  };

  await assert.rejects(
    () =>
      countEq(client, {
        table: "user_leagues",
        column: "league_id",
        value: GLOBAL_ID,
      }),
    /was not returned/
  );
});

test("fetchAllEq keeps paging past the row cap", async () => {
  const rows = Array.from({ length: PAGE_SIZE + 200 }, (_, index) => ({
    user_id: memberId(index),
  }));
  const ranges = [];
  const client = {
    from() {
      const state = { range: null };
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        range(from, to) {
          state.range = [from, to];
          return builder;
        },
        then(resolve, reject) {
          ranges.push(state.range.slice());
          const page = rows.slice(state.range[0], state.range[1] + 1);
          return Promise.resolve({ data: page, error: null }).then(
            resolve,
            reject
          );
        },
      };
      return builder;
    },
  };

  const all = await fetchAllEq(client, {
    table: "user_leagues",
    columns: "user_id",
    column: "league_id",
    value: GLOBAL_ID,
  });
  assert.equal(all.length, PAGE_SIZE + 200);
  assert.deepEqual(ranges, [
    [0, PAGE_SIZE - 1],
    [PAGE_SIZE, PAGE_SIZE * 2 - 1],
  ]);
});

const calls = [];
let respond = () => ({ data: null, error: null });

function copyPart(part) {
  return Array.isArray(part) ? part.slice() : part;
}

function run(state, mode) {
  const snapshot = {
    table: state.table,
    op: state.op || "select",
    mode,
    columns: state.columns,
    selectOptions: state.selectOptions,
    filters: state.filters.map((filter) => filter.map(copyPart)),
    range: state.range ? state.range.slice() : null,
    payload: state.payload,
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
          state.columns = args[0];
          state.selectOptions = args[1] || null;
        } else if (
          prop === "eq" ||
          prop === "in" ||
          prop === "gte" ||
          prop === "lt"
        ) {
          state.filters.push([prop, ...args.map(copyPart)]);
        } else if (prop === "range") {
          state.range = args.slice();
        }
        return builder;
      };
    },
  });
  return builder;
}

const supabase = {
  from(table) {
    return chain({
      table,
      op: null,
      filters: [],
      payload: null,
      columns: null,
      selectOptions: null,
      range: null,
    });
  },
};

function stub(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

stub("../services/supabaseClient", { supabase });
stub("../models/Leaderboard", {});
stub("../models/User", {});

for (const relativePath of [
  "../controllers/LeaguesController",
  "../controllers/LeaderboardController",
]) {
  const id = require.resolve(relativePath);
  delete require.cache[id];
}

const {
  getAllLeaguesData,
  getLeagueData,
} = require("../controllers/LeaguesController");
const {
  getLeaderboardByLeagueId,
  updateLeaderboardBatch,
} = require("../controllers/LeaderboardController");

function filterValue(call, op, column) {
  const found = call.filters.find(
    (filter) => filter[0] === op && filter[1] === column
  );
  return found ? found[2] : undefined;
}

function inSizes(table, column) {
  return calls
    .filter((call) => call.table === table)
    .map((call) => filterValue(call, "in", column))
    .filter(Boolean)
    .map((ids) => ids.length);
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

function useStore({ profileError = null, countError = null, omitProfileId = null } = {}) {
  const memberIds = Array.from({ length: 400 }, (_, index) => memberId(index));
  const counts = { [GLOBAL_ID]: 400, [SMALL_ID]: 2 };

  respond = (call) => {
    if (call.table === "leagues" && call.mode === "list") {
      return {
        data: [
          {
            id: GLOBAL_ID,
            league_name: "Global 26-27",
            current_participants: 400,
            status: "active",
            is_private: false,
          },
          {
            id: SMALL_ID,
            league_name: "Friends",
            current_participants: 2,
            status: "active",
            is_private: true,
          },
        ],
        error: null,
      };
    }

    if (call.table === "leagues" && call.mode === "single") {
      const id = filterValue(call, "eq", "id");
      return {
        data: {
          id,
          league_name: id === GLOBAL_ID ? "Global 26-27" : "Friends",
          current_participants: counts[id] || 0,
          status: "active",
        },
        error: null,
      };
    }

    if (call.table === "user_leagues" && call.selectOptions?.head) {
      if (countError) return { data: null, count: null, error: countError };
      const leagueId = filterValue(call, "eq", "league_id");
      return { data: null, count: counts[leagueId] ?? 0, error: null };
    }

    if (call.table === "user_leagues") {
      const leagueId = filterValue(call, "eq", "league_id");
      const ids =
        leagueId === SMALL_ID ? memberIds.slice(0, 2) : memberIds;
      const page = call.range
        ? ids.slice(call.range[0], call.range[1] + 1)
        : ids;
      return {
        data: page.map((id, index) => ({
          user_id: id,
          role: index === 0 ? "moderator" : "participant",
        })),
        error: null,
      };
    }

    if (call.table === "profiles") {
      const ids = filterValue(call, "in", "id") || [];
      if (profileError || ids.length > IN_FILTER_BATCH_SIZE) {
        return {
          data: null,
          error: profileError || { message: "TypeError: fetch failed" },
        };
      }
      return {
        data: ids
          .filter((id) => id !== omitProfileId)
          .map((id) => ({ id, username: usernameFor(id) })),
        error: null,
      };
    }

    if (call.table === "leaderboard" && call.op === "update") {
      return {
        data: {
          user_id: filterValue(call, "eq", "user_id"),
          points: call.payload.points,
          n_quinipolos_participated: call.payload.n_quinipolos_participated,
          full_correct_quinipolos: call.payload.full_correct_quinipolos,
        },
        error: null,
      };
    }

    if (call.table === "leaderboard") {
      const requested = filterValue(call, "in", "user_id");
      if (requested && requested.length > IN_FILTER_BATCH_SIZE) {
        return { data: null, error: { message: "TypeError: fetch failed" } };
      }
      const leagueId = filterValue(call, "eq", "league_id");
      let ids = requested || (leagueId === GLOBAL_ID ? memberIds : []);
      if (requested && leagueId === GLOBAL_ID) {
        const allowed = new Set(memberIds);
        ids = requested.filter((id) => allowed.has(id));
      }
      const page = call.range ? ids.slice(call.range[0], call.range[1] + 1) : ids;
      return {
        data: page.map((id, index) => ({
          user_id: id,
          points: 1000 - index,
          n_quinipolos_participated: 4,
          full_correct_quinipolos: 1,
        })),
        error: null,
      };
    }

    if (call.table === "league_petitions") {
      const leagueId = filterValue(call, "eq", "league_id");
      if (leagueId !== GLOBAL_ID) return { data: [], error: null };
      return {
        data: [
          {
            id: "pet-1",
            user_id: memberId(1),
            username: "pending-user",
            status: "pending",
            type: "participant",
            date: "2026-10-01T00:00:00.000Z",
          },
        ],
        error: null,
      };
    }

    if (call.table === "quinipolos") return { data: [], error: null };
    return { data: null, error: null };
  };
}

test.beforeEach(() => {
  calls.length = 0;
  useStore();
});

test("league list returns the member count and no participants array", async () => {
  const res = mockRes();
  await getAllLeaguesData({}, res);

  assert.equal(res.statusCode, 200);
  const global = res.body.find((league) => league.id === GLOBAL_ID);
  const small = res.body.find((league) => league.id === SMALL_ID);
  assert.equal(global.participantsCount, 400);
  assert.equal(global.current_participants, 400);
  assert.equal(Object.hasOwn(global, "participants"), false);
  assert.equal(global.participantPetitions.length, 1);
  assert.equal(global.participantPetitions[0].username, "pending-user");
  assert.equal(global.moderatorPetitions.length, 0);
  assert.equal(small.participantsCount, 2);
  assert.equal(Object.hasOwn(small, "participants"), false);
  assert.equal(calls.filter((call) => call.table === "profiles").length, 0);
  assert.ok(
    calls
      .filter((call) => call.table === "user_leagues")
      .every((call) => call.selectOptions?.head === true)
  );
});

test("a failed member count is an error, not participantsCount 0", async () => {
  useStore({ countError: { message: "count failed" } });
  const res = mockRes();
  await getAllLeaguesData({}, res);

  assert.equal(res.statusCode, 500);
  assert.equal(Array.isArray(res.body), false);
});

test("league detail resolves usernames for 400 members", async () => {
  const res = mockRes();
  await getLeagueData({ params: { leagueId: GLOBAL_ID } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.participants.length, 400);
  assert.equal(res.body.participantsCount, undefined);
  assert.deepEqual(
    res.body.participants.map((participant) => participant.username),
    Array.from({ length: 400 }, (_, index) => usernameFor(memberId(index)))
  );
  assert.deepEqual(res.body.moderatorArray, [usernameFor(memberId(0))]);
  const sizes = inSizes("profiles", "id");
  assert.deepEqual(sizes, [100, 100, 100, 100]);
});

test("league detail reports a profile lookup failure", async () => {
  useStore({ profileError: { message: "TypeError: fetch failed" } });
  const res = mockRes();
  await getLeagueData({ params: { leagueId: GLOBAL_ID } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "TypeError: fetch failed");
  assert.equal(JSON.stringify(res.body).includes("unknown"), false);
});

test("leaderboard resolves 400 usernames and keeps a single missing profile as unknown", async () => {
  const missing = memberId(7);
  useStore({ omitProfileId: missing });
  const res = mockRes();
  await getLeaderboardByLeagueId({ params: { leagueId: GLOBAL_ID } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.participantsLeaderboard.length, 400);
  const unknown = res.body.participantsLeaderboard.filter(
    (row) => row.username === "unknown"
  );
  assert.equal(unknown.length, 1);
  assert.equal(
    res.body.participantsLeaderboard.filter((row) =>
      String(row.username).startsWith("player-")
    ).length,
    399
  );
  assert.deepEqual(inSizes("profiles", "id"), [100, 100, 100, 100]);
});

test("leaderboard returns the profile error instead of a board of unknown names", async () => {
  useStore({ profileError: { message: "TypeError: fetch failed" } });
  const res = mockRes();
  await getLeaderboardByLeagueId({ params: { leagueId: GLOBAL_ID } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "TypeError: fetch failed");
  assert.equal(JSON.stringify(res.body).includes("unknown"), false);
  assert.equal(res.body.participantsLeaderboard, undefined);
});

test("correction leaderboard prefetch batches answerer ids", async () => {
  const ids = Array.from({ length: 250 }, (_, index) => memberId(index));
  const updated = await updateLeaderboardBatch(
    GLOBAL_ID,
    ids.map((id) => ({
      user_id: id,
      pointsDelta: 2,
      fullCorrectDelta: 0,
      participatedDelta: 1,
    }))
  );

  assert.equal(updated.length, 250);
  const sizes = inSizes("leaderboard", "user_id");
  assert.deepEqual(sizes, [100, 100, 50]);
  assert.ok(sizes.every((size) => size <= IN_FILTER_BATCH_SIZE));
});

test("correction handlers no longer swallow an unbatched profile lookup", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../controllers/QuinipolosController.js"),
    "utf8"
  );
  assert.equal(source.includes('|| "unknown"'), false);
  assert.equal(source.includes(".in(\"id\", userIds)"), false);
  assert.match(source, /fetchProfilesByIds/);
  assert.match(source, /loadParticipantsLeaderboard/);
  assert.match(source, /do not submit it again/);
});
