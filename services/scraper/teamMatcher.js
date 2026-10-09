// Team matcher utility - matches Flashscore names to database team names
// This is a direct port of the TypeScript version from quinipolo-scrapper
const { supabase } = require("../../services/supabaseClient");

const TOP_CANDIDATES = 5;
const PREFIX_PAIRS = new Set(["cn", "cd", "ce"]);
const PREFIX_SINGLE = new Set(["cn", "cd", "ce", "club", "cnb"]);

let teamMapCache = null;
let aliasIndexCache = null;
let teamMapUnavailable = false;

/**
 * Fetches teams from Supabase and builds the team map
 */
function useUnmatchedNames(reason) {
  if (!teamMapUnavailable) {
    console.warn(`Team-name matching skipped: ${reason}`);
  }
  teamMapUnavailable = true;
  teamMapCache = [];
  aliasIndexCache = new Map();
  return teamMapCache;
}

async function fetchTeamMap() {
  if (teamMapCache) {
    return teamMapCache;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Supabase credentials are not configured");
    }
    return useUnmatchedNames("Supabase credentials are not configured");
  }

  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("id, name, sport, gender, alias")
      .eq("sport", "waterpolo");

    if (error) {
      console.error("Error fetching teams:", error);
      throw error;
    }

    teamMapCache = buildTeamMapRecords(teams);

    // Build alias index (like the original ALIAS_INDEX)
    aliasIndexCache = buildAliasIndex(teamMapCache);

    return teamMapCache;
  } catch (error) {
    console.error("Error building team map:", error);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    return useUnmatchedNames(error.message || "team map request failed");
  }
}

