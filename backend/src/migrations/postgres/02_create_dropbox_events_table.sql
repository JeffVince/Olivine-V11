-- Create dropbox_events table
CREATE TABLE IF NOT EXISTS dropbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  source_id UUID NOT NULL,
  cursor TEXT,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dropbox_events_org_id ON dropbox_events(org_id);
CREATE INDEX IF NOT EXISTS idx_dropbox_events_source_id ON dropbox_events(source_id);
CREATE INDEX IF NOT EXISTS idx_dropbox_events_cursor ON dropbox_events(cursor);
CREATE INDEX IF NOT EXISTS idx_dropbox_events_created_at ON dropbox_events(created_at);

-- Enable Row Level Security
ALTER TABLE dropbox_events ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists
DROP POLICY IF EXISTS dropbox_event_isolation ON dropbox_events;

-- Create policy for tenant isolation
CREATE POLICY dropbox_event_isolation ON dropbox_events FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
