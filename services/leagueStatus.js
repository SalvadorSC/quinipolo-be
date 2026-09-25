// League lifecycle.
// "finished" leagues stay readable (history, leaderboards, past quinipolos)
// but cannot receive a newly scheduled quinipolo or a new member.
// Inactive and suspended leagues are not treated as closed.

const LEAGUE_STATUS_FINISHED = "finished";
const LEAGUE_STATUS_ACTIVE = "active";

const FINISHED_LEAGUE_MESSAGE =
  "Esta liga está finalizada y no admite nuevos quinipolos.";

function leagueStatusOf(leagueOrStatus) {
  if (leagueOrStatus && typeof leagueOrStatus === "object") {
    return leagueOrStatus.status;
  }
  return leagueOrStatus;
}

function isLeagueFinished(leagueOrStatus) {
  return leagueStatusOf(leagueOrStatus) === LEAGUE_STATUS_FINISHED;
}

function finishedLeagueErrorBody() {
  return {
    error: FINISHED_LEAGUE_MESSAGE,
    code: "LEAGUE_FINISHED",
    league_status: LEAGUE_STATUS_FINISHED,
  };
}

/**
 * Sends 409 when the league is finished.
 * @returns {boolean} true if the response was sent and the caller must stop
 */
function rejectIfLeagueFinished(res, league) {
  if (!isLeagueFinished(league)) return false;
  res.status(409).json(finishedLeagueErrorBody());
  return true;
}

module.exports = {
  LEAGUE_STATUS_ACTIVE,
  LEAGUE_STATUS_FINISHED,
  FINISHED_LEAGUE_MESSAGE,
  isLeagueFinished,
  finishedLeagueErrorBody,
  rejectIfLeagueFinished,
};
