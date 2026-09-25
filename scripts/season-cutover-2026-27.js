#!/usr/bin/env node
/**
 * Season cutover 2025-2026 -> 2026-2027.
 *
 * Dry-run (default, no writes):
 *   node scripts/season-cutover-2026-27.js
 *
 * Apply:
 *   node scripts/season-cutover-2026-27.js --apply
 *
 * CNBeras is never marked finished. It stays active and can still create
 * quinipolos. Every other existing league, including the previous Global, is
 * finished. A new free Global 2026-2027 is created and every profile is
 * enrolled (user_leagues + leaderboard). No Stripe Checkout and no
 * league_subscriptions row.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment or .env.
 * This script does not print those secrets and does not write .env.
 * After apply, set GLOBAL_LEAGUE_ID to the printed id and restart the API.
 *
 * Flags:
 *   --apply
 *   --cnberas-id=<uuid>            extra match besides the name "CNBeras"
 *   --previous-global-id=<uuid>    if the default 2025-2026 Global id misses
 *   --allow-missing-cnberas        dangerous; only if the league truly does not exist
 */

try {
  require("dotenv").config();
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}

const {
  NEW_GLOBAL_DESCRIPTION,
  NEW_GLOBAL_LEAGUE_ID,
  NEW_GLOBAL_LEAGUE_NAME,
  planSeasonCutover,
} = require("../services/seasonCutover");

const PAGE = 1000;
const WRITE_CHUNK = 200;

