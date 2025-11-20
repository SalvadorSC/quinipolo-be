const { load } = require("cheerio");
const { leagues, rfenBaseResultsUrl } = require("./config");
const { fetchHtml } = require("./http");

async function fetchRfenResults() {
  const results = [];

  for (const league of leagues) {
    if (!league.rfenCompetitionId) continue;

    const url = `${rfenBaseResultsUrl}/${league.rfenCompetitionId}/resultados/`;
    try {
      const html = await fetchHtml(url);
      const $ = load(html);
      $(".RFEN_MatchRowContainer").each((_, container) => {
        const status = $(container)
          .find(".RFEN_MatchRowStatusContainer")
          .text()
          .trim()
          .toLowerCase();
        if (status !== "finalizado") {
          return;
        }

        const timeText = $(container)
          .find(".RFEN_MatchRowTimeContainer_hour span")
          .text()
          .trim();
        const isoTime = toIsoFromDateTime(timeText);
        if (!isoTime) return;

        const teamContainers = $(container).find(".RFEN_MatchRowTeamContainer");
        if (teamContainers.length < 2) return;

        const home = extractTeam(teamContainers.eq(0));
        const away = extractTeam(teamContainers.eq(1));
        if (!home || !away) return;

        results.push({
          leagueId: league.id,
          homeTeam: home.name,
          awayTeam: away.name,
          homeScore: home.score,
          awayScore: away.score,
          startTime: isoTime,
          sourceUrl: url,
        });
      });
    } catch (error) {
      console.error(
        `Failed to fetch RFEN results for ${league.name}: ${error.message}`
      );
    }
  }

  return results;
}

function extractTeam(teamContainer) {
  const name = teamContainer.find(".RFEN_Rp_TeamFullName").text().trim();
  const scoreText = teamContainer
    .find(".RFEN_MatchRowResultFinal")
    .first()
    .text()
    .trim();
  const score = Number(scoreText);
  if (!name || Number.isNaN(score)) {
    return null;
  }
  return { name, score };
}

function toIsoFromDateTime(dateTimeText) {
  if (!dateTimeText) return undefined;
  const [datePart, timePart] = dateTimeText.split(" ");
  if (!datePart || !timePart) return undefined;
  const [day, month, year] = datePart.split("/").map((v) => parseInt(v, 10));
  const [hours, minutes] = timePart.split(":").map((v) => parseInt(v, 10));
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return undefined;
  }
  const monthPadded = String(month).padStart(2, "0");
  const dayPadded = String(day).padStart(2, "0");
  const timePadded = `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`;
  return new Date(
    `${year}-${monthPadded}-${dayPadded}T${timePadded}:00+01:00`
  ).toISOString();
}

module.exports = { fetchRfenResults };



