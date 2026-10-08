const { leagues } = require("./config");
const { fetchJson } = require("./http");
const { isWithinWindow } = require("./dateUtils");

const LEVERADE_API = "https://api.leverade.com/matches";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

// Trailing sponsor tokens that survive even after the club record is chosen.
const SPONSOR_SUFFIXES = new Set(["humans", "manolet", "pqs", "geodesic", "ike"]);

const COMPARE_STOPWORDS = new Set([
  "c",
  "n",
  "d",
  "e",
  "w",
  "wp",
  "club",
  "waterpolo",
  "de",
  "del",
  "la",
  "el",
  "y",
  "i",
  "cd",
  "cn",
  "cw",
  "nc",
]);

/**
 * Upcoming Spanish-league fixtures from Leverade (RFEN's public competition API).
 * Datetimes in the payload are UTC. Club names are preferred over the match
 * team name when they clearly refer to the same club, because the team name
 * often carries a sponsor ("ASTRALPOOL C.N. SABADELL" -> "C.N. SABADELL").
 */
async function fetchLeveradeMatches(start, end) {
  if (process.env.SCRAPER_USE_LEVERADE === "false") {
    return [];
  }

  const settled = await Promise.all(
    leagues.map(async (league) => {
      if (!league.leveradeTournamentId) return [];
      try {
        return await fetchLeagueMatches(league, start, end);
      } catch (error) {
        console.error(
          `Leverade fetch failed for ${league.id}: ${error.message}`
        );
        return [];
      }
    })
  );

  return settled.flat();
}

async function fetchLeagueMatches(league, start, end) {
  const from = formatFilterDate(addDays(start, -1));
  const to = formatFilterDate(addDays(end, 1));
  const params = new URLSearchParams();
  params.set(
    "filter",
    `round.group.tournament.id:${league.leveradeTournamentId},datetime>${from},datetime<${to}`
  );
  params.set("include", "teams,teams.club");
  params.set("page[size]", String(PAGE_SIZE));
  params.set("page[number]", "1");

  const matches = [];
  let url = `${LEVERADE_API}?${params.toString()}`;
  const seen = new Set();

  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    if (seen.has(url)) break;
    seen.add(url);

    let payload;
    try {
      payload = await fetchJson(url);
    } catch (error) {
      if (matches.length === 0) throw error;
      console.error(
        `Leverade pagination stopped for ${league.id}: ${error.message}`
      );
      break;
    }

    matches.push(...parseLeveradeMatches(payload, league));
    url = payload.links && payload.links.next ? payload.links.next : null;
  }

  if (!start || !end) return matches;
  return matches.filter((match) =>
    isWithinWindow(match.startTime, start, end)
  );
}

function parseLeveradeMatches(payload, league) {
  const included = new Map();
  for (const item of payload.included || []) {
    if (item && item.type && item.id != null) {
      included.set(`${item.type}:${item.id}`, item);
    }
  }

  const matches = [];
  for (const row of payload.data || []) {
    if (!row || row.type !== "match") continue;
    const attrs = row.attributes || {};
    if (attrs.canceled || attrs.postponed || attrs.rest) continue;

    const homeId = row.meta && row.meta.home_team;
    const awayId = row.meta && row.meta.away_team;
    const home = included.get(`team:${homeId}`);
    const away = included.get(`team:${awayId}`);
    if (!home || !away) continue;

    const startTime = leveradeDatetimeToIso(attrs.datetime || attrs.date);
    if (!startTime) continue;

    const homeTeam = resolveLeveradeTeamName(
      home.attributes && home.attributes.name,
      clubNameFor(home, included)
    );
    const awayTeam = resolveLeveradeTeamName(
      away.attributes && away.attributes.name,
      clubNameFor(away, included)
    );
    if (!homeTeam || !awayTeam) continue;

    matches.push({
      leagueId: league.id,
      leagueName: league.name,
      homeTeam,
      awayTeam,
      startTime,
      sourceUrl: `https://api.leverade.com/matches/${row.id}`,
      leveradeId: String(row.id),
      source: "leverade",
    });
  }

  return matches;
}

