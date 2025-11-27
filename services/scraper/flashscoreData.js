const DATA_REGEX = /data:\s*`([^`]+)`/g;

function parseEventChunk(chunk) {
  if (!chunk.includes("AA÷")) return null;

  const fields = chunk.split("¬");
  const map = {};

  for (const field of fields) {
    const [key, ...rest] = field.split("÷");
    if (!key || rest.length === 0) continue;
    map[key] = rest.join("÷");
  }

  const id = map["AA"];
  const home = map["AE"] || map["FH"];
  const away = map["AF"] || map["FK"];
  const ts = map["AD"] ? Number(map["AD"]) * 1000 : undefined;

  // Score fields: AG÷ = home score, AH÷ = away score
  // AC÷ sometimes contains score in format "home-away" or just the score
  // Status: AB÷ = match status (FT = finished, NS = not started, etc.)
  const homeScore = map["AG"] ? Number(map["AG"]) : undefined;
  const awayScore = map["AH"] ? Number(map["AH"]) : undefined;
  const status = map["AB"] ?? undefined;

  // If scores are in AC÷ format (e.g., "10-14")
  let parsedHomeScore = homeScore;
  let parsedAwayScore = awayScore;
  if (!parsedHomeScore && !parsedAwayScore && map["AC"]) {
    const scoreMatch = map["AC"].match(/^(\d+)-(\d+)$/);
    if (scoreMatch) {
      parsedHomeScore = Number(scoreMatch[1]);
      parsedAwayScore = Number(scoreMatch[2]);
    }
  }

  if (!id || !home || !away || !ts || Number.isNaN(ts)) {
    return null;
  }

  const event = {
    id,
    home,
    away,
    timestamp: ts,
    stage: map["ER"] ?? undefined,
  };

  // Period scores from data blocks:
  // BA÷ = home period 1, BB÷ = away period 1
  // BC÷ = home period 2, BD÷ = away period 2
  // BE÷ = home period 3, BF÷ = away period 3
  // BG÷ = home period 4, BH÷ = away period 4
  // BK÷ = home period 6 (penalties), BL÷ = away period 6 (penalties)
  const homePeriod1 = map["BA"] ? Number(map["BA"]) : undefined;
  const awayPeriod1 = map["BB"] ? Number(map["BB"]) : undefined;
  const homePeriod2 = map["BC"] ? Number(map["BC"]) : undefined;
  const awayPeriod2 = map["BD"] ? Number(map["BD"]) : undefined;
  const homePeriod3 = map["BE"] ? Number(map["BE"]) : undefined;
  const awayPeriod3 = map["BF"] ? Number(map["BF"]) : undefined;
  const homePeriod4 = map["BG"] ? Number(map["BG"]) : undefined;
  const awayPeriod4 = map["BH"] ? Number(map["BH"]) : undefined;
  const homePeriod6 = map["BK"] ? Number(map["BK"]) : undefined; // Penalties
  const awayPeriod6 = map["BL"] ? Number(map["BL"]) : undefined; // Penalties

  // Calculate regulation score (sum of periods 1-4) if we have all period scores
  if (
    homePeriod1 !== undefined &&
    homePeriod2 !== undefined &&
    homePeriod3 !== undefined &&
    homePeriod4 !== undefined &&
    awayPeriod1 !== undefined &&
    awayPeriod2 !== undefined &&
    awayPeriod3 !== undefined &&
    awayPeriod4 !== undefined
  ) {
    const homeRegulation =
      homePeriod1 + homePeriod2 + homePeriod3 + homePeriod4;
    const awayRegulation =
      awayPeriod1 + awayPeriod2 + awayPeriod3 + awayPeriod4;

    // Check if match went to penalties:
    // 1. Period 6 exists (penalties column)
    // 2. Regulation score is tied but final score is different
    const hasPenalties =
      (homePeriod6 !== undefined && awayPeriod6 !== undefined) ||
      (homeRegulation === awayRegulation &&
        parsedHomeScore !== undefined &&
        parsedAwayScore !== undefined &&
        (parsedHomeScore !== homeRegulation ||
          parsedAwayScore !== awayRegulation));

    if (hasPenalties) {
      event.wentToPenalties = true;
      event.homeRegulationScore = homeRegulation;
      event.awayRegulationScore = awayRegulation;
    }
  }

  if (parsedHomeScore !== undefined && !Number.isNaN(parsedHomeScore)) {
    event.homeScore = parsedHomeScore;
  }

  if (parsedAwayScore !== undefined && !Number.isNaN(parsedAwayScore)) {
    event.awayScore = parsedAwayScore;
  }

  if (status) {
    event.status = status;
  }

  return event;
}

function extractFlashscoreEvents(html) {
  const events = [];
  const seen = new Set();
  const blocks = [...html.matchAll(DATA_REGEX)];

  for (const match of blocks) {
    const block = match[1];
    if (!block) continue;
    const chunks = block.split("¬~").filter(Boolean);

    for (const chunk of chunks) {
      const event = parseEventChunk(chunk);
      if (!event || seen.has(event.id)) continue;
      seen.add(event.id);
      events.push(event);
    }
  }

  return events;
}

module.exports = { extractFlashscoreEvents };

