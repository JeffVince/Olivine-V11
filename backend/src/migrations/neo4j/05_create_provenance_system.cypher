/* Create Provenance & Versioning system */
/* Based on 07-Provenance-Architecture.md */

/* Commit constraints and indexes */
CREATE CONSTRAINT unique_commit IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE INDEX commit_org_id IF NOT EXISTS FOR (c:Commit) ON (c.org_id);
CREATE INDEX commit_author IF NOT EXISTS FOR (c:Commit) ON (c.author);
CREATE INDEX commit_timestamp IF NOT EXISTS FOR (c:Commit) ON (c.timestamp);
CREATE INDEX commit_branch IF NOT EXISTS FOR (c:Commit) ON (c.branch);
CREATE INDEX commit_timeline IF NOT EXISTS FOR (c:Commit) ON (c.org_id, c.timestamp, c.branch);

/* Action constraints and indexes */
CREATE CONSTRAINT unique_action IF NOT EXISTS FOR (a:Action) REQUIRE a.id IS UNIQUE;
CREATE INDEX action_tool IF NOT EXISTS FOR (a:Action) ON (a.tool);
CREATE INDEX action_type IF NOT EXISTS FOR (a:Action) ON (a.action_type);
CREATE INDEX action_timestamp IF NOT EXISTS FOR (a:Action) ON (a.timestamp);
CREATE INDEX action_status IF NOT EXISTS FOR (a:Action) ON (a.status);
CREATE INDEX action_entity_lookup IF NOT EXISTS FOR (a:Action) ON (a.tool, a.action_type, a.timestamp);

/* EntityVersion constraints and indexes */
CREATE CONSTRAINT unique_entity_version IF NOT EXISTS FOR (ev:EntityVersion) REQUIRE ev.id IS UNIQUE;
CREATE INDEX entity_version_org_id IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.org_id);
CREATE INDEX entity_version_entity_id IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.entity_id);
CREATE INDEX entity_version_entity_type IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.entity_type);
CREATE INDEX entity_version_valid_from IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.valid_from);
CREATE INDEX entity_version_valid_to IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.valid_to);
CREATE INDEX entity_version_temporal IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.entity_id, ev.entity_type, ev.valid_from, ev.valid_to);
CREATE INDEX current_versions IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.entity_id, ev.entity_type);

/* Branch constraints and indexes */
CREATE CONSTRAINT unique_branch IF NOT EXISTS FOR (b:Branch) REQUIRE (b.name, b.org_id) IS UNIQUE;
CREATE INDEX branch_org_id IF NOT EXISTS FOR (b:Branch) ON (b.org_id);
CREATE INDEX branch_project_id IF NOT EXISTS FOR (b:Branch) ON (b.project_id);
CREATE INDEX branch_status IF NOT EXISTS FOR (b:Branch) ON (b.status);
CREATE INDEX branch_created_by IF NOT EXISTS FOR (b:Branch) ON (b.created_by);

/* Temporal EdgeFact indexes (additional to base EdgeFact indexes) */
CREATE INDEX temporal_edgefacts IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.type, ef.valid_from, ef.valid_to);
CREATE INDEX current_edgefacts IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.type, ef.from_id, ef.to_id);
CREATE INDEX edgefact_commit_tracking IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.created_by_commit);

/* Performance indexes for common temporal queries */
CREATE INDEX temporal_range_queries IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.valid_from, ef.valid_to);
CREATE INDEX entity_history_lookup IF NOT EXISTS FOR (ev:EntityVersion) ON (ev.entity_id, ev.valid_from);

/* Create default main branch for system */
CREATE (main_branch:Branch {
    name: "main",
    org_id: "system",
    description: "Default main branch for system operations",
    status: "active",
    created_by: "system",
    created_at: datetime(),
    metadata: '{"purpose": "system_default", "approval_required": false}'
})