function clubNameFor(team, included) {
  const rel = team.relationships && team.relationships.club;
  const data = rel && rel.data;
  if (!data || data.id == null) return null;
  const club = included.get(`club:${data.id}`);
  const name = club && club.attributes && club.attributes.name;
  return name ? String(name).trim() : null;
}

/**
 * Pick the name most likely to match our teams table.
 * Club name wins when it shares a token, contains the team name, or its
 * initials are the team acronym ("AESE" -> "A.E. SANTA EULALIA").
 * Unrelated club records are ignored ("COLEGIO BRAINS" must not become
 * "Club Deportivo Básico Bis").
 */
function resolveLeveradeTeamName(teamName, clubName) {
  const team = cleanWhitespace(teamName);
  const club = cleanWhitespace(clubName);
  const chosen = club && namesReferToSameClub(team, club) ? club : team;
  return stripSponsorSuffix(stripLocalitySuffix(chosen));
}

function namesReferToSameClub(teamName, clubName) {
  if (!teamName || !clubName) return false;
  const teamNorm = normalizeForCompare(teamName);
  const clubNorm = normalizeForCompare(clubName);
  if (!teamNorm || !clubNorm) return false;
  if (teamNorm === clubNorm) return true;

  const teamCompact = teamNorm.replace(/ /g, "");
  const clubCompact = clubNorm.replace(/ /g, "");
  if (teamCompact.includes(clubCompact) || clubCompact.includes(teamCompact)) {
    return true;
  }

  const teamTokens = significantTokens(teamNorm);
  const clubTokens = significantTokens(clubNorm);
  if (teamTokens.some((token) => clubTokens.includes(token))) return true;

  const initials = clubInitials(clubNorm);
  if (initials.length >= 3) {
    const tokens = teamNorm.split(" ");
    if (tokens.includes(initials)) return true;
  }
  return false;
}

function stripLocalitySuffix(name) {
  if (!name) return name;
  const parts = name.split(/\s+-\s+/);
  if (parts.length === 2 && hasClubMarker(parts[0])) {
    return parts[0].trim();
  }
  return name;
}

function stripSponsorSuffix(name) {
  if (!name) return name;
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return name;
  const last = tokens[tokens.length - 1].toLowerCase();
  if (!SPONSOR_SUFFIXES.has(last)) return name;
  return tokens.slice(0, -1).join(" ");
}

function hasClubMarker(value) {
  return /\b(?:C\.?\s*N\.?|C\.?\s*D\.?|C\.?\s*E\.?|C\.?\s*W\.?P?\.?|U\.?\s*E\.?|A\.?\s*[ER]\.?|CLUB|REAL\s+CANOE)\b/i.test(
    value
  );
}

function cleanWhitespace(value) {
  if (!value) return "";
  return String(value)
    .replace(/\bC\.(?!\s)(?![A-Za-z]\.)/gi, "C. ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForCompare(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function significantTokens(normalized) {
  return normalized
    .split(" ")
    .filter((token) => token.length > 2 && !COMPARE_STOPWORDS.has(token));
}

function clubInitials(normalizedClub) {
  // Keep single-letter abbreviation pieces ("A.E." -> a, e). Only drop
  // connecting words, otherwise "A.E. SANTA EULALIA" collapses to "ase"
  // and no longer matches the team acronym AESE.
  const skip = new Set(["de", "del", "la", "el", "y"]);
  return normalizedClub
    .split(" ")
    .filter((token) => token && !skip.has(token))
    .map((token) => token[0])
    .join("");
}

function leveradeDatetimeToIso(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(withT) ? withT : `${withT}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatFilterDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

module.exports = {
  fetchLeveradeMatches,
  parseLeveradeMatches,
  resolveLeveradeTeamName,
  leveradeDatetimeToIso,
};
