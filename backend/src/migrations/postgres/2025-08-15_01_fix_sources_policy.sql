-- Fix sources table RLS policy to use correct column name
-- The policy was referencing 'orgId' but the column is 'org_id'

-- Drop existing policy
DROP POLICY IF EXISTS source_org_isolation_policy ON sources;

-- Create corrected policy
CREATE POLICY source_org_isolation_policy ON sources 
FOR ALL 
USING (org_id = current_setting('app.current_org_id'::text)::uuid);
