const { supabase } = require("../services/supabaseClient");
const { renderRanking } = require("./renderers/renderRanking");
const { renderMatchResults } = require("./renderers/renderMatchResults");
const { renderStatistics } = require("./renderers/renderStatistics");
const { buildMatchResultsFromCorrectionSee } = require("./utils/matchResultsTransformer");
const {
  resolveTeamLogoSource,
  findClosestMatchFromIndex,
  extractBgColorFromFilename,
  extractDimensionsFromFilename,
} = require("./utils/teamLogoResolver");
const teamNameToImage = require("./data/teamNameToImage.json");

const MATCHES_PER_IMAGE = 8;
const LEAGUE_AUDIT = { leagueId: "AUDIT", leagueName: "Auditoría de equipos" };

async function collectLogoAudit(matchesByLeague) {
  const audit = { resolved: [], missing: [] };
  const seen = new Set();
  for (const group of matchesByLeague || []) {
    for (const m of group.matches || []) {
      for (const team of [m.homeTeam, m.awayTeam]) {
        if (!team || seen.has(team)) continue;
        seen.add(team);
        const logo = await resolveTeamLogoSource(team, teamNameToImage);
        if (logo) {
          audit.resolved.push({
            teamName: team,
            logoFile: logo,
            bgColor: extractBgColorFromFilename(logo) ?? null,
            dimensions: extractDimensionsFromFilename(logo) ?? null,
          });
        } else {
          audit.missing.push(team);
        }
      }
    }
  }
  return audit;
}

async function generateGraphics(payload) {
  const results = {};
  const matchday = payload._meta?.matchday || "J16";
  const includeLogoAudit = payload._meta?.includeLogoAudit === true;

  const correctionSee = payload.correctionSee || payload.rawBeResponses?.correctionSee;
  const hasExplicitImage1 = !!payload.image1_lastResults;
  const hasExplicitImage2 = !!payload.image2_lastResultsExtended;

  let logoAudit = null;

  if (correctionSee && correctionSee.quinipolo?.length >= 15) {
    const { image1, image2 } = buildMatchResultsFromCorrectionSee(correctionSee, matchday);
    if (includeLogoAudit) {
      const allMatchesByLeague = [
        ...(image1.matchesByLeague || []),
        ...(image2.matchesByLeague || []),
      ];
      logoAudit = await collectLogoAudit(allMatchesByLeague);
    }
    results.image1 = await renderMatchResults(image1);
    results.image2 = await renderMatchResults(image2, { hideTitle: true });
  } else {
    if (hasExplicitImage1) {
      if (includeLogoAudit) logoAudit = await collectLogoAudit(payload.image1_lastResults?.matchesByLeague);
      results.image1 = await renderMatchResults(payload.image1_lastResults);
    }
    if (hasExplicitImage2) {
      if (includeLogoAudit && !logoAudit) {
        logoAudit = await collectLogoAudit(payload.image2_lastResultsExtended?.matchesByLeague);
      } else if (includeLogoAudit && logoAudit) {
        const audit2 = await collectLogoAudit(payload.image2_lastResultsExtended?.matchesByLeague);
        const seen = new Set(logoAudit.resolved.map((r) => r.teamName));
        for (const r of audit2.resolved) {
          if (!seen.has(r.teamName)) {
            logoAudit.resolved.push(r);
            seen.add(r.teamName);
          }
        }
        for (const m of audit2.missing) {
          if (!seen.has(m)) {
            logoAudit.missing.push(m);
            seen.add(m);
          }
        }
      }
      results.image2 = await renderMatchResults(payload.image2_lastResultsExtended, { hideTitle: true });
    }
  }

  if (payload.image3_quinipoloRanking) {
    results.image3 = await renderRanking(
      payload.image3_quinipoloRanking,
      "quinipolo"
    );
  }

  if (payload.image4_generalLeagueRanking) {
    results.image4 = await renderRanking(
      payload.image4_generalLeagueRanking,
      "general"
    );
  }

  if (payload.image5_statistics) {
    results.image5 = await renderStatistics(payload.image5_statistics);
  }

  const response = { matchday, images: results };
  if (logoAudit) response.logoAudit = logoAudit;
  return response;
}

