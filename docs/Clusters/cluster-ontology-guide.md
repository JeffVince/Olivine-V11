# Cluster-Centric Ontology Guide

## Overview

This document defines the enhanced ontology for Olivine-V11's cluster-centric knowledge representation system. The system has evolved from treating files as monolithic containers to treating them as entry points into rich clusters of interconnected knowledge nodes.

## Core Principles

1. **Files as Entry Points**: Files are gateways into clusters of knowledge, not containers of data
2. **Multi-Layer Integration**: Four ontology layers (IRL, Idea, Ops, Provenance) are explicitly linked
3. **Temporal Relationships**: All relationships can be time-bounded using EdgeFacts
4. **Multi-Slot Classification**: Files can belong to multiple canonical slots simultaneously
5. **Cross-Layer Navigation**: Any entity can be reached from any other through graph traversal

## Ontology Layers

### 1. IRL Layer (Reality/Storage)
Physical and storage entities that exist in the real world.

**Node Types:**
- `File` - Physical files in storage systems
- `Folder` - Directory structures
- `Source` - Storage providers (Dropbox, Google Drive, etc.)
- `Talent` - Real people (actors, crew members)
- `Crew` - Production crew members
- `ShootDay` - Actual production days
- `Location` - Physical locations

**Key Properties:**
- All IRL nodes have `org_id` for multi-tenancy
- Temporal properties: `createdAt`, `updatedAt`, `modified`
- Status tracking: `current`, `deleted`, `status`

### 2. Idea Layer (Creative Content)
Creative and conceptual entities from scripts, stories, and creative works.

**Node Types:**
- `Scene` - Individual scenes in scripts
- `Character` - Characters in stories
- `Content` - Generic content nodes with `contentType`
- `ContentCluster` - Clusters of extracted content from files

**Key Properties:**
- All Idea nodes link to `project_id`
- Creative metadata: `title`, `description`, `number`
- Status tracking for production workflow

### 3. Ops Layer (Business Operations)
Business, financial, and operational entities.

**Node Types:**
- `Budget` - Project budgets and financial plans
- `PurchaseOrder` - Purchase orders and expenses
- `Invoice` - Financial invoices
- `Vendor` - Service providers and suppliers
- `ComplianceRule` - Regulatory and compliance requirements

**Key Properties:**
- Financial amounts with currency tracking
- Status and approval workflows
- Links to responsible parties

### 4. Provenance Layer (Audit Trail)
Temporal and audit entities that track changes over time.

**Node Types:**
- `Commit` - Atomic change transactions
- `Action` - Individual actions within commits
- `Version` - Entity version history
- `EdgeFact` - Time-bounded relationships
- `EntityVersion` - Historical entity states

**Key Properties:**
- Temporal bounds: `valid_from`, `valid_to`
- Audit trail: `created_by_commit`, `ended_by_commit`
- Actor tracking: `author`, `created_by`

## Cross-Layer Relationships

### File → Content Cluster
Every file has exactly one content cluster that serves as the hub for extracted entities.

```cypher
(:File)-[:HAS_CLUSTER]->(:ContentCluster)
```

### Idea ↔ IRL Relationships
Creative content links to real-world production elements.

```cypher
(:Scene)-[:SCHEDULED_ON]->(:ShootDay)
(:Character)-[:PORTRAYED_BY]->(:Talent)
(:Scene)-[:HAS_LOCATION]->(:Location)
```

### Idea ↔ Ops Relationships
Creative content links to business operations.

```cypher
(:Scene)-[:BUDGETED_BY]->(:Budget)
(:PurchaseOrder)-[:FOR_SCENE]->(:Scene)
(:ComplianceRule)-[:APPLIES_TO_SCENE]->(:Scene)
```

### IRL ↔ Ops Relationships
Real-world elements link to business operations.

```cypher
(:PurchaseOrder)-[:FOR_TALENT]->(:Talent)
(:PurchaseOrder)-[:FOR_CREW]->(:Crew)
(:ShootDay)-[:HAS_PURCHASE_ORDERS]->(:PurchaseOrder)
```

### Multi-Slot Classification
Files can be classified into multiple canonical slots using EdgeFacts.

