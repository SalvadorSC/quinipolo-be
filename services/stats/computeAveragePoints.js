/**
 * Compute average points among participants for a single corrected quinipolo.
 * @param {Array<{ pointsEarned?: number }>} results - Per-user correction results
 * @returns {number} average rounded to 2 decimals
 */
function computeAveragePoints(results) {
  const participantsCount = Array.isArray(results) ? results.length : 0;
  if (!participantsCount) return 0;
  const sum = results.reduce((acc, r) => acc + (r.pointsEarned || 0), 0);
  return Number((sum / participantsCount).toFixed(2));
}

module.exports = { computeAveragePoints };
