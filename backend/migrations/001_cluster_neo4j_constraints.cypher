// Neo4j Constraints and Indexes for Cluster Implementation
// Purpose: Create constraints and indexes for cluster-centric knowledge graph
// Based on: cluster implementation.md section A2

// ===== UNIQUENESS CONSTRAINTS =====

// Core entity constraints
CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT content_cluster_id_unique IF NOT EXISTS FOR (cc:ContentCluster) REQUIRE cc.id IS UNIQUE;
CREATE CONSTRAINT scene_id_unique IF NOT EXISTS FOR (s:Scene) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT character_id_unique IF NOT EXISTS FOR (c:Character) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT talent_id_unique IF NOT EXISTS FOR (t:Talent) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT crew_id_unique IF NOT EXISTS FOR (cr:Crew) REQUIRE cr.id IS UNIQUE;
CREATE CONSTRAINT shoot_day_id_unique IF NOT EXISTS FOR (sd:ShootDay) REQUIRE sd.id IS UNIQUE;
CREATE CONSTRAINT location_id_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE;
CREATE CONSTRAINT vendor_id_unique IF NOT EXISTS FOR (v:Vendor) REQUIRE v.id IS UNIQUE;
CREATE CONSTRAINT purchase_order_id_unique IF NOT EXISTS FOR (po:PurchaseOrder) REQUIRE po.id IS UNIQUE;
CREATE CONSTRAINT budget_id_unique IF NOT EXISTS FOR (b:Budget) REQUIRE b.id IS UNIQUE;
CREATE CONSTRAINT compliance_rule_id_unique IF NOT EXISTS FOR (cr:ComplianceRule) REQUIRE cr.id IS UNIQUE;

// Provenance constraints
CREATE CONSTRAINT edge_fact_id_unique IF NOT EXISTS FOR (ef:EdgeFact) REQUIRE ef.id IS UNIQUE;
CREATE CONSTRAINT commit_id_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT action_id_unique IF NOT EXISTS FOR (a:Action) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT version_id_unique IF NOT EXISTS FOR (v:Version) REQUIRE v.id IS UNIQUE;

// Project and organization constraints
CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT organization_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT source_id_unique IF NOT EXISTS FOR (s:Source) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE;

// Content cluster specific constraints
CREATE CONSTRAINT content_cluster_file_unique IF NOT EXISTS FOR (cc:ContentCluster) REQUIRE cc.fileId IS UNIQUE;

// ===== PERFORMANCE INDEXES =====

// File indexes for frequent lookups
CREATE INDEX file_project_id_idx IF NOT EXISTS FOR (f:File) ON (f.projectId);
CREATE INDEX file_hash_idx IF NOT EXISTS FOR (f:File) ON (f.checksum);
CREATE INDEX file_org_id_idx IF NOT EXISTS FOR (f:File) ON (f.orgId);
CREATE INDEX file_source_id_idx IF NOT EXISTS FOR (f:File) ON (f.sourceId);
CREATE INDEX file_path_idx IF NOT EXISTS FOR (f:File) ON (f.path);
CREATE INDEX file_mime_type_idx IF NOT EXISTS FOR (f:File) ON (f.mimeType);
CREATE INDEX file_classification_status_idx IF NOT EXISTS FOR (f:File) ON (f.classificationStatus);

// EdgeFact indexes for provenance and temporal relationships
CREATE INDEX edge_fact_type_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.type);
CREATE INDEX edge_fact_from_id_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.from_id);
CREATE INDEX edge_fact_to_id_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.to_id);
CREATE INDEX edge_fact_valid_from_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.valid_from);
CREATE INDEX edge_fact_valid_to_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.valid_to);
CREATE INDEX edge_fact_org_id_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.org_id);

// Content cluster indexes
CREATE INDEX content_cluster_file_id_idx IF NOT EXISTS FOR (cc:ContentCluster) ON (cc.fileId);
CREATE INDEX content_cluster_project_id_idx IF NOT EXISTS FOR (cc:ContentCluster) ON (cc.projectId);
CREATE INDEX content_cluster_org_id_idx IF NOT EXISTS FOR (cc:ContentCluster) ON (cc.orgId);
CREATE INDEX content_cluster_status_idx IF NOT EXISTS FOR (cc:ContentCluster) ON (cc.status);
CREATE INDEX content_cluster_parser_idx IF NOT EXISTS FOR (cc:ContentCluster) ON (cc.parserName, cc.parserVersion);

