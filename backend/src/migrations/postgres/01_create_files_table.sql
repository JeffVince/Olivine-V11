-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgId UUID NOT NULL,
  source_id UUID NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  extension TEXT,
  mime_type TEXT,
  size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  version_id UUID,
  metadata JSONB,
  classification_status TEXT DEFAULT 'pending',
  extracted_text TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_files_orgId ON files(orgId);
CREATE INDEX IF NOT EXISTS idx_files_source_id ON files(source_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_updated_at ON files(updated_at);
CREATE INDEX IF NOT EXISTS idx_files_modified_at ON files(modified_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_version_id ON files(version_id);

-- Enable Row Level Security
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists
DROP POLICY IF EXISTS file_isolation ON files;

-- Create policy for tenant isolation
CREATE POLICY file_isolation ON files FOR ALL USING (orgId = current_setting('app.current_org_id')::uuid);
