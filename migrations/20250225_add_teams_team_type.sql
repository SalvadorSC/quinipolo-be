-- Add team_type column to teams table
-- Values: 'club' | 'country' | null (for filtering countries vs clubs in curator)

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS team_type text;

COMMENT ON COLUMN public.teams.team_type IS 'Team category: club, country, or null';

CREATE INDEX IF NOT EXISTS idx_teams_team_type ON public.teams(team_type) WHERE team_type IS NOT NULL;
