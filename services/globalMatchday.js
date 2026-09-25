const { LEGACY_GLOBAL_LEAGUE_2025_2026_ID } = require("../config");

/** Legacy display adjustment for the 2025-2026 Global season only. */
const GLOBAL_LEAGUE_J_OFFSET = 2;

/**
 * Matchday index (1-based) for a quinipolo.
 * The 2025-2026 Global league subtracts a historical offset. The live Global
 * (GLOBAL_LEAGUE_ID, 2026-2027 after cutover) does not.
 */
function matchdayNumber(
  leagueId,
  position,
  legacyLeagueId = LEGACY_GLOBAL_LEAGUE_2025_2026_ID
) {
  const index = Number(position) || 0;
  if (leagueId && legacyLeagueId && leagueId === legacyLeagueId) {
    return Math.max(1, index - GLOBAL_LEAGUE_J_OFFSET);
  }
  return index;
}

module.exports = {
  GLOBAL_LEAGUE_J_OFFSET,
  matchdayNumber,
};
