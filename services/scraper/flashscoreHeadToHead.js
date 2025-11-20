const axios = require("axios");

const FLASHCORE_FEED_HOSTS = [
  "13",
  "12",
  "11",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
  "1",
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.flashscore.es/",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Accept: "*/*",
  "x-fsign": "SW9D1eZo",
};

async function fetchFlashscoreHeadToHeadScores(matchIds) {
  const uniqueIds = [...new Set(matchIds.filter(Boolean))];
  const results = new Map();

  for (const matchId of uniqueIds) {
    try {
      const raw = await fetchHeadToHeadFeed(matchId);
      if (!raw) continue;
      const diffs = extractHeadToHeadDiffs(raw);
      if (diffs.length === 0) continue;
      const average = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
      results.set(matchId, average);
    } catch (error) {
      console.warn(
        `Flashscore H2H unavailable for ${matchId}: ${
          error.message ?? "unknown error"
        }`
      );
    }
  }

  return results;
}

async function fetchHeadToHeadFeed(matchId) {
  const path = `df_hh_1_${matchId}`;
  for (const host of FLASHCORE_FEED_HOSTS) {
    const url = `https://${host}.flashscore.ninja/${host}/x/feed/${path}`;
    try {
      const { data } = await axios.get(url, {
        headers: HEADERS,
        timeout: 5000,
      });
      if (isValidFeedPayload(data)) {
        return data;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function isValidFeedPayload(payload) {
  if (typeof payload !== "string") {
    return false;
  }
  const trimmed = payload.trim();
  if (!trimmed || trimmed === "0") {
    return false;
  }
  return trimmed.includes("SA÷");
}

function extractHeadToHeadDiffs(raw) {
  const sections = extractSectionBlocks(raw, "Enfrentamientos");
  const diffs = [];

  for (const section of sections) {
    const entries = section.split("~KC÷").slice(1);
    for (const entry of entries) {
      const map = parseEntry(entry);
      const diff = computeDiff(map);
      if (diff !== undefined) {
        diffs.push(diff);
      }
    }
  }

  return diffs;
}

function extractSectionBlocks(raw, label) {
  const blocks = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const start = raw.indexOf(`~KB÷${label}¬`, cursor);
    if (start === -1) {
      break;
    }
    const nextKb = raw.indexOf("~KB÷", start + 4);
    const nextKa = raw.indexOf("~KA÷", start + 4);
    const candidates = [nextKb, nextKa].filter((value) => value !== -1);
    const end = candidates.length ? Math.min(...candidates) : raw.length;
    blocks.push(raw.slice(start, end));
    cursor = end;
  }

  return blocks;
}

function parseEntry(entry) {
  const map = {};
  const fields = entry.split("¬");
  for (const field of fields) {
    if (!field) continue;
    const [key, ...rest] = field.split("÷");
    if (!key || rest.length === 0) continue;
    map[key] = rest.join("÷");
  }
  return map;
}

function computeDiff(map) {
  const home = toNumber(map["KU"]);
  const away = toNumber(map["KT"]);
  if (home !== undefined && away !== undefined) {
    return Math.abs(home - away);
  }
  if (map["KL"]) {
    const parts = map["KL"].split(":");
    if (parts.length === 2) {
      const left = Number(parts[0]);
      const right = Number(parts[1]);
      if (Number.isFinite(left) && Number.isFinite(right)) {
        return Math.abs(left - right);
      }
    }
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

module.exports = { fetchFlashscoreHeadToHeadScores };