function parseArgs(argv) {
  const opts = {
    apply: false,
    allowMissingCnberas: false,
    cnberasId: process.env.CNBERAS_LEAGUE_ID || null,
    previousGlobalId: process.env.PREVIOUS_GLOBAL_LEAGUE_ID || null,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--dry-run") opts.apply = false;
    else if (arg === "--allow-missing-cnberas") opts.allowMissingCnberas = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--cnberas-id=")) {
      opts.cnberasId = arg.slice("--cnberas-id=".length).trim() || null;
    } else if (arg.startsWith("--previous-global-id=")) {
      opts.previousGlobalId =
        arg.slice("--previous-global-id=".length).trim() || null;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/season-cutover-2026-27.js [--apply] [--cnberas-id=<uuid>] [--previous-global-id=<uuid>] [--allow-missing-cnberas]

Default is a dry-run. CNBeras is excluded from finished. See scripts/season-cutover-2026-27.sql for the SQL equivalent.`);
}

async function fetchAll(supabase, table, columns, { filter, order = "id" } = {}) {
  const rows = [];
  let from = 0;
  for (;;) {
    // Stable order so pages do not skip or repeat rows.
    let query = supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) {
      throw new Error(`${table} read failed: ${error.message}`);
    }
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function printPlan(plan, profileCount, existingMemberCount, existingLeaderboardCount) {
  console.log("--- Season cutover plan (2026-2027) ---");
  console.log(plan.exclusion);
  console.log("");

  if (plan.rename) {
    console.log(
      `Previous Global ${plan.rename.id}: "${plan.rename.from}" -> "${plan.rename.to}"${plan.rename.changed ? "" : " (already labeled)"}`
    );
  } else {
    console.log("Previous Global: NOT FOUND");
  }

  console.log(
    `New Global: "${plan.newGlobalName}" id ${plan.enrollmentLeagueId}${plan.newGlobalExisting ? " (already exists)" : " (will create, no Stripe)"}`
  );

  console.log(`CNBeras matches (excluded, stay schedulable): ${plan.cnberasMatches.length}`);
  for (const league of plan.cnberasMatches) {
    const repair =
      league.status === "finished" ? " — currently finished, will set back to active" : "";
    console.log(`  - ${league.id}  "${league.league_name}"  status=${league.status || "null"}${repair}`);
  }

  console.log(`Leagues to mark finished: ${plan.toFinish.length}`);
  for (const league of plan.toFinish) {
    console.log(`  - ${league.id}  "${league.league_name}"  status=${league.status || "null"}`);
  }
  console.log(`Already finished (left as-is): ${plan.alreadyFinished.length}`);
  for (const league of plan.alreadyFinished) {
    console.log(`  - ${league.id}  "${league.league_name}"`);
  }

  const toEnroll = Math.max(0, profileCount - existingMemberCount);
  const toLeaderboard = Math.max(0, profileCount - existingLeaderboardCount);
  console.log(`Profiles: ${profileCount}`);
  console.log(`New user_leagues rows: ${toEnroll} (${existingMemberCount} already enrolled)`);
  console.log(
    `New leaderboard rows: ${toLeaderboard} (${existingLeaderboardCount} already present)`
  );

  for (const warning of plan.warnings) {
    console.log(`WARNING: ${warning}`);
  }
  if (plan.blocked) {
    console.log("BLOCKED:");
    for (const reason of plan.blockedReasons) {
      console.log(`  - ${reason}`);
    }
  }
}

async function applyPlan(supabase, plan, profiles) {
  const now = new Date().toISOString();

  if (plan.rename && plan.rename.changed) {
    const { error } = await supabase
      .from("leagues")
      .update({ league_name: plan.rename.to, updated_at: now })
      .eq("id", plan.rename.id);
    if (error) throw new Error(`Rename previous Global failed: ${error.message}`);
    console.log(`Renamed previous Global to "${plan.rename.to}"`);
  }

  let enrollmentLeagueId = plan.enrollmentLeagueId;

  if (!plan.newGlobalExisting) {
    const previous = plan.previousGlobal || {};
    const { error } = await supabase.from("leagues").insert({
      id: NEW_GLOBAL_LEAGUE_ID,
      league_name: NEW_GLOBAL_LEAGUE_NAME,
      description: NEW_GLOBAL_DESCRIPTION,
      is_private: false,
      tier: previous.tier || "managed",
      created_by: previous.created_by || null,
      status: "active",
    });
    if (error) throw new Error(`Create new Global failed: ${error.message}`);
    enrollmentLeagueId = NEW_GLOBAL_LEAGUE_ID;
    console.log(`Created ${NEW_GLOBAL_LEAGUE_NAME} (${enrollmentLeagueId}) without Stripe`);
  } else if (plan.newGlobalNeedsReactivate) {
    const { error } = await supabase
      .from("leagues")
      .update({ status: "active", updated_at: now })
      .eq("id", plan.newGlobalExisting.id);
    if (error) {
      throw new Error(`Reactivate new Global failed: ${error.message}`);
    }
    console.log(`Set ${plan.newGlobalExisting.league_name} back to active`);
  }

  for (const league of plan.cnberasRepair) {
    const { error } = await supabase
      .from("leagues")
      .update({ status: "active", updated_at: now })
      .eq("id", league.id)
      .eq("status", "finished");
    if (error) throw new Error(`Restore CNBeras failed: ${error.message}`);
    console.log(`Restored CNBeras "${league.league_name}" (${league.id}) to active`);
  }

  const protectedIds = new Set([
    ...plan.cnberasMatches.map((league) => league.id),
    plan.enrollmentLeagueId,
    NEW_GLOBAL_LEAGUE_ID,
  ]);
  const finishIds = plan.toFinish
    .map((league) => league.id)
    .filter((id) => !protectedIds.has(id));
  for (const ids of chunk(finishIds, 100)) {
    const { error } = await supabase
      .from("leagues")
      .update({ status: "finished", updated_at: now })
      .in("id", ids);
    if (error) throw new Error(`Mark leagues finished failed: ${error.message}`);
  }
  console.log(`Marked ${finishIds.length} leagues finished (CNBeras excluded)`);

  const existingMembers = new Set(
    (
      await fetchAll(supabase, "user_leagues", "user_id", {
        order: "user_id",
        filter: (query) => query.eq("league_id", enrollmentLeagueId),
      })
    ).map((row) => row.user_id)
  );
  const existingBoard = new Set(
    (
      await fetchAll(supabase, "leaderboard", "user_id", {
        order: "user_id",
        filter: (query) => query.eq("league_id", enrollmentLeagueId),
      })
    ).map((row) => row.user_id)
  );

  const memberRows = profiles
    .filter((profile) => !existingMembers.has(profile.id))
    .map((profile) => ({
      user_id: profile.id,
      league_id: enrollmentLeagueId,
      role: "participant",
    }));
  const boardRows = profiles
    .filter((profile) => !existingBoard.has(profile.id))
    .map((profile) => ({
      user_id: profile.id,
      league_id: enrollmentLeagueId,
      points: 0,
      full_correct_quinipolos: 0,
      n_quinipolos_participated: 0,
    }));

  for (const rows of chunk(memberRows, WRITE_CHUNK)) {
    const { error } = await supabase.from("user_leagues").insert(rows);
    if (error) throw new Error(`user_leagues insert failed: ${error.message}`);
  }
  for (const rows of chunk(boardRows, WRITE_CHUNK)) {
    const { error } = await supabase.from("leaderboard").insert(rows);
    if (error) throw new Error(`leaderboard insert failed: ${error.message}`);
  }

  console.log(`Enrolled ${memberRows.length} profiles into user_leagues`);
  console.log(`Enrolled ${boardRows.length} profiles into leaderboard`);
  console.log("");
  console.log("Next steps:");
  console.log(`  Set GLOBAL_LEAGUE_ID=${enrollmentLeagueId}`);
  console.log("  Restart the backend. Do not commit .env or this id if it is environment-specific.");
  console.log("  Signup alias \"global\" joins this league. Do not run Stripe Checkout for it.");
  console.log("  Confirm CNBeras status is still active.");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Put them in .env (not committed) or the environment."
    );
    process.exitCode = 1;
    return;
  }

  const { supabase } = require("../services/supabaseClient");

  const leagues = await fetchAll(
    supabase,
    "leagues",
    "id, league_name, status, tier, created_by",
    { order: "id" }
  );
  const plan = planSeasonCutover(leagues, {
    previousGlobalId: opts.previousGlobalId,
    cnberasId: opts.cnberasId,
    allowMissingCnberas: opts.allowMissingCnberas,
  });

  const { count: profileCount, error: profileCountError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (profileCountError) {
    throw new Error(`profiles count failed: ${profileCountError.message}`);
  }

  let existingMemberCount = 0;
  let existingLeaderboardCount = 0;
  if (plan.newGlobalExisting) {
    const { count: members, error: memberError } = await supabase
      .from("user_leagues")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", plan.enrollmentLeagueId);
    if (memberError) throw new Error(`user_leagues count failed: ${memberError.message}`);
    const { count: board, error: boardError } = await supabase
      .from("leaderboard")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", plan.enrollmentLeagueId);
    if (boardError) throw new Error(`leaderboard count failed: ${boardError.message}`);
    existingMemberCount = members || 0;
    existingLeaderboardCount = board || 0;
  }

  printPlan(
    plan,
    profileCount || 0,
    existingMemberCount,
    existingLeaderboardCount
  );

  if (plan.blocked) {
    process.exitCode = opts.apply ? 1 : 2;
    return;
  }

  if (!opts.apply) {
    console.log("");
    console.log("Dry-run only. No rows were written. Re-run with --apply to commit.");
    console.log("SQL equivalent: scripts/season-cutover-2026-27.sql");
    return;
  }

  const profiles = await fetchAll(supabase, "profiles", "id", { order: "id" });
  await applyPlan(supabase, plan, profiles);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