// Helper functions to build aliases from team name (matching buildTeamMap.mjs)
function deburr(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function stripPunctuation(value) {
  return value.replace(/[.''\-–—]/g, " ");
}

function removeClubPrefixes(value) {
  return value.replace(
    /\b(c\.n\.|c\.d\.|c\.e\.|c\.|club|cn|ce|cd|u\.e\.|ue|a\.r\.)\b/gi,
    ""
  );
}

function buildAliases(name) {
  const aliases = new Set();
  const normalized = normalizeWhitespace(name);
  aliases.add(normalized);

  const deburred = normalizeWhitespace(deburr(normalized));
  aliases.add(deburred);

  const punctuationStripped = normalizeWhitespace(stripPunctuation(deburred));
  aliases.add(punctuationStripped);

  const prefixStripped = normalizeWhitespace(
    removeClubPrefixes(punctuationStripped)
  );
  aliases.add(prefixStripped);

  aliases.add(prefixStripped.replace(/\s+/g, ""));

  return Array.from(aliases).filter(Boolean);
}

function buildAliasIndex(mapEntries) {
  const index = new Map();
  for (const entry of mapEntries) {
    for (const alias of entry.aliases) {
      const normalized = normalize(alias);
      index.set(normalized, { id: entry.id, name: entry.name });
    }
  }
  return index;
}

function normalize(value) {
  let normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  normalized = stripClubPrefixes(normalized);
  return normalized;
}

function stripClubPrefixes(value) {
  const tokens = value.split(" ");
  while (tokens.length > 1) {
    const first = tokens[0];
    const second = tokens[1];

    if (first === "c" && second && PREFIX_PAIRS.has(`c${second}`)) {
      tokens.shift();
      tokens.shift();
      continue;
    }

    if (PREFIX_SINGLE.has(first)) {
      tokens.shift();
      continue;
    }

    break;
  }

  return tokens.filter((token) => token !== "waterpolo").join(" ");
}

const LEAGUE_GENDER = {
  DHM: "m",
  DHF: "f",
  PDM: "m",
  PDF: "f",
  SDM: "m",
  CL: "m",
  CLF: "f",
};

const SMALL_WORDS = new Set(["de", "del", "y"]);

function buildTeamMapRecords(teams) {
  return teams.map((team) => {
    const dbAliases = Array.isArray(team.alias)
      ? team.alias
      : Array.isArray(team.aliases)
        ? team.aliases
        : [];
    const aliases = Array.from(new Set([...dbAliases, ...buildAliases(team.name)]));
    return {
      id: String(team.id),
      name: String(team.name),
      sport: String(team.sport || "waterpolo"),
      gender: team.gender || null,
      aliases,
    };
  });
}

function installTeamMap(records) {
  teamMapUnavailable = false;
  teamMapCache = buildTeamMapRecords(records);
  aliasIndexCache = buildAliasIndex(teamMapCache);
  return teamMapCache;
}

function resetTeamMap() {
  teamMapCache = null;
  aliasIndexCache = null;
  teamMapUnavailable = false;
}

function detectGender(value) {
  const token = detectGenderToken(value);
  return token ? token.toUpperCase() : undefined;
}

function detectGenderToken(value) {
  if (!value) return undefined;
  const parts = String(value).trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (last && /^f$/i.test(last)) return "f";
  if (last && /^m$/i.test(last)) return "m";
  return undefined;
}

function expectedGender(name, leagueId) {
  if (leagueId && LEAGUE_GENDER[leagueId]) return LEAGUE_GENDER[leagueId];
  return detectGenderToken(name);
}

function reserveKind(value) {
  if (!value) return null;
  const tokens = normalize(value).split(" ").filter(Boolean);
  if (tokens.includes("2") || tokens.includes("ii")) return "2";
  if (tokens.includes("b")) return "b";
  return null;
}

function entryReserveKind(entry) {
  const kinds = [reserveKind(entry.name)];
  for (const alias of entry.aliases || []) kinds.push(reserveKind(alias));
  if (kinds.includes("2")) return "2";
  if (kinds.includes("b")) return "b";
  return null;
}

function teamGender(entry) {
  if (entry.gender === "m" || entry.gender === "f") return entry.gender;
  return detectGenderToken(entry.name);
}

function baseKeyFromNormalized(normalized) {
  return normalized
    .replace(/\s+[mf]$/, "")
    .replace(/\s+(?:b|2|ii)(?=\s|$)/g, "")
    .replace(/^(?:b|2|ii)\s+/, "")
    .split(" ")
    .filter((token) => token.length > 1)
    .join(" ")
    .trim();
}

function tokensCover(shorter, longer) {
  if (!shorter || !longer || shorter === longer) return false;
  const shortTokens = shorter.split(" ").filter(Boolean);
  const longTokens = new Set(longer.split(" ").filter(Boolean));
  if (!shortTokens.length) return false;
  if (!shortTokens.every((token) => longTokens.has(token))) return false;
  return shortTokens.some((token) => token.length >= 5);
}

function titleCaseTeamName(name) {
  if (!name) return name;
  return String(name)
    .trim()
    .split(/\s+/)
    .map((token, index) => formatTeamToken(token, index === 0))
    .join(" ");
}

function formatTeamToken(token, isFirst) {
  if (token.includes(".")) {
    const pieces = token.split(".");
    const cased = pieces
      .map((piece) => (piece ? piece[0].toLocaleUpperCase("es") : ""))
      .join(".");
    return token.endsWith(".") ? `${cased}.`.replace(/\.\.$/, ".") : cased;
  }
  if (/^[A-Za-z]$/.test(token)) return token.toLocaleUpperCase("es");
  const lower = token.toLocaleLowerCase("es");
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

function similarity(a, b) {
  if (!a.length || !b.length) {
    return 0;
  }
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length, 1);
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i < rows; i += 1) {
    const currentRow = matrix[i];
    const prevRow = matrix[i - 1];
    for (let j = 1; j < cols; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        currentRow[j] = prevRow[j - 1];
      } else {
        const deletion = prevRow[j];
        const insertion = currentRow[j - 1];
        const substitution = prevRow[j - 1];
        currentRow[j] = 1 + Math.min(deletion, insertion, substitution);
      }
    }
  }

  return matrix[rows - 1][cols - 1];
}

