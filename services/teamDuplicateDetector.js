/**
 * Detects potential duplicate teams for curator merge.
 * Groups teams by normalized base (strip F/M, (balonmano), etc.)
 */

function deburr(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function extractGenderSuffix(name) {
  const match = name.match(/\s+([FfMm])\s*$/);
  return match ? match[1].toLowerCase() : "";
}

function normalizeForGrouping(name) {
  if (!name || typeof name !== "string") return "";
  let n = name
    .replace(/\s*\(balonmano\)\s*/gi, "")
    .replace(/\s*\/\s*/g, " ")
    .trim();
  const genderSuffix = extractGenderSuffix(n);
  n = deburr(n)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  n = n.replace(/\s+[fm]\s*$/i, "").trim();
  return genderSuffix ? `${n}__${genderSuffix}` : n;
}

/**
 * @param {Array<{id: string, name: string}>} teams
 * @returns {Array<{ canonicalId: string, canonicalName: string, duplicates: Array<{id: string, name: string}> }>}
 */
function detectDuplicateGroups(teams) {
  const byKey = new Map();

  for (const team of teams) {
    const key = normalizeForGrouping(team.name);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key).push({ id: team.id, name: team.name });
  }

  const groups = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.name.localeCompare(b.name));
    groups.push({
      canonicalId: list[0].id,
      canonicalName: list[0].name,
      duplicates: list.slice(1),
    });
  }
  return groups;
}

module.exports = { detectDuplicateGroups, normalizeForGrouping };
