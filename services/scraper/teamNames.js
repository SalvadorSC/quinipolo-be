function normalizeTeamName(name) {
  if (!name) {
    return "";
  }
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bc\.?n\.?\b/g, "")
    .replace(/\bf\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.replace(/[^a-z0-9]/g, "");
}

module.exports = { normalizeTeamName };