```cypher
(:File)-[:FILLS_SLOT {valid_from, confidence, rule_id}]->(:CanonicalSlot)
```

## Content Extraction and Staging

### Extraction Pipeline
1. **File Ingestion**: File is ingested and ContentCluster is created
2. **Classification**: Multi-slot classification via EdgeFacts
3. **Extraction Triggering**: Parser registry determines if extraction should run
4. **Staging**: Entities and links are extracted to staging tables
5. **Promotion**: Staged content is promoted to the Neo4j graph
6. **Cross-Layer Linking**: Relationships across layers are established

### Staging Tables (SQL)
- `extraction_job` - Tracks extraction jobs
- `extracted_entity_temp` - Staged entities before promotion
- `extracted_link_temp` - Staged relationships before promotion
- `promotion_audit` - Audit trail for promotions/rollbacks
- `parser_registry` - Configuration for extraction parsers

### Promotion Process
1. **Validation**: Staged entities validated against schemas
2. **Conflict Resolution**: Duplicates and conflicts resolved
3. **Graph Creation**: Entities created in Neo4j
4. **Relationship Creation**: Cross-layer links established
5. **Audit Logging**: All changes logged in provenance layer

## Agent Interfaces and Contracts

### Enhanced File Steward Agent
**Responsibilities:**
- File ingestion and cluster creation
- Multi-slot classification via EdgeFacts
- Extraction job triggering
- Event emission for downstream processing

**Input Contract:**
```typescript
interface FileStewardInput {
  orgId: string;
  sourceId: string;
  eventType: 'file_created' | 'file_updated' | 'file_deleted';
  resourcePath: string;
  eventData: any;
}
```

**Output Contract:**
```typescript
interface FileStewardOutput {
  fileId: string;
  clusterId: string;
  slots: string[];
  extractionTriggered: boolean;
}
```

### Content Extractor Agent
**Responsibilities:**
- Parse files and extract structured content
- Create staged entities and relationships
- Promote content to graph after validation

**Input Contract:**
```typescript
interface ContentExtractorInput {
  orgId: string;
  fileId: string;
  clusterId: string;
  slots: string[];
  parserName: string;
  parserVersion: string;
}
```

**Output Contract:**
```typescript
interface ContentExtractorOutput {
  extractedEntities: number;
  extractedLinks: number;
  confidence: number;
  promoted: boolean;
}
```

### Cross-Layer Linker Agent
**Responsibilities:**
- Establish relationships between layers
- Validate cross-layer consistency
- Repair broken or missing links

**Input Contract:**
```typescript
interface CrossLayerLinkerInput {
  orgId: string;
  clusterId: string;
  entityIds: string[];
  linkTypes: string[];
}
```

**Output Contract:**
```typescript
interface CrossLayerLinkerOutput {
  linksCreated: number;
  linksValidated: number;
  inconsistenciesFound: number;
  inconsistenciesRepaired: number;
}
```

## Event-Driven Orchestration

### Standard Events
All agents emit standardized events for workflow coordination.

**Event Schema:**
```typescript
interface StandardEvent {
  type: string;           // e.g., 'file.processed', 'content.extracted'
  orgId: string;
  timestamp: string;      // ISO 8601
  agent: string;          // Agent that emitted the event
  version: string;        // Agent version
  payload: any;           // Event-specific data
  metadata?: any;         // Additional context
}
```

**Core Events:**
- `file.ingested` - File has been ingested and cluster created
- `file.processed` - File processing complete with classification
- `content.extracted` - Content extraction completed
- `entities.created` - New entities created in graph
- `links.established` - Cross-layer relationships created
- `cluster.promoted` - Staged content promoted to graph
- `workflow.completed` - Multi-agent workflow finished

### Workflow Definitions
Workflows define multi-step processes across agents.

**File-to-Cluster Workflow:**
1. File Steward → Content Extractor
2. Content Extractor → Ontology Curator
3. Ontology Curator → Cross-Layer Linker
4. Cross-Layer Linker → Schedule Composer (conditional)
5. Cross-Layer Linker → Budget Composer (conditional)

## Data Integrity and Validation

