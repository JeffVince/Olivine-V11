/* Create CanonicalSlot nodes and taxonomy system */
/* Based on 04-File-Ontology-Architecture.md */

/* CanonicalSlot constraints and indexes */
CREATE CONSTRAINT unique_canonical_slot IF NOT EXISTS FOR (cs:CanonicalSlot) REQUIRE cs.key IS UNIQUE;
CREATE INDEX canonical_slot_org_id IF NOT EXISTS FOR (cs:CanonicalSlot) ON (cs.org_id);
CREATE INDEX canonical_slot_category IF NOT EXISTS FOR (cs:CanonicalSlot) ON (cs.category);

/* TaxonomyProfile constraints and indexes */
CREATE CONSTRAINT unique_taxonomy_profile IF NOT EXISTS FOR (tp:TaxonomyProfile) REQUIRE tp.id IS UNIQUE;
CREATE INDEX taxonomy_profile_org_id IF NOT EXISTS FOR (tp:TaxonomyProfile) ON (tp.org_id);
CREATE INDEX taxonomy_profile_active IF NOT EXISTS FOR (tp:TaxonomyProfile) ON (tp.active);

/* TaxonomyRule constraints and indexes */
CREATE CONSTRAINT unique_taxonomy_rule IF NOT EXISTS FOR (tr:TaxonomyRule) REQUIRE tr.id IS UNIQUE;
CREATE INDEX taxonomy_rule_org_id IF NOT EXISTS FOR (tr:TaxonomyRule) ON (tr.org_id);
CREATE INDEX taxonomy_rule_enabled IF NOT EXISTS FOR (tr:TaxonomyRule) ON (tr.enabled);
CREATE INDEX taxonomy_rule_priority IF NOT EXISTS FOR (tr:TaxonomyRule) ON (tr.priority);

/* EdgeFact constraints and indexes for classification */
CREATE CONSTRAINT unique_edgefact IF NOT EXISTS FOR (ef:EdgeFact) REQUIRE ef.id IS UNIQUE;
CREATE INDEX edgefact_org_id IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.org_id);
CREATE INDEX edgefact_type IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.type);
CREATE INDEX edgefact_from_id IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.from_id);
CREATE INDEX edgefact_to_id IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.to_id);
CREATE INDEX edgefact_valid_to IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.valid_to);
CREATE INDEX edgefact_classification IF NOT EXISTS FOR (ef:EdgeFact) ON (ef.type, ef.from_id, ef.valid_to);

/* Create standard CanonicalSlots */
MERGE (cs1:CanonicalSlot {
    key: "SCRIPT_PRIMARY",
    org_id: "system",
    description: "Main shooting script for production",
    category: "script",
    required: true,
    multiple: false,
    validation_rules: '{"mime_types": ["application/pdf", "text/plain"], "max_size_mb": 50, "naming_pattern": ".*script.*"}'
})

MERGE (cs2:CanonicalSlot {
    key: "SCRIPT_DRAFT",
    org_id: "system",
    description: "Script drafts and revisions",
    category: "script",
    required: false,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf", "text/plain", "application/msword"], "max_size_mb": 50, "naming_pattern": ".*(script|draft).*"}'
})

MERGE (cs3:CanonicalSlot {
    key: "BUDGET_MASTER",
    org_id: "system",
    description: "Master budget document",
    category: "budget",
    required: true,
    multiple: false,
    validation_rules: '{"mime_types": ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], "max_size_mb": 100, "naming_pattern": ".*budget.*"}'
})

MERGE (cs4:CanonicalSlot {
    key: "CALLSHEET_FINAL",
    org_id: "system",
    description: "Final call sheets",
    category: "callsheet",
    required: true,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf"], "max_size_mb": 25, "naming_pattern": ".*(callsheet|call.sheet).*"}'
})

MERGE (cs5:CanonicalSlot {
    key: "SCHEDULE_SHOOTING",
    org_id: "system",
    description: "Shooting schedules",
    category: "schedule",
    required: true,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf", "application/vnd.ms-excel"], "max_size_mb": 50, "naming_pattern": ".*(schedule|shooting).*"}'
})

MERGE (cs6:CanonicalSlot {
    key: "BREAKDOWN_SCENE",
    org_id: "system",
    description: "Scene breakdown sheets",
    category: "breakdown",
    required: false,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf", "application/vnd.ms-excel"], "max_size_mb": 100, "naming_pattern": ".*(breakdown|scene).*"}'
})

MERGE (cs7:CanonicalSlot {
    key: "CONTACT_SHEET",
    org_id: "system",
    description: "Cast/crew contact information",
    category: "contacts",
    required: true,
    multiple: false,
    validation_rules: '{"mime_types": ["application/pdf", "application/vnd.ms-excel"], "max_size_mb": 25, "naming_pattern": ".*(contact|crew|cast).*"}'
})

MERGE (cs8:CanonicalSlot {
    key: "LOCATION_RELEASE",
    org_id: "system",
    description: "Location permits and releases",
    category: "legal",
    required: false,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf"], "max_size_mb": 25, "naming_pattern": ".*(location|release|permit).*"}'
})

MERGE (cs9:CanonicalSlot {
    key: "STORYBOARD",
    org_id: "system",
    description: "Visual storyboards",
    category: "creative",
    required: false,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf", "image/jpeg", "image/png"], "max_size_mb": 200, "naming_pattern": ".*(storyboard|story.board).*"}'
})

MERGE (cs10:CanonicalSlot {
    key: "EQUIPMENT_LIST",
    org_id: "system",
    description: "Equipment rental lists",
    category: "equipment",
    required: false,
    multiple: true,
    validation_rules: '{"mime_types": ["application/pdf", "application/vnd.ms-excel"], "max_size_mb": 50, "naming_pattern": ".*(equipment|gear|rental).*"}'
})