function scoreEntry(entry, normalizedInput, inputBase) {
  const forms = new Set([normalize(entry.name)]);
  for (const alias of entry.aliases || []) {
    if (alias) forms.add(normalize(alias));
  }
  let best = 0;
  for (const form of forms) {
    best = Math.max(best, similarity(normalizedInput, form));
    const base = baseKeyFromNormalized(form);
    if (inputBase && base && inputBase === base) {
      best = Math.max(best, 0.98);
    } else if (
      inputBase &&
      base &&
      (tokensCover(inputBase, base) || tokensCover(base, inputBase))
    ) {
      const shared = inputBase.split(" ").filter((token) => base.split(" ").includes(token));
      const coverage =
        shared.join(" ").length /
        Math.max(inputBase.length, base.length, 1);
      best = Math.max(best, 0.9 + 0.05 * coverage);
    }
  }
  return best;
}

// "waterpolo" is stripped before similarity, so two clubs that share a
// place name ("Ciudad de Rivas") tie. Count the original tokens, including
// "waterpolo", and keep the name that still contains more of them.
function specificityScore(input, entry) {
  const inputTokens = new Set(rawTokens(input));
  const forms = [entry.name, ...(entry.aliases || [])];
  let best = 0;
  for (const form of forms) {
    const shared = rawTokens(form).filter((token) => inputTokens.has(token));
    const score = shared.reduce((sum, token) => sum + token.length, 0);
    if (score > best) best = score;
  }
  return best;
}

function rawTokens(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((token) => token.length > 1 && token !== "club");
}

function rankCandidates(input, leagueId) {
  const normalizedInput = normalize(input);
  const inputBase = baseKeyFromNormalized(normalizedInput);
  const gender = expectedGender(input, leagueId);
  const inputReserve = reserveKind(input);

  let ranked = teamMapCache
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      confidence: scoreEntry(entry, normalizedInput, inputBase),
      specificity: specificityScore(input, entry),
      reserve: entryReserveKind(entry),
      genderRank: gender && teamGender(entry) === gender ? (entry.gender === gender ? 2 : 1) : 0,
      entry,
    }))
    .filter((candidate) => candidate.confidence > 0);

  if (inputReserve) {
    ranked = ranked.filter((candidate) => candidate.reserve === inputReserve);
  } else {
    ranked = ranked.filter((candidate) => !candidate.reserve);
  }

  ranked.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.genderRank - a.genderRank ||
      b.specificity - a.specificity
  );

  if (gender) {
    const gendered = ranked.filter(
      (candidate) => candidate.genderRank > 0 && candidate.confidence >= 0.9
    );
    if (gendered.length) {
      gendered.sort(
        (a, b) =>
          b.genderRank - a.genderRank ||
          b.confidence - a.confidence ||
          b.specificity - a.specificity
      );
      const rest = ranked.filter((candidate) => !gendered.includes(candidate));
      ranked = [...gendered, ...rest];
    }
  }

  if (!inputReserve && leagueId === "SDM" && ranked.length) {
    const lead = ranked[0];
    const leadBase = baseKeyFromNormalized(normalize(lead.name));
    const second = teamMapCache.find((entry) => {
      if (entryReserveKind(entry) !== "2") return false;
      if (baseKeyFromNormalized(normalize(entry.name)) !== leadBase) return false;
      if (gender && teamGender(entry) && teamGender(entry) !== gender) return false;
      return true;
    });
    if (second) {
      const promoted = {
        id: second.id,
        name: second.name,
        confidence: Math.max(lead.confidence, 0.98),
        reserve: "2",
        genderRank: gender && teamGender(second) === gender ? 2 : 0,
      };
      ranked = [promoted, ...ranked.filter((candidate) => candidate.id !== second.id)];
    }
  }

  return ranked;
}

