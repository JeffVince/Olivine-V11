-- Create gdrive_events table
CREATE TABLE IF NOT EXISTS gdrive_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  source_id UUID NOT NULL,
  page_token TEXT,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gdrive_events_org_id ON gdrive_events(org_id);
CREATE INDEX IF NOT EXISTS idx_gdrive_events_source_id ON gdrive_events(source_id);
CREATE INDEX IF NOT EXISTS idx_gdrive_events_page_token ON gdrive_events(page_token);
CREATE INDEX IF NOT EXISTS idx_gdrive_events_created_at ON gdrive_events(created_at);

-- Enable Row Level Security
ALTER TABLE gdrive_events ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists
DROP POLICY IF EXISTS gdrive_event_isolation ON gdrive_events;

-- Create policy for tenant isolation
CREATE POLICY gdrive_event_isolation ON gdrive_events FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