// Cross-layer entity indexes
CREATE INDEX scene_project_id_idx IF NOT EXISTS FOR (s:Scene) ON (s.project_id);
CREATE INDEX scene_org_id_idx IF NOT EXISTS FOR (s:Scene) ON (s.org_id);
CREATE INDEX scene_number_idx IF NOT EXISTS FOR (s:Scene) ON (s.number);
CREATE INDEX scene_status_idx IF NOT EXISTS FOR (s:Scene) ON (s.status);

CREATE INDEX character_project_id_idx IF NOT EXISTS FOR (c:Character) ON (c.project_id);
CREATE INDEX character_org_id_idx IF NOT EXISTS FOR (c:Character) ON (c.org_id);
CREATE INDEX character_name_idx IF NOT EXISTS FOR (c:Character) ON (c.name);
CREATE INDEX character_casting_status_idx IF NOT EXISTS FOR (c:Character) ON (c.castingStatus);

CREATE INDEX talent_org_id_idx IF NOT EXISTS FOR (t:Talent) ON (t.org_id);
CREATE INDEX talent_name_idx IF NOT EXISTS FOR (t:Talent) ON (t.name);
CREATE INDEX talent_status_idx IF NOT EXISTS FOR (t:Talent) ON (t.status);

CREATE INDEX crew_org_id_idx IF NOT EXISTS FOR (cr:Crew) ON (cr.org_id);
CREATE INDEX crew_role_idx IF NOT EXISTS FOR (cr:Crew) ON (cr.role);
CREATE INDEX crew_department_idx IF NOT EXISTS FOR (cr:Crew) ON (cr.department);

CREATE INDEX shoot_day_project_id_idx IF NOT EXISTS FOR (sd:ShootDay) ON (sd.project_id);
CREATE INDEX shoot_day_org_id_idx IF NOT EXISTS FOR (sd:ShootDay) ON (sd.org_id);
CREATE INDEX shoot_day_date_idx IF NOT EXISTS FOR (sd:ShootDay) ON (sd.date);
CREATE INDEX shoot_day_status_idx IF NOT EXISTS FOR (sd:ShootDay) ON (sd.status);

CREATE INDEX location_project_id_idx IF NOT EXISTS FOR (l:Location) ON (l.project_id);
CREATE INDEX location_org_id_idx IF NOT EXISTS FOR (l:Location) ON (l.org_id);
CREATE INDEX location_type_idx IF NOT EXISTS FOR (l:Location) ON (l.type);

CREATE INDEX purchase_order_project_id_idx IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.project_id);
CREATE INDEX purchase_order_org_id_idx IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.org_id);
CREATE INDEX purchase_order_vendor_id_idx IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.vendor_id);
CREATE INDEX purchase_order_status_idx IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.status);

CREATE INDEX budget_project_id_idx IF NOT EXISTS FOR (b:Budget) ON (b.project_id);
CREATE INDEX budget_org_id_idx IF NOT EXISTS FOR (b:Budget) ON (b.org_id);
CREATE INDEX budget_status_idx IF NOT EXISTS FOR (b:Budget) ON (b.status);

CREATE INDEX compliance_rule_org_id_idx IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.org_id);
CREATE INDEX compliance_rule_category_idx IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.category);
CREATE INDEX compliance_rule_jurisdiction_idx IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.jurisdiction);

// Commit and provenance indexes
CREATE INDEX commit_org_id_idx IF NOT EXISTS FOR (c:Commit) ON (c.orgId);
CREATE INDEX commit_project_id_idx IF NOT EXISTS FOR (c:Commit) ON (c.projectId);
CREATE INDEX commit_branch_name_idx IF NOT EXISTS FOR (c:Commit) ON (c.branchName);
CREATE INDEX commit_author_idx IF NOT EXISTS FOR (c:Commit) ON (c.author);
CREATE INDEX commit_created_at_idx IF NOT EXISTS FOR (c:Commit) ON (c.createdAt);

CREATE INDEX action_commit_id_idx IF NOT EXISTS FOR (a:Action) ON (a.commitId);
CREATE INDEX action_entity_type_idx IF NOT EXISTS FOR (a:Action) ON (a.entityType);
CREATE INDEX action_entity_id_idx IF NOT EXISTS FOR (a:Action) ON (a.entityId);
CREATE INDEX action_type_idx IF NOT EXISTS FOR (a:Action) ON (a.actionType);

