-- Create taxonomy_rules table (idempotent)
CREATE TABLE IF NOT EXISTS taxonomy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  slot_key TEXT NOT NULL,
  match_pattern TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS taxonomy_rules_org_id_idx ON taxonomy_rules (org_id);
CREATE INDEX IF NOT EXISTS taxonomy_rules_slot_key_idx ON taxonomy_rules (slot_key);


