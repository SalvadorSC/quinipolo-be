-- Add description column to leagues table
ALTER TABLE leagues ADD COLUMN description TEXT;

-- Add comment to document the field
COMMENT ON COLUMN leagues.description IS 'Optional description for the league';
