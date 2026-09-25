-- Allow leagues.status = 'finished'.
-- Finished leagues remain readable (quinipolos, leaderboards, results).
-- The API rejects scheduling a new quinipolo when status is 'finished'.
--
-- Existing values stay valid: active, inactive, suspended.
-- Apply this migration BEFORE deploying the backend that reads leagues.status
-- on quinipolo create, and BEFORE scripts/season-cutover-2026-27.js.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'active';

DO $$
DECLARE
  constraint_row record;
BEGIN
  -- Drop any existing CHECK that constrains leagues.status so we can extend it.
  -- Postgres names a column CHECK "leagues_status_check" unless it was renamed.
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'leagues'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.leagues DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_status_check;

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_status_check
  CHECK (
    status IS NULL
    OR status IN ('active', 'inactive', 'suspended', 'finished')
  );

COMMENT ON COLUMN public.leagues.status IS
  'active: can schedule quinipolos. finished: historical season, still viewable, new quinipolos rejected (HTTP 409 LEAGUE_FINISHED). inactive/suspended: legacy, unchanged.';
