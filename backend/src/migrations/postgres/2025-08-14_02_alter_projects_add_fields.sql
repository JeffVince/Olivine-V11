-- Align projects table with application model
-- - Rename name -> title
-- - Add type, start_date, budget, metadata

-- 1) Rename column name -> title (original schema created 'name')
ALTER TABLE projects RENAME COLUMN name TO title;

-- 2) Add missing columns if not present
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3) Add updated_at column if it doesn't exist (may have been lost in migration)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4) Ensure NOT NULL for required columns with safe defaults if needed
UPDATE projects SET type = COALESCE(type, 'feature_film');
ALTER TABLE projects ALTER COLUMN type SET DEFAULT 'feature_film';
ALTER TABLE projects ALTER COLUMN type SET NOT NULL;
ALTER TABLE projects ALTER COLUMN type DROP DEFAULT;
