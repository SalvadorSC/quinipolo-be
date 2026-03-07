const path = require("path");
const fs = require("fs");
const { TEAMS_LOGOS_DIR, TEAMS_LOGOS_DIR1 } = require("../constants/theme");
const { supabase } = require("../../services/supabaseClient");

/** teams_logos first (priority), teams_logos1 as fallback */
const TEAMS_LOGO_DIRS = [TEAMS_LOGOS_DIR, TEAMS_LOGOS_DIR1].filter(Boolean);
/** Reverse order for buildLogoIndex so teams_logos overwrites teams_logos1 on conflicts */
const TEAMS_LOGO_DIRS_INDEX_ORDER = [TEAMS_LOGOS_DIR1, TEAMS_LOGOS_DIR].filter(Boolean);

const ACCENT_MAP = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ñ: "n", ç: "c",
};

const STRIP_SUFFIXES = /\s*(?:WATERPOLO|CLUB|C\.?N\.?|TEAM)\s*$/i;
const GENDER_SUFFIX = /_[FM]$/;
const NH_HN_VARIANTS = { NH: "HN", HN: "NH" };

function normalizeTeamName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .split("")
    .map((c) => ACCENT_MAP[c.toLowerCase()] || c)
    .join("")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toUpperCase();
}

const HEX_SUFFIX = /_[0-9A-Fa-f]{6}$/i;

const PX_SUFFIX = /_\d+x\d+$/i;

function fileBaseToNormalized(base) {
  return base
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toUpperCase()
    .replace(HEX_SUFFIX, "")
    .replace(PX_SUFFIX, "");
}

function extractBgColorFromFilename(filename) {
  if (!filename || typeof filename !== "string") return null;
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/_([0-9A-Fa-f]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : null;
}

function extractDimensionsFromFilename(filename) {
  if (!filename || typeof filename !== "string") return null;
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/_(\d+)x(\d+)/);
  return match ? `${match[1]}×${match[2]}` : null;
}

let _logoIndex = null;
let _aliasMap = null;

async function getAliasMap() {
  if (_aliasMap) return _aliasMap;
  try {
    const { data } = await supabase.from("teams").select("name, alias");
    _aliasMap = new Map();
    for (const team of data || []) {
      if (Array.isArray(team.alias) && team.alias.length > 0) {
        _aliasMap.set(team.name, team.alias);
      }
    }
  } catch {
    _aliasMap = new Map();
  }
  return _aliasMap;
}

function clearAliasCache() {
  _aliasMap = null;
}

function clearLogoIndex() {
  _logoIndex = null;
}

function hasHexInBase(base) {
  return HEX_SUFFIX.test(base);
}

function hasPxInBase(base) {
  return PX_SUFFIX.test(base);
}

function buildLogoIndex() {
  if (_logoIndex) return _logoIndex;
  const index = new Map();
  for (const dir of TEAMS_LOGO_DIRS_INDEX_ORDER) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    const isTeamsLogos = dir === TEAMS_LOGOS_DIR;
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) continue;
      const base = path.basename(file, ext);
      const normalized = fileBaseToNormalized(base);
      if (!normalized) continue;
      const existing = index.get(normalized);
      const prefers100 = base.toLowerCase().includes("100x100");
      const currentHasHex = existing && hasHexInBase(path.basename(existing, path.extname(existing)));
      const newHasHex = hasHexInBase(base);
      const preferHex = newHasHex && !currentHasHex;
      const shouldOverwrite =
        isTeamsLogos ||
        !existing ||
        preferHex ||
        (prefers100 && !existing.toLowerCase().includes("100x100"));
      if (shouldOverwrite) {
        index.set(normalized, file);
      }
    }
  }
  _logoIndex = index;
  return index;
}

function getSearchKeysFromTeamName(teamName) {
  const normalized = normalizeTeamName(teamName);
  const keys = new Set([normalized]);
  let stripped = normalized.replace(GENDER_SUFFIX, "");
  if (stripped !== normalized) keys.add(stripped);
  stripped = stripped.replace(/_WATERPOLO$|_CLUB$|_TEAM$/i, "");
  if (stripped) keys.add(stripped);
  const withoutSuffix = teamName.replace(STRIP_SUFFIXES, "").trim();
  if (withoutSuffix !== teamName) {
    const k = normalizeTeamName(withoutSuffix).replace(GENDER_SUFFIX, "");
    if (k) keys.add(k);
  }
  const nhMatch = normalized.match(/(.+)_(NH|HN)$/);
  if (nhMatch) {
    const variant = NH_HN_VARIANTS[nhMatch[2]];
    if (variant) keys.add(`${nhMatch[1]}_${variant}`);
  }
  const cnMatch = stripped.match(/^(?:CN_|C_N_|CE_|C_E_)?(.+)$/);
  if (cnMatch && cnMatch[1] && cnMatch[1].length > 2) keys.add(cnMatch[1]);
  return [...keys];
}

function longestCommonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function is100x100(filename) {
  return filename.toLowerCase().includes("100x100");
}

function findBestMatchFromIndex(teamName) {
  const index = buildLogoIndex();
  const keys = getSearchKeysFromTeamName(teamName);
  for (const key of keys) {
    const exact = index.get(key);
    if (exact) return findLogoFileInDirs(exact) || exact;
    const candidates = [];
    for (const [fileBase, filename] of index) {
      const match =
        fileBase === key ||
        fileBase.startsWith(key) ||
        key.startsWith(fileBase) ||
        (key.length >= 4 && fileBase.includes(key)) ||
        (fileBase.length >= 4 && key.includes(fileBase));
      if (match) {
        const found = findLogoFileInDirs(filename);
        if (found) candidates.push(found);
      }
    }
    if (candidates.length > 0) {
      return candidates.find(is100x100) || candidates[0];
    }
  }
  return null;
}

function findClosestMatchFromIndex(teamName) {
  const index = buildLogoIndex();
  const keys = getSearchKeysFromTeamName(teamName);
  let best = { filename: null, score: 0 };
  for (const key of keys) {
    for (const [fileBase, filename] of index) {
      let score = 0;
      if (key.includes(fileBase) || fileBase.includes(key)) {
        score = Math.min(key.length, fileBase.length);
      } else {
        score = longestCommonPrefix(key, fileBase);
      }
      if (score >= 3 && score >= best.score) {
        const found = findLogoFileInDirs(filename);
        if (!found) continue;
        const dominated =
          score > best.score ||
          (is100x100(found) && !is100x100(best.filename || ""));
        if (dominated) best = { filename: found, score };
      }
    }
  }
  return best.filename;
}

function getCandidatesFromTeamName(teamName) {
  const normalized = normalizeTeamName(teamName);
  const withSpaces = teamName.replace(/\s+/g, " ").trim();
  const normalizedSpaces = withSpaces
    .split("")
    .map((c) => ACCENT_MAP[c.toLowerCase()] || c)
    .join("")
    .toUpperCase();
  const baseUnderscore = normalizedSpaces.replace(/\s+/g, "_");
  const candidates = [
    `${normalized}_100x100.png`,
    `${normalized}.png`,
    `${normalized}.jpg`,
    `${normalized}.webp`,
    `${normalized}.svg`,
    `${baseUnderscore}_100x100.png`,
    `${baseUnderscore}.png`,
  ];
  const suffixMatch = normalized.match(/^(?:CN_|C_N_|U_E_)?(.+)$/);
  if (suffixMatch && suffixMatch[1] !== normalized) {
    const short = suffixMatch[1];
    candidates.push(`${short}_100x100.png`, `${short}.png`);
  }
  const withoutGender = normalized.replace(GENDER_SUFFIX, "");
  if (withoutGender !== normalized) {
    candidates.push(`${withoutGender}_100x100.png`, `${withoutGender}.png`);
  }
  return [...new Set(candidates)];
}

function findLogoFileInDirs(filename) {
  for (const dir of TEAMS_LOGO_DIRS) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return filename;
    const baseName = path.basename(filename, path.extname(filename));
    if (!baseName.endsWith("_100x100") && !hasHexInBase(baseName)) {
      const alt = `${baseName}_100x100.png`;
      const altPath = path.join(dir, alt);
      if (fs.existsSync(altPath)) return alt;
    }
    const hexVariant = dir && fs.readdirSync(dir).find((f) => {
      const fBase = path.basename(f, path.extname(f));
      return fBase.startsWith(baseName + "_") && HEX_SUFFIX.test(fBase);
    });
    if (hexVariant) return hexVariant;
  }
  return null;
}

function resolveTeamLogoSourceSingle(teamName, explicitMapping = {}) {
  const fromMap = explicitMapping[teamName];
  if (fromMap) {
    const found = findLogoFileInDirs(fromMap);
    if (found) return found;
  }
  const candidates = getCandidatesFromTeamName(teamName);
  for (const candidate of candidates) {
    const found = findLogoFileInDirs(candidate);
    if (found) return found;
  }
  return findBestMatchFromIndex(teamName);
}

async function resolveTeamLogoSource(teamName, explicitMapping = {}, aliases) {
  const result = resolveTeamLogoSourceSingle(teamName, explicitMapping);
  if (result) return result;
  const teamAliases = aliases ?? (await getAliasMap()).get(teamName) ?? [];
  for (const alias of teamAliases) {
    const aliasResult = resolveTeamLogoSourceSingle(alias, explicitMapping);
    if (aliasResult) return aliasResult;
  }
  return null;
}

module.exports = {
  normalizeTeamName,
  getCandidatesFromTeamName,
  findLogoFileInDirs,
  resolveTeamLogoSource,
  findClosestMatchFromIndex,
  clearAliasCache,
  clearLogoIndex,
  extractBgColorFromFilename,
  extractDimensionsFromFilename,
};