function getMatchDiagnostics(input, leagueId) {
  if (!input) return undefined;
  if (!teamMapCache || !aliasIndexCache) return undefined;

  const candidates = rankCandidates(input, leagueId);
  if (!candidates.length) return { candidates: [] };
  const [best, ...rest] = candidates;
  return {
    best: { ...best, suggestions: rest.slice(0, TOP_CANDIDATES - 1) },
    candidates,
  };
}

function getConfidenceThresholds(name, isChampionsLeague = false) {
  const length = name.replace(/[^a-z0-9]/gi, "").length;

  // For Champions League matches, use less lenient thresholds
  // This helps match international teams that may have different naming conventions
  if (isChampionsLeague) {
    if (length >= 12) {
      return { confident: 0.95, low: 0.85 };
    }
    if (length >= 9) {
      return { confident: 0.9, low: 0.8 };
    }
    if (length >= 6) {
      return { confident: 0.85, low: 0.75 };
    }
    return { confident: 0.8, low: 0.7 };
  }

  // Original thresholds for domestic matches
  if (length >= 12) {
    return { confident: 0.92, low: 0.75 };
  }
  if (length >= 9) {
    return { confident: 0.88, low: 0.72 };
  }
  if (length >= 6) {
    return { confident: 0.83, low: 0.68 };
  }
  return { confident: 0.78, low: 0.6 };
}

/**
 * Synchronous version of matchTeamName - requires team map to be pre-loaded
 * Use this when you've already called fetchTeamMap() to avoid async overhead
 * @param {string} flashscoreName - The team name from Flashscore
 * @param {boolean} isChampionsLeague - Whether this is a Champions League match (default: false)
 */
function matchTeamNameSync(flashscoreName, isChampionsLeague = false, leagueId) {
  if (!flashscoreName) {
    return flashscoreName;
  }

  if (teamMapUnavailable) {
    return titleCaseTeamName(flashscoreName);
  }

  if (!teamMapCache || !aliasIndexCache) {
    throw new Error(
      "Team map not loaded. Call fetchTeamMap() first or use matchTeamName()"
    );
  }

  const diagnostics = getMatchDiagnostics(flashscoreName, leagueId);
  const result = diagnostics?.best;
  const fallback = titleCaseTeamName(flashscoreName);

  if (!result) {
    console.warn(
      `No Supabase team candidates for "${flashscoreName}". Consider adding an alias.`
    );
    return fallback;
  }

  const thresholds = getConfidenceThresholds(flashscoreName, isChampionsLeague);
  const structural = result.confidence >= 0.9;

  if (result.confidence >= thresholds.confident || structural) {
    return result.name;
  }

  if (result.confidence >= thresholds.low) {
    const context = isChampionsLeague ? " (Champions League)" : "";
    console.warn(
      `Low-confidence match${context} for "${flashscoreName}" -> ${
        result.name
      } (${(result.confidence * 100).toFixed(1)}%)`
    );
    return result.name;
  }

  const context = isChampionsLeague ? " (Champions League)" : "";
  console.warn(
    `No ID assigned${context} for "${flashscoreName}". Closest candidate: ${
      result.name
    } (${(result.confidence * 100).toFixed(1)}%)`
  );
  return fallback;
}

/**
 * Matches a Flashscore team name to a database team (async version)
 * This follows the same logic as the original TypeScript version's findTeamId function
 * For batch operations, use fetchTeamMap() once, then matchTeamNameSync() for each name
 */
async function matchTeamName(flashscoreName) {
  if (!flashscoreName) {
    return flashscoreName;
  }

  // Ensure team map is loaded
  await fetchTeamMap();

  return matchTeamNameSync(flashscoreName);
}

/**
 * Gets team name by ID from the team map
 */
async function getTeamNameById(id) {
  if (!id) return undefined;
  const teamMap = await fetchTeamMap();
  const team = teamMap.find((t) => t.id === String(id));
  return team ? team.name : undefined;
}

module.exports = {
  matchTeamName,
  matchTeamNameSync,
  getTeamNameById,
  fetchTeamMap,
  installTeamMap,
  resetTeamMap,
  titleCaseTeamName,
};
