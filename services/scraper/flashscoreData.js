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

  if (!id || !home || !away || !ts || Number.isNaN(ts)) {
    return null;
  }

  return {
    id,
    home,
    away,
    timestamp: ts,
    stage: map["ER"] ?? undefined,
  };
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

