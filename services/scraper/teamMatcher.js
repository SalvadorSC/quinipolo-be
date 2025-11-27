// Team matcher utility - matches Flashscore names to database team names
// This is a direct port of the TypeScript version from quinipolo-scrapper
const { supabase } = require("../../services/supabaseClient");

const TOP_CANDIDATES = 5;
const FEMALE_FLAG = /\bF$/i;
const PREFIX_PAIRS = new Set(["cn", "cd", "ce"]);
const PREFIX_SINGLE = new Set(["cn", "cd", "ce", "club", "cnb"]);

let teamMapCache = null;
let aliasIndexCache = null;

/**
 * Fetches teams from Supabase and builds the team map
 */
async function fetchTeamMap() {
  if (teamMapCache) {
    return teamMapCache;
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

    teamMapCache = teams.map((team) => {
      // Get aliases from database
      const dbAliases = Array.isArray(team.alias) ? team.alias : [];

      // Generate aliases from team name (like buildTeamMap.mjs does)
      const generatedAliases = buildAliases(team.name);

      // Combine and deduplicate
      const allAliases = new Set([...dbAliases, ...generatedAliases]);
      const aliases = Array.from(allAliases);

      return {
        id: String(team.id),
        name: String(team.name),
        sport: String(team.sport),
        gender: team.gender,
        aliases: aliases,
      };
    });

    // Build alias index (like the original ALIAS_INDEX)
    aliasIndexCache = buildAliasIndex(teamMapCache);

    return teamMapCache;
  } catch (error) {
    console.error("Error building team map:", error);
    throw error;
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

function detectGender(value) {
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last && last.length === 1 && FEMALE_FLAG.test(last)) {
    return "F";
  }
  return undefined;
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

function bestAliasConfidence(entry, normalizedInput) {
  const aliasSet = new Set();
  aliasSet.add(normalize(entry.name));
  for (const alias of entry.aliases ?? []) {
    if (alias) {
      aliasSet.add(normalize(alias));
    }
  }
  let best = 0;
  for (const alias of aliasSet) {
    best = Math.max(best, similarity(normalizedInput, alias));
    if (best === 1) {
      break;
    }
  }
  return best;
}

function buildCandidates(normalizedInput, inputGender, teamMap) {
  return teamMap
    .map((entry) => {
      const candidateGender = detectGender(entry.name);
      if (
        (inputGender === "F" && candidateGender !== "F") ||
        (candidateGender === "F" && inputGender !== "F")
      ) {
        return undefined;
      }
      const confidence = bestAliasConfidence(entry, normalizedInput);
      if (confidence === 0) {
        return undefined;
      }
      return {
        id: entry.id,
        name: entry.name,
        confidence,
      };
    })
    .filter((candidate) => Boolean(candidate && candidate.confidence > 0))
    .sort((a, b) => b.confidence - a.confidence);
}

function getMatchDiagnostics(input) {
  if (!input) return undefined;

  const normalized = normalize(input);
  const inputGender = detectGender(input);

  // Get team map and alias index
  const teamMap = teamMapCache;
  const aliasIndex = aliasIndexCache;

  if (!teamMap || !aliasIndex) {
    return undefined;
  }

  // Try exact alias match first
  const exactMatch = aliasIndex.get(normalized);
  if (exactMatch) {
    return {
      best: {
        id: exactMatch.id,
        name: exactMatch.name,
        confidence: 1,
        suggestions: [],
      },
      candidates: [
        {
          id: exactMatch.id,
          name: exactMatch.name,
          confidence: 1,
        },
      ],
    };
  }

  // Try fuzzy matching
  const candidates = buildCandidates(normalized, inputGender, teamMap);
  if (candidates.length === 0) {
    return { candidates: [] };
  }

  const bestCandidate = candidates[0];
  const rest = candidates.slice(1);
  const bestResult = {
    ...bestCandidate,
    suggestions: rest.slice(0, TOP_CANDIDATES - 1),
  };
  return {
    best: bestResult,
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
function matchTeamNameSync(flashscoreName, isChampionsLeague = false) {
  if (!flashscoreName) {
    return flashscoreName;
  }

  if (!teamMapCache || !aliasIndexCache) {
    throw new Error(
      "Team map not loaded. Call fetchTeamMap() first or use matchTeamName()"
    );
  }

  const diagnostics = getMatchDiagnostics(flashscoreName);
  const result = diagnostics?.best;

  if (!result) {
    console.warn(
      `No Supabase team candidates for "${flashscoreName}". Consider adding an alias.`
    );
    return flashscoreName;
  }

  const thresholds = getConfidenceThresholds(flashscoreName, isChampionsLeague);

  if (result.confidence >= thresholds.confident) {
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
  return flashscoreName;
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
};