async function loadTeamsFromDb() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("name")
    .ilike("sport", "waterpolo")
    .order("name");

  if (error) throw error;
  const names = [...new Set((teams ?? []).map((r) => r.name).filter(Boolean))];
  return names.sort((a, b) => a.localeCompare(b));
}

/**
 * Generates multiple image2-style graphics, one per batch of teams from DB (waterpolo).
 * Each image has 8 matches (16 teams). Returns images + logoAudit for all teams.
 */
async function generateTeamsGraphics() {
  const teams = await loadTeamsFromDb();
  const images = {};
  const imageMatches = {};
  const allMatchesByLeague = [];

  for (let i = 0; i < teams.length; i += MATCHES_PER_IMAGE * 2) {
    const batch = teams.slice(i, i + MATCHES_PER_IMAGE * 2);
    const matches = [];
    for (let j = 0; j < batch.length - 1; j += 2) {
      const homeTeam = batch[j];
      const awayTeam = batch[j + 1];
      if (!homeTeam || !awayTeam) break;
      matches.push({
        matchNumber: matches.length + 1,
        homeTeam,
        awayTeam,
        homeScore: 10,
        awayScore: 9,
        status: "completed",
        isGame15: false,
        leagueId: LEAGUE_AUDIT.leagueId,
        leagueName: LEAGUE_AUDIT.leagueName,
      });
    }
    if (matches.length === 0) break;

    const matchesByLeague = [{ ...LEAGUE_AUDIT, matches }];
    allMatchesByLeague.push(...matchesByLeague);

    const imageKey = `image_${Object.keys(images).length}`;
    imageMatches[imageKey] = matches.map((m) => ({ homeTeam: m.homeTeam, awayTeam: m.awayTeam }));

    const payload = { matchday: "Auditoría", matchesByLeague };
    images[imageKey] = await renderMatchResults(payload, { hideTitle: true, scale: 1.33 });
  }

  let logoAudit = await collectLogoAudit(allMatchesByLeague);
  const teamsInMatches = new Set([
    ...logoAudit.resolved.map((r) => r.teamName),
    ...logoAudit.missing,
  ]);
  for (const team of teams) {
    if (!teamsInMatches.has(team)) {
      const logo = await resolveTeamLogoSource(team, teamNameToImage);
      if (logo) {
        logoAudit.resolved.push({
          teamName: team,
          logoFile: logo,
          bgColor: extractBgColorFromFilename(logo) ?? null,
          dimensions: extractDimensionsFromFilename(logo) ?? null,
        });
      } else {
        const closest = findClosestMatchFromIndex(team);
        logoAudit.missing.push({ teamName: team, closestMatch: closest || undefined });
      }
    }
  }
  logoAudit.missing = logoAudit.missing.map((m) =>
    typeof m === "string"
      ? { teamName: m, closestMatch: findClosestMatchFromIndex(m) || undefined }
      : m
  );

  const logoMap = new Map(logoAudit.resolved.map((r) => [r.teamName, r.logoFile]));
  const logosPerImage = {};
  for (const [imageKey, matches] of Object.entries(imageMatches)) {
    const seen = new Set();
    logosPerImage[imageKey] = [];
    for (const m of matches) {
      for (const team of [m.homeTeam, m.awayTeam]) {
        if (!team || seen.has(team)) continue;
        seen.add(team);
        const logoFile = logoMap.get(team);
        if (logoFile) logosPerImage[imageKey].push(logoFile);
      }
    }
  }

  return { images, imageMatches, logoAudit, logosPerImage, teamCount: teams.length };
}

module.exports = {
  generateGraphics,
  generateTeamsGraphics,
  renderRanking,
  renderMatchResults,
  renderStatistics,
};
