/**
 * Match search is the sparkles "Autocompletar Quinipolo" flow
 * (GET /api/scraper/matches when creating a quinipolo, and
 * GET /api/scraper/results when correcting one).
 *
 * Web and mobile show those controls only when the profile payload
 * has hasScraperAccess === true. That used to mirror
 * profiles.has_scraper_access, so only an allowlisted subset of users
 * could search matches — and only in the leagues they moderate.
 *
 * Every active league (Global, managed, self-managed) gets the feature.
 * Tier, Stripe, and the legacy column do not gate it. Finished leagues
 * stay blocked on the quinipolo write paths, not here.
 *
 * @param {object | null | undefined} _profile
 * @returns {boolean}
 */
function resolveMatchSearchAccess(_profile) {
  return true;
}

module.exports = {
  resolveMatchSearchAccess,
};
