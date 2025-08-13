-- Migration: 001_cluster_staging_tables.sql
-- Purpose: Create staging tables for content extraction and cluster management
-- Based on: cluster implementation.md section B1

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== EXTRACTION JOB TRACKING =====

-- extraction_job: tracks parsing jobs from file to staged entities
CREATE TABLE extraction_job (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL,
    org_id UUID NOT NULL,
    project_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    parser_name VARCHAR(100) NOT NULL,
    parser_version VARCHAR(20) NOT NULL,
    method VARCHAR(50) NOT NULL, -- 'rule-based', 'ml', 'hybrid'
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    dedupe_key VARCHAR(255) NOT NULL, -- file_id + parser_name + parser_version + file_hash
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    promoted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT extraction_job_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'promoted', 'rolled_back')),
    CONSTRAINT extraction_job_confidence_check CHECK (confidence IS NULL OR (confidence >= 0.00 AND confidence <= 1.00)),
    CONSTRAINT extraction_job_dedupe_key_unique UNIQUE (dedupe_key)
);

-- extracted_entity_temp: staged entities before promotion to graph
CREATE TABLE extracted_entity_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES extraction_job(id) ON DELETE CASCADE,
    kind VARCHAR(100) NOT NULL, -- 'Scene', 'Character', 'ShootDay', 'BudgetLineItem', 'CrewRole'
    raw_json JSONB NOT NULL,
    hash VARCHAR(64) NOT NULL, -- SHA-256 hash of normalized raw_json
    confidence DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    source_offset VARCHAR(100), -- page number, line number, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT extracted_entity_confidence_check CHECK (confidence >= 0.00 AND confidence <= 1.00),
    CONSTRAINT extracted_entity_job_hash_unique UNIQUE (job_id, hash)
);

-- extracted_link_temp: staged relationships before promotion to graph
CREATE TABLE extracted_link_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES extraction_job(id) ON DELETE CASCADE,
    from_hash VARCHAR(64) NOT NULL, -- hash of source entity
    to_hash VARCHAR(64) NOT NULL, -- hash of target entity
    rel_type VARCHAR(100) NOT NULL, -- 'SCHEDULED_ON', 'PORTRAYED_BY', 'HAS_LOCATION', etc.
    raw_json JSONB NOT NULL,
    confidence DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT extracted_link_confidence_check CHECK (confidence >= 0.00 AND confidence <= 1.00),
    CONSTRAINT extracted_link_job_unique UNIQUE (job_id, from_hash, to_hash, rel_type)
);

-- ===== PARSER REGISTRY & POLICY =====

-- parser_registry: configures which parsers are enabled for different file types
CREATE TABLE parser_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    slot VARCHAR(100) NOT NULL, -- canonical slot like 'SCRIPT_PRIMARY'
    mime_type VARCHAR(100), -- 'application/pdf', 'text/plain', etc.
    extension VARCHAR(10), -- '.pdf', '.fdx', '.fountain', etc.
    parser_name VARCHAR(100) NOT NULL,
    parser_version VARCHAR(20) NOT NULL,
    min_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    feature_flag BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT parser_registry_confidence_check CHECK (min_confidence >= 0.00 AND min_confidence <= 1.00),
    CONSTRAINT parser_registry_org_slot_mime_unique UNIQUE (org_id, slot, mime_type, extension)
);

-- ===== PROMOTION AUDIT TRAIL =====

-- promotion_audit: tracks all promotion and rollback operations
CREATE TABLE promotion_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES extraction_job(id),
    actor VARCHAR(255) NOT NULL, -- user ID or 'system'
    action VARCHAR(50) NOT NULL, -- 'promote', 'rollback', 'edit'
    before_json JSONB, -- state before action
    after_json JSONB, -- state after action
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT promotion_audit_action_check CHECK (action IN ('promote', 'rollback', 'edit', 'reject'))
);

-- ===== CONTENT CLUSTERS =====

-- content_cluster: represents a cluster of extracted content nodes from a file
CREATE TABLE content_cluster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    file_id UUID NOT NULL,
    project_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'empty',
    extraction_method VARCHAR(50), -- 'manual', 'rule-based', 'ml', 'hybrid'
    parser_name VARCHAR(100),
    parser_version VARCHAR(20),
    confidence DECIMAL(3,2),
    entities_count INTEGER NOT NULL DEFAULT 0,
    links_count INTEGER NOT NULL DEFAULT 0,
    extracted_at TIMESTAMPTZ,
    promoted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT content_cluster_status_check CHECK (status IN ('empty', 'extracting', 'staged', 'promoted', 'failed')),
    CONSTRAINT content_cluster_confidence_check CHECK (confidence IS NULL OR (confidence >= 0.00 AND confidence <= 1.00)),
    CONSTRAINT content_cluster_file_unique UNIQUE (file_id) -- one cluster per file
);

-- ===== INDEXES FOR PERFORMANCE =====

-- Extraction job indexes
CREATE INDEX idx_extraction_job_file_id ON extraction_job(file_id);
CREATE INDEX idx_extraction_job_org_id ON extraction_job(org_id);
CREATE INDEX idx_extraction_job_status ON extraction_job(status);
CREATE INDEX idx_extraction_job_created_at ON extraction_job(created_at);
CREATE INDEX idx_extraction_job_parser ON extraction_job(parser_name, parser_version);

