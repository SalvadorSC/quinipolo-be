const { LEGACY_GLOBAL_LEAGUE_2025_2026_ID } = require("../config");

/**
 * Season cutover 2025-2026 -> 2026-2027.
 *
 * CNBeras is excluded: it stays active and can still schedule quinipolos.
 * Every other existing league, including the previous Global, is finished.
 * A new free system Global ("Global 2026-2027") is created for all users.
 * That league must not get a Stripe Checkout / league_subscriptions row.
 *
 * Keep these ids in sync with scripts/season-cutover-2026-27.sql.
 */

/** Previous Global league (2025-2026). Often the historical hardcoded id. */
const PREVIOUS_GLOBAL_LEAGUE_ID = LEGACY_GLOBAL_LEAGUE_2025_2026_ID;

/** Stable id for the new system Global. Printed into GLOBAL_LEAGUE_ID at cutover. */
const NEW_GLOBAL_LEAGUE_ID = "d1380c88-eaea-43a6-be7d-3d556b8fedce";
const NEW_GLOBAL_LEAGUE_NAME = "Global 2026-2027";
const PREVIOUS_SEASON_LABEL = "2025-2026";
const CNBERAS_NORMALIZED_NAME = "cnberas";

const NEW_GLOBAL_DESCRIPTION =
  "Liga global de la temporada 2026-2027. Liga de sistema gratuita: no usa Stripe Checkout.";

function normalizeLeagueName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isCnberasLeague(league, explicitId = null) {
  if (!league) return false;
  if (explicitId && league.id === explicitId) return true;
  return normalizeLeagueName(league.league_name) === CNBERAS_NORMALIZED_NAME;
}

function labelPreviousGlobalName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return `Global (${PREVIOUS_SEASON_LABEL})`;
  if (
    trimmed.includes(PREVIOUS_SEASON_LABEL) ||
    trimmed.includes("2025–2026")
  ) {
    return trimmed;
  }
  return `${trimmed} (${PREVIOUS_SEASON_LABEL})`;
}

/**
 * Pure cutover plan. Does not touch the database.
 * @param {Array<{id: string, league_name: string, status?: string, tier?: string, created_by?: string}>} leagues
 */
function planSeasonCutover(leagues, options = {}) {
  const previousGlobalId =
    options.previousGlobalId || PREVIOUS_GLOBAL_LEAGUE_ID;
  const cnberasId = options.cnberasId || null;
  const allowMissingCnberas = !!options.allowMissingCnberas;
  const list = Array.isArray(leagues) ? leagues : [];

  const cnberasMatches = list.filter((league) =>
    isCnberasLeague(league, cnberasId)
  );
  const previous = list.find((league) => league.id === previousGlobalId) || null;
  const idClash = list.find(
    (league) =>
      league.id === NEW_GLOBAL_LEAGUE_ID &&
      league.league_name !== NEW_GLOBAL_LEAGUE_NAME
  );
  const newGlobalById =
    list.find((league) => league.id === NEW_GLOBAL_LEAGUE_ID) || null;
  const newGlobalByName =
    list.find((league) => league.league_name === NEW_GLOBAL_LEAGUE_NAME) ||
    null;
  const newGlobalExisting = newGlobalById || newGlobalByName;

  const warnings = [];
  const blockedReasons = [];

  if (cnberasMatches.length === 0 && !allowMissingCnberas) {
    blockedReasons.push(
      "CNBeras was not found by name (or --cnberas-id). Refusing to finish leagues so CNBeras cannot be closed by a name mismatch. Pass --cnberas-id=<uuid> after the dry-run listing, or --allow-missing-cnberas only if you have confirmed that league does not exist."
    );
  }
  if (cnberasMatches.length > 1) {
    warnings.push(
      `Multiple leagues match CNBeras (${cnberasMatches.length}). None of them will be marked finished.`
    );
  }
  if (!previous) {
    blockedReasons.push(
      `Previous Global league ${previousGlobalId} was not found. Pass --previous-global-id=<uuid> after checking the dry-run league list.`
    );
  }
  if (idClash) {
    blockedReasons.push(
      `New Global id ${NEW_GLOBAL_LEAGUE_ID} is already used by "${idClash.league_name}".`
    );
  }
  if (
    newGlobalExisting &&
    newGlobalExisting.id !== NEW_GLOBAL_LEAGUE_ID &&
    newGlobalExisting.league_name === NEW_GLOBAL_LEAGUE_NAME
  ) {
    warnings.push(
      `A league named "${NEW_GLOBAL_LEAGUE_NAME}" already exists with id ${newGlobalExisting.id}. Reusing it instead of inserting ${NEW_GLOBAL_LEAGUE_ID}. Set GLOBAL_LEAGUE_ID to the existing id.`
    );
  }

  const excludedIds = new Set(cnberasMatches.map((league) => league.id));
  for (const league of list) {
    if (
      league.id === NEW_GLOBAL_LEAGUE_ID ||
      league.league_name === NEW_GLOBAL_LEAGUE_NAME
    ) {
      excludedIds.add(league.id);
    }
  }
  excludedIds.add(NEW_GLOBAL_LEAGUE_ID);

  const toFinish = [];
  const alreadyFinished = [];
  for (const league of list) {
    if (excludedIds.has(league.id)) continue;
    if (league.status === "finished") alreadyFinished.push(league);
    else toFinish.push(league);
  }

  const rename = previous
    ? {
        id: previous.id,
        from: previous.league_name,
        to: labelPreviousGlobalName(previous.league_name),
        changed:
          labelPreviousGlobalName(previous.league_name) !==
          previous.league_name,
      }
    : null;

  const enrollmentLeagueId = newGlobalExisting
    ? newGlobalExisting.id
    : NEW_GLOBAL_LEAGUE_ID;

  return {
    previousGlobalId,
    newGlobalId: NEW_GLOBAL_LEAGUE_ID,
    newGlobalName: NEW_GLOBAL_LEAGUE_NAME,
    newGlobalDescription: NEW_GLOBAL_DESCRIPTION,
    enrollmentLeagueId,
    rename,
    previousGlobal: previous,
    cnberasMatches,
    cnberasRepair: cnberasMatches.filter(
      (league) => league.status === "finished"
    ),
    newGlobalExisting,
    newGlobalNeedsReactivate: !!(
      newGlobalExisting && newGlobalExisting.status !== "active"
    ),
    toFinish,
    alreadyFinished,
    blocked: blockedReasons.length > 0,
    blockedReasons,
    warnings,
    exclusion:
      "CNBeras is never marked finished (matched by normalized name 'cnberas', or by explicit id). The new Global 2026-2027 league is not marked finished. Every other existing league is.",
  };
}

module.exports = {
  PREVIOUS_GLOBAL_LEAGUE_ID,
  NEW_GLOBAL_LEAGUE_ID,
  NEW_GLOBAL_LEAGUE_NAME,
  PREVIOUS_SEASON_LABEL,
  CNBERAS_NORMALIZED_NAME,
  NEW_GLOBAL_DESCRIPTION,
  normalizeLeagueName,
  isCnberasLeague,
  labelPreviousGlobalName,
  planSeasonCutover,
};
