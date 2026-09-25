-- Quinipolo season cutover: 2025-2026 -> 2026-2027
--
-- Do not run this whole file at once. Run section A, review it, then run section B.
--
-- Preferred runner: node scripts/season-cutover-2026-27.js
--   (dry-run by default; pass --apply to write). This SQL is the same plan
--   for the Supabase SQL editor. Keep ids in sync with services/seasonCutover.js.
--
-- EXCLUSION (authoritative):
--   CNBeras is NOT finished. It stays active and can still create quinipolos.
--   Match: name normalized to 'cnberas' (case, spaces, punctuation, accents),
--   so "CNBeras", "CN Beras", "CN-Beras", and "CN Berás" all match, OR leagues.id equal to
--   the optional cnberas_id below once you know it.
--   The new Global 2026-2027 league is also not finished.
--   Every OTHER existing league, including the previous Global, is set to finished.
--
-- The new Global is a free system league. Do NOT create a Stripe Checkout
-- session or a league_subscriptions row for it. After apply, set the backend
-- env GLOBAL_LEAGUE_ID to the new id (do not commit secrets or the .env).
-- Signup alias "global" resolves through that env var.
--
-- ORDER
--   1. Apply migrations/20260925_league_status_finished.sql
--   2. Run section A (preview). Confirm CNBeras is in the excluded list and
--      NOT in the to-finish list. Confirm the previous Global row.
--   3. If CNBeras is missing or the previous Global id is wrong, STOP.
--      Set cnberas_id / previous_global_id below and re-run section A.
--   4. In section B, set apply := true and run section B only.
--   5. Set GLOBAL_LEAGUE_ID=<new id> and restart the backend.
--
-- Idempotent: re-running section B does not duplicate the new Global, does
-- not double-append the season label, does not duplicate memberships, and
-- will not mark CNBeras finished. If a previous run finished CNBeras, this
-- script sets that row back to active.
--
-- Dry-run: section A is read-only. Section B rolls back unless apply = true
-- (you will see an exception "DRY RUN ONLY"). That exception means nothing
-- was committed.

-- =============================================================================
-- Constants (edit only the optional ids if the dry-run says the defaults miss)
-- =============================================================================
-- previous_global_id default: 351a1949-f6c5-4940-ac70-1c7dd08e8b1a
-- new_global_id:              d1380c88-eaea-43a6-be7d-3d556b8fedce
-- new_global_name:            Global 2026-2027
-- cnberas_id:                 NULL until known. Name match is enough when the
--                             stored name normalizes to cnberas
--                             (case, spaces, punctuation, and accents ignored).

-- Session helper. "CNBeras", "CN Beras", and "CN Berás" all become cnberas.
CREATE OR REPLACE FUNCTION pg_temp.normalize_league_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      translate(coalesce(value, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
      '[^[:alnum:]]',
      '',
      'g'
    )
  );
$$;

-- =============================================================================
-- A. PREVIEW (read-only). Run this first.
-- =============================================================================

-- A1. Every league, and whether the cutover would finish it.
WITH params AS (
  SELECT
    '351a1949-f6c5-4940-ac70-1c7dd08e8b1a'::uuid AS previous_global_id,
    NULL::uuid AS cnberas_id, -- set this if the name match below finds nothing
    'd1380c88-eaea-43a6-be7d-3d556b8fedce'::uuid AS new_global_id,
    'Global 2026-2027'::text AS new_global_name
)
SELECT
  l.id,
  l.league_name,
  l.status,
  l.tier,
  CASE
    WHEN pg_temp.normalize_league_name(l.league_name) = 'cnberas'
      OR l.id = (SELECT cnberas_id FROM params)
      THEN 'EXCLUDE — CNBeras stays active'
    WHEN l.id = (SELECT new_global_id FROM params)
      OR l.league_name = (SELECT new_global_name FROM params)
      THEN 'EXCLUDE — new Global 2026-2027'
    WHEN l.status = 'finished'
      THEN 'already finished (no change)'
    ELSE 'WILL SET status = finished'
  END AS cutover_action,
  CASE
    WHEN l.id = (SELECT previous_global_id FROM params)
      AND l.league_name NOT LIKE '%2025-2026%'
      AND l.league_name NOT LIKE '%2025–2026%'
      THEN l.league_name || ' (2025-2026)'
    WHEN l.id = (SELECT previous_global_id FROM params)
      THEN l.league_name
    ELSE NULL
  END AS renamed_to
FROM public.leagues l
ORDER BY cutover_action, l.league_name;

-- A2. Stop if this returns 0 rows. CNBeras must be identified before apply.
WITH params AS (
  SELECT NULL::uuid AS cnberas_id
)
SELECT id, league_name, status
FROM public.leagues
WHERE pg_temp.normalize_league_name(league_name) = 'cnberas'
   OR id = (SELECT cnberas_id FROM params);

-- A3. Previous Global must be exactly one row before apply.
SELECT id, league_name, status, tier, created_by
FROM public.leagues
WHERE id = '351a1949-f6c5-4940-ac70-1c7dd08e8b1a'::uuid;

-- =============================================================================
-- B. APPLY. Leave apply := false to roll back (dry-run of the writes).
--    Set apply := true only after section A looks right.
--    Run this section in one shot so the transaction includes the guard.
--    Re-create the helper so section B still works if run on its own.
-- =============================================================================

CREATE OR REPLACE FUNCTION pg_temp.normalize_league_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      translate(coalesce(value, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
      '[^[:alnum:]]',
      '',
      'g'
    )
  );