### Consistency Rules
1. **File-Cluster Relationship**: Every File must have exactly one ContentCluster
2. **Scene-Project Relationship**: Every Scene must link to a Project
3. **Character-Casting Relationship**: Every Character must have castingStatus
4. **EdgeFact Temporal Validity**: EdgeFacts must have valid_from ≤ valid_to
5. **Cross-Layer Completeness**: Scheduled Scenes must link to ShootDays

### Validation Queries
```cypher
// Find files without clusters
MATCH (f:File) 
WHERE NOT EXISTS((f)-[:HAS_CLUSTER]->(:ContentCluster)) 
RETURN f.id, f.name;

// Find scenes without projects
MATCH (s:Scene) 
WHERE s.project_id IS NULL 
RETURN s.id, s.title;

// Find characters without casting status
MATCH (c:Character) 
WHERE c.castingStatus IS NULL 
RETURN c.id, c.name;

// Find invalid EdgeFacts
MATCH (ef:EdgeFact) 
WHERE ef.valid_to < ef.valid_from 
RETURN ef.id, ef.type;
```

### Automated Repair
The Ontology Curator Agent runs periodic validation and repair:
- **Orphan Detection**: Find entities missing required relationships
- **Consistency Enforcement**: Repair violated consistency rules
- **Temporal Validation**: Fix invalid time ranges in EdgeFacts
- **Cross-Layer Validation**: Ensure all layers are properly linked

## Migration and Backfill

### Historical Data Migration
1. **Cluster Creation**: Create ContentCluster for all existing files
2. **Multi-Slot Conversion**: Convert single classifications to EdgeFacts
3. **Cross-Layer Linking**: Establish missing relationships using text references
4. **Provenance Backfill**: Create commit history for existing data

### Migration Scripts
- `001_cluster_staging_tables.sql` - Create staging infrastructure
- `001_cluster_neo4j_constraints.cypher` - Create graph constraints
- `002_backfill_clusters.cypher` - Create clusters for existing files
- `003_convert_classifications.cypher` - Convert to EdgeFact model

## Performance Considerations

### Indexing Strategy
- **Unique Constraints**: All entity IDs
- **Lookup Indexes**: org_id, project_id, file paths
- **Temporal Indexes**: valid_from, valid_to ranges
- **Full-Text Indexes**: Names, titles, descriptions
- **Composite Indexes**: Common query patterns

### Query Optimization
- **Cluster Traversal**: Optimize for file → cluster → entities queries
- **Cross-Layer Navigation**: Index relationship endpoints
- **Temporal Queries**: Range indexes for time-bounded relationships
- **Aggregation Queries**: Optimize for dashboard and reporting needs

## Security and Access Control

### Row-Level Security (RLS)
All staging tables use RLS based on organization membership.

### Neo4j Security
- **Node-Level Security**: Filter by org_id in all queries
- **Relationship Security**: Ensure cross-org data isolation
- **Query Validation**: Validate all user queries include org_id filters

### API Security
- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control (RBAC)
- **Audit Logging**: All API calls logged with actor information

## Monitoring and Observability

### Key Metrics
- **Cluster Health**: Files with/without clusters
- **Extraction Performance**: Jobs per hour, success rate
- **Cross-Layer Completeness**: Percentage of entities with required links
- **Workflow Success Rate**: End-to-end workflow completion
- **Data Quality**: Consistency rule violations

### Alerting
- **Extraction Failures**: High failure rate or DLQ growth
- **Consistency Violations**: Integrity rule violations
- **Performance Degradation**: Query latency increases
- **Workflow Failures**: Multi-agent workflow failures

## Future Enhancements

### Planned Features
1. **ML-Based Extraction**: Machine learning parsers for complex documents
2. **Semantic Relationships**: AI-powered relationship discovery
3. **Real-Time Sync**: Live updates across all connected systems
4. **Advanced Workflows**: Complex conditional and parallel workflows
5. **Data Lineage**: Complete data lineage tracking across all transformations

### Extensibility Points
- **Custom Parsers**: Plugin architecture for domain-specific parsers
- **Custom Agents**: Framework for adding new agent types
- **Custom Workflows**: Visual workflow designer
- **Custom Ontologies**: Support for domain-specific ontology extensions

---

This ontology guide provides the foundation for understanding and working with Olivine-V11's cluster-centric knowledge representation system. All agents, APIs, and user interfaces should align with these principles and patterns.
