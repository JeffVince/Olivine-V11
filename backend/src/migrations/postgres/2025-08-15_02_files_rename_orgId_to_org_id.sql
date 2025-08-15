-- Normalize files table to use snake_case column org_id
-- This migration is safe to run multiple times.

DO $$
BEGIN
  -- If org_id does not exist, create it from legacy "orgId" when present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'org_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'files' AND column_name = 'orgId'
    ) THEN
      -- Add new column and backfill from legacy
      ALTER TABLE files ADD COLUMN org_id uuid;
      UPDATE files SET org_id = NULLIF("orgId", '')::uuid;
      -- Drop legacy column
      ALTER TABLE files DROP COLUMN "orgId";
    ELSE
      -- Add the column if neither exists (leave nullable so existing rows don't break)
      ALTER TABLE files ADD COLUMN org_id uuid;
    END IF;
  END IF;

  -- Ensure correct type and constraints
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'org_id'
  ) THEN
    -- Cast to uuid if needed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'files' AND column_name = 'org_id' AND data_type <> 'uuid'
    ) THEN
      ALTER TABLE files 
        ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
    END IF;

    -- Set NOT NULL where possible (rows must be backfilled first)
    BEGIN
      ALTER TABLE files ALTER COLUMN org_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      -- Leave nullable if backfill not possible
      NULL;
    END;

    -- Recreate index if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i' AND c.relname = 'idx_files_org_id'
    ) THEN
      CREATE INDEX idx_files_org_id ON files(org_id);
    END IF;

    -- Fix RLS policy to reference org_id
    DROP POLICY IF EXISTS file_isolation ON files;
    CREATE POLICY file_isolation ON files FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
  END IF;
END$$;
