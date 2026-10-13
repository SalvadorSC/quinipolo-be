// PostgREST encodes `.in()` on the query string. A few hundred UUIDs push
// that URL past proxy/header limits and the client fails with
// "TypeError: fetch failed". Keep each filter well under that limit.
const IN_FILTER_BATCH_SIZE = 100;

// Supabase/PostgREST caps a response (often 1000). Page so a league larger
// than that cap is not silently truncated.
const PAGE_SIZE = 1000;

function throwQueryError(error, fallback) {
  const wrapped = new Error(error?.message || fallback);
  wrapped.cause = error;
  throw wrapped;
}

function uniqueIds(ids) {
  const seen = new Set();
  const unique = [];
  for (const id of ids || []) {
    if (id == null || id === "" || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

/**
 * `.in(column, ids)` in batches. Query errors are thrown. An empty `data`
 * array is a real empty result, not a failed request.
 */
async function selectInBatches(
  client,
  { table, columns, column, ids, refine }
) {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return [];

  const rows = [];
  for (let offset = 0; offset < unique.length; offset += IN_FILTER_BATCH_SIZE) {
    const batch = unique.slice(offset, offset + IN_FILTER_BATCH_SIZE);
    let query = client.from(table).select(columns).in(column, batch);
    if (refine) query = refine(query);
    const { data, error } = await query;
    if (error) throwQueryError(error, `Failed to fetch ${table}`);
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchProfilesByIds(client, userIds) {
  return selectInBatches(client, {
    table: "profiles",
    columns: "id, username",
    column: "id",
    ids: userIds,
  });
}

async function fetchAllEq(
  client,
  { table, columns, column, value, order }
) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select(columns).eq(column, value);
    if (order) {
      for (const item of order) {
        query = query.order(item.column, { ascending: item.ascending === true });
      }
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throwQueryError(error, `Failed to fetch ${table}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    if (from / PAGE_SIZE >= 100) {
      throw new Error(`Refusing to page ${table} indefinitely`);
    }
  }
}

async function countEq(client, { table, column, value }) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throwQueryError(error, `Failed to count ${table}`);
  if (typeof count !== "number") {
    throw new Error(`Count for ${table} was not returned`);
  }
  return count;
}

module.exports = {
  IN_FILTER_BATCH_SIZE,
  PAGE_SIZE,
  selectInBatches,
  fetchProfilesByIds,
  fetchAllEq,
  countEq,
};