$$;

BEGIN;

DO $$
DECLARE
  apply boolean := false; -- CHANGE TO true TO COMMIT
  previous_global_id uuid := '351a1949-f6c5-4940-ac70-1c7dd08e8b1a';
  cnberas_id uuid := NULL; -- optional explicit CNBeras id
  new_global_id uuid := 'd1380c88-eaea-43a6-be7d-3d556b8fedce';
  new_global_name text := 'Global 2026-2027';
  new_global_description text :=
    'Liga global de la temporada 2026-2027. Liga de sistema gratuita: no usa Stripe Checkout.';
  cnberas_count integer;
  previous_count integer;
  previous_name text;
  previous_tier text;
  previous_created_by uuid;
  renamed_name text;
  existing_new_id uuid;
  finished_count integer;
  enrolled_members integer;
  enrolled_leaderboard integer;
BEGIN
  SELECT count(*) INTO cnberas_count
  FROM public.leagues
  WHERE pg_temp.normalize_league_name(league_name) = 'cnberas'
     OR id = cnberas_id;

  IF cnberas_count = 0 THEN
    RAISE EXCEPTION
      'CNBeras was not found. Refusing to finish leagues. Set cnberas_id or fix the name match. CNBeras must stay active.';
  END IF;

  SELECT count(*) INTO previous_count
  FROM public.leagues
  WHERE id = previous_global_id;

  IF previous_count <> 1 THEN
    RAISE EXCEPTION
      'Previous Global % was not found. Set previous_global_id from the preview list.',
      previous_global_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = new_global_id
      AND league_name IS DISTINCT FROM new_global_name
  ) THEN
    RAISE EXCEPTION
      'New Global id % is already used by a different league.',
      new_global_id;
  END IF;

  SELECT league_name, tier, created_by
    INTO previous_name, previous_tier, previous_created_by
  FROM public.leagues
  WHERE id = previous_global_id;

  IF previous_name LIKE '%2025-2026%' OR previous_name LIKE '%2025–2026%' THEN
    renamed_name := previous_name;
  ELSE
    renamed_name := previous_name || ' (2025-2026)';
  END IF;

  UPDATE public.leagues
  SET league_name = renamed_name,
      updated_at = now()
  WHERE id = previous_global_id
    AND league_name IS DISTINCT FROM renamed_name;

  SELECT id INTO existing_new_id
  FROM public.leagues
  WHERE id = new_global_id
     OR league_name = new_global_name
  ORDER BY (id = new_global_id) DESC
  LIMIT 1;

  IF existing_new_id IS NULL THEN
    INSERT INTO public.leagues (
      id,
      league_name,
      description,
      is_private,
      tier,
      created_by,
      status
    ) VALUES (
      new_global_id,
      new_global_name,
      new_global_description,
      false,
      COALESCE(previous_tier, 'managed'),
      previous_created_by,
      'active'
    );
    existing_new_id := new_global_id;
  END IF;

  -- No Stripe row. Free system league.
  -- Keep the 2026-2027 Global active if a bad rerun finished it.
  UPDATE public.leagues
  SET status = 'active',
      updated_at = now()
  WHERE id = existing_new_id
    AND status IS DISTINCT FROM 'active';

  -- Repair CNBeras if a previous "finish all" run closed it.
  UPDATE public.leagues
  SET status = 'active',
      updated_at = now()
  WHERE status = 'finished'
    AND (
      pg_temp.normalize_league_name(league_name) = 'cnberas'
      OR id = cnberas_id
    );

  UPDATE public.leagues
  SET status = 'finished',
      updated_at = now()
  WHERE status IS DISTINCT FROM 'finished'
    AND id <> existing_new_id
    AND id IS DISTINCT FROM new_global_id
    AND league_name IS DISTINCT FROM new_global_name
    AND pg_temp.normalize_league_name(league_name) IS DISTINCT FROM 'cnberas'
    AND id IS DISTINCT FROM cnberas_id;

  GET DIAGNOSTICS finished_count = ROW_COUNT;

  INSERT INTO public.user_leagues (user_id, league_id, role)
  SELECT p.id, existing_new_id, 'participant'
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_leagues ul
    WHERE ul.user_id = p.id
      AND ul.league_id = existing_new_id
  );

  GET DIAGNOSTICS enrolled_members = ROW_COUNT;

  INSERT INTO public.leaderboard (
    user_id,
    league_id,
    points,
    full_correct_quinipolos,
    n_quinipolos_participated
  )
  SELECT p.id, existing_new_id, 0, 0, 0
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.leaderboard lb
    WHERE lb.user_id = p.id
      AND lb.league_id = existing_new_id
  );

  GET DIAGNOSTICS enrolled_leaderboard = ROW_COUNT;

  RAISE NOTICE 'Previous Global renamed to: %', renamed_name;
  RAISE NOTICE 'New Global id (set GLOBAL_LEAGUE_ID to this, do not commit it): %', existing_new_id;
  RAISE NOTICE 'Leagues newly marked finished (CNBeras excluded): %', finished_count;
  RAISE NOTICE 'Profiles newly added to user_leagues: %', enrolled_members;
  RAISE NOTICE 'Profiles newly added to leaderboard: %', enrolled_leaderboard;
  RAISE NOTICE 'CNBeras rows protected: %', cnberas_count;

  IF NOT apply THEN
    RAISE EXCEPTION
      'DRY RUN ONLY — transaction rolled back, no changes committed. Set apply := true to write.';
  END IF;
END $$;

COMMIT;
