const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveMatchSearchAccess } = require("../services/matchSearchAccess");

test("match search is on for users without the legacy scraper flag", () => {
  assert.equal(
    resolveMatchSearchAccess({ has_scraper_access: false }),
    true
  );
});

test("match search stays on for users who already had the flag", () => {
  assert.equal(resolveMatchSearchAccess({ has_scraper_access: true }), true);
});

test("match search does not depend on a profile row", () => {
  assert.equal(resolveMatchSearchAccess(null), true);
  assert.equal(resolveMatchSearchAccess(undefined), true);
  assert.equal(resolveMatchSearchAccess({}), true);
});