CREATE INDEX version_entity_id_idx IF NOT EXISTS FOR (v:Version) ON (v.entityId);
CREATE INDEX version_entity_type_idx IF NOT EXISTS FOR (v:Version) ON (v.entityType);
CREATE INDEX version_commit_id_idx IF NOT EXISTS FOR (v:Version) ON (v.commitId);

// ===== COMPOSITE INDEXES FOR COMPLEX QUERIES =====

// Multi-property indexes for common query patterns
CREATE INDEX file_org_project_idx IF NOT EXISTS FOR (f:File) ON (f.orgId, f.projectId);
CREATE INDEX file_org_status_idx IF NOT EXISTS FOR (f:File) ON (f.orgId, f.classificationStatus);
CREATE INDEX edge_fact_org_type_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.org_id, ef.type);
CREATE INDEX scene_project_number_idx IF NOT EXISTS FOR (s:Scene) ON (s.project_id, s.number);
CREATE INDEX shoot_day_project_date_idx IF NOT EXISTS FOR (sd:ShootDay) ON (sd.project_id, sd.date);

// ===== TEXT SEARCH INDEXES =====

// Full-text search indexes for content discovery
CREATE FULLTEXT INDEX file_name_search_idx IF NOT EXISTS FOR (f:File) ON EACH [f.name, f.path];
CREATE FULLTEXT INDEX scene_content_search_idx IF NOT EXISTS FOR (s:Scene) ON EACH [s.title, s.description];
CREATE FULLTEXT INDEX character_search_idx IF NOT EXISTS FOR (c:Character) ON EACH [c.name, c.description];
CREATE FULLTEXT INDEX talent_search_idx IF NOT EXISTS FOR (t:Talent) ON EACH [t.name];
CREATE FULLTEXT INDEX location_search_idx IF NOT EXISTS FOR (l:Location) ON EACH [l.name, l.address];

// ===== RANGE INDEXES FOR TEMPORAL QUERIES =====

// Range indexes for date/time queries
CREATE RANGE INDEX file_created_at_range_idx IF NOT EXISTS FOR (f:File) ON (f.createdAt);
CREATE RANGE INDEX file_updated_at_range_idx IF NOT EXISTS FOR (f:File) ON (f.updatedAt);
CREATE RANGE INDEX file_modified_range_idx IF NOT EXISTS FOR (f:File) ON (f.modified);
CREATE RANGE INDEX shoot_day_date_range_idx IF NOT EXISTS FOR (sd:ShootDay) ON (sd.date);
CREATE RANGE INDEX edge_fact_valid_from_range_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.valid_from);
CREATE RANGE INDEX edge_fact_valid_to_range_idx IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.valid_to);
CREATE RANGE INDEX commit_created_at_range_idx IF NOT EXISTS FOR (c:Commit) ON (c.createdAt);

// ===== VALIDATION QUERIES =====

// These queries can be used to validate the cluster implementation
// They should be run periodically to ensure data integrity

// Query to find files without clusters (should be empty after migration)
// MATCH (f:File) WHERE NOT EXISTS((f)-[:HAS_CLUSTER]->(:ContentCluster)) RETURN f.id, f.name;

// Query to find scenes without project links
// MATCH (s:Scene) WHERE s.project_id IS NULL RETURN s.id, s.title;

// Query to find characters without casting status
// MATCH (c:Character) WHERE c.castingStatus IS NULL RETURN c.id, c.name;

// Query to find EdgeFacts with invalid time ranges
// MATCH (ef:EdgeFact) WHERE ef.valid_to < ef.valid_from RETURN ef.id, ef.type;

// Query to find orphaned content clusters
// MATCH (cc:ContentCluster) WHERE NOT EXISTS((cc)<-[:HAS_CLUSTER]-(:File)) RETURN cc.id;

// ===== PERFORMANCE MONITORING QUERIES =====

// Query to check index usage
// CALL db.indexes() YIELD name, state, populationPercent, type RETURN name, state, populationPercent, type ORDER BY name;

// Query to check constraint violations
// CALL db.constraints() YIELD name, description, type RETURN name, description, type ORDER BY name;

// Query to analyze cluster sizes
// MATCH (cc:ContentCluster) RETURN cc.parserName, avg(cc.entitiesCount) as avgEntities, max(cc.entitiesCount) as maxEntities, count(cc) as clusterCount;

// Query to find the most connected entities (hubs in the graph)
// MATCH (n) RETURN labels(n)[0] as nodeType, n.id as nodeId, size((n)--()) as connections ORDER BY connections DESC LIMIT 20;