-- Staged entity indexes
CREATE INDEX idx_extracted_entity_job_id ON extracted_entity_temp(job_id);
CREATE INDEX idx_extracted_entity_kind ON extracted_entity_temp(kind);
CREATE INDEX idx_extracted_entity_hash ON extracted_entity_temp(hash);
CREATE INDEX idx_extracted_entity_confidence ON extracted_entity_temp(confidence);

-- Staged link indexes
CREATE INDEX idx_extracted_link_job_id ON extracted_link_temp(job_id);
CREATE INDEX idx_extracted_link_from_hash ON extracted_link_temp(from_hash);
CREATE INDEX idx_extracted_link_to_hash ON extracted_link_temp(to_hash);
CREATE INDEX idx_extracted_link_rel_type ON extracted_link_temp(rel_type);

-- Parser registry indexes
CREATE INDEX idx_parser_registry_org_id ON parser_registry(org_id);
CREATE INDEX idx_parser_registry_slot ON parser_registry(slot);
CREATE INDEX idx_parser_registry_enabled ON parser_registry(enabled);
CREATE INDEX idx_parser_registry_feature_flag ON parser_registry(feature_flag);

-- Promotion audit indexes
CREATE INDEX idx_promotion_audit_job_id ON promotion_audit(job_id);
CREATE INDEX idx_promotion_audit_actor ON promotion_audit(actor);
CREATE INDEX idx_promotion_audit_action ON promotion_audit(action);
CREATE INDEX idx_promotion_audit_timestamp ON promotion_audit(timestamp);

-- Content cluster indexes
CREATE INDEX idx_content_cluster_org_id ON content_cluster(org_id);
CREATE INDEX idx_content_cluster_file_id ON content_cluster(file_id);
CREATE INDEX idx_content_cluster_project_id ON content_cluster(project_id);
CREATE INDEX idx_content_cluster_status ON content_cluster(status);

-- ===== ROW LEVEL SECURITY (RLS) =====

-- Enable RLS on all tables
ALTER TABLE extraction_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_entity_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_link_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE parser_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cluster ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic org-based isolation)
-- Note: These assume auth.uid() and user_org_id() functions exist

CREATE POLICY "Users can access extraction jobs in their org" ON extraction_job
    FOR ALL USING (org_id = user_org_id());

CREATE POLICY "Users can access staged entities in their org" ON extracted_entity_temp
    FOR ALL USING (EXISTS (
        SELECT 1 FROM extraction_job ej 
        WHERE ej.id = extracted_entity_temp.job_id 
        AND ej.org_id = user_org_id()
    ));

CREATE POLICY "Users can access staged links in their org" ON extracted_link_temp
    FOR ALL USING (EXISTS (
        SELECT 1 FROM extraction_job ej 
        WHERE ej.id = extracted_link_temp.job_id 
        AND ej.org_id = user_org_id()
    ));

CREATE POLICY "Users can access parser registry in their org" ON parser_registry
    FOR ALL USING (org_id = user_org_id());

CREATE POLICY "Users can access promotion audit in their org" ON promotion_audit
    FOR ALL USING (EXISTS (
        SELECT 1 FROM extraction_job ej 
        WHERE ej.id = promotion_audit.job_id 
        AND ej.org_id = user_org_id()
    ));

CREATE POLICY "Users can access content clusters in their org" ON content_cluster
    FOR ALL USING (org_id = user_org_id());

-- ===== DATA RETENTION POLICIES =====

-- Note: These are comments for now - implement with pg_cron or application logic
-- Staging rows TTL: 90 days
-- DELETE FROM extracted_entity_temp WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM extracted_link_temp WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM extraction_job WHERE created_at < NOW() - INTERVAL '90 days' AND status IN ('completed', 'failed');

-- Audit logs retention: 2 years
-- DELETE FROM promotion_audit WHERE timestamp < NOW() - INTERVAL '2 years';

-- ===== TRIGGERS FOR UPDATED_AT =====

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at columns
CREATE TRIGGER update_parser_registry_updated_at 
    BEFORE UPDATE ON parser_registry 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_cluster_updated_at 
    BEFORE UPDATE ON content_cluster 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== COMMENTS FOR DOCUMENTATION =====

COMMENT ON TABLE extraction_job IS 'Tracks parsing jobs from files to staged entities';
COMMENT ON TABLE extracted_entity_temp IS 'Staged entities before promotion to Neo4j graph';
COMMENT ON TABLE extracted_link_temp IS 'Staged relationships before promotion to Neo4j graph';
COMMENT ON TABLE parser_registry IS 'Configuration for which parsers are enabled per file type';
COMMENT ON TABLE promotion_audit IS 'Audit trail for all promotion and rollback operations';
COMMENT ON TABLE content_cluster IS 'Represents a cluster of extracted content nodes from a file';

COMMENT ON COLUMN extraction_job.dedupe_key IS 'Prevents duplicate jobs: file_id + parser_name + parser_version + file_hash';
COMMENT ON COLUMN extracted_entity_temp.hash IS 'SHA-256 hash of normalized raw_json for deduplication';
COMMENT ON COLUMN extracted_entity_temp.source_offset IS 'Location in source file: page number, line number, etc.';
COMMENT ON COLUMN parser_registry.feature_flag IS 'Global feature flag to enable/disable parser';
COMMENT ON COLUMN content_cluster.entities_count IS 'Cached count of entities in this cluster';
COMMENT ON COLUMN content_cluster.links_count IS 'Cached count of relationships in this cluster';
