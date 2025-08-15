-- Normalize sources table to use snake_case column org_id
-- This migration is safe to run multiple times.

DO $$
BEGIN
  -- If the legacy "orgId" column exists and the new org_id does not, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sources' AND column_name = 'orgId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sources' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE sources RENAME COLUMN "orgId" TO org_id;
  END IF;

  -- If both columns exist, copy data then drop legacy column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sources' AND column_name = 'orgId'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sources' AND column_name = 'org_id'
  ) THEN
    -- Fill org_id where null from legacy column
    UPDATE sources SET org_id = COALESCE(org_id, NULLIF("orgId", '')::uuid)
    WHERE org_id IS NULL AND "orgId" IS NOT NULL AND "orgId" <> '';

    -- Drop the legacy column
    ALTER TABLE sources DROP COLUMN "orgId";
  END IF;

  -- Ensure correct type and constraints
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sources' AND column_name = 'org_id'
  ) THEN
    -- Cast to uuid if needed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sources' AND column_name = 'org_id' AND data_type <> 'uuid'
    ) THEN
      ALTER TABLE sources 
        ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
    END IF;

    -- Set NOT NULL
    ALTER TABLE sources ALTER COLUMN org_id SET NOT NULL;
  END IF;

  -- Recreate index if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_sources_org_id'
  ) THEN
    CREATE INDEX idx_sources_org_id ON sources(org_id);
  END IF;

  -- Fix RLS policy to reference org_id
  DROP POLICY IF EXISTS source_org_isolation_policy ON sources;
  CREATE POLICY source_org_isolation_policy ON sources 
    FOR ALL USING (org_id = current_setting('app.current_org_id'::text)::uuid);
END$$;
