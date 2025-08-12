# System Architecture Implementation Plan
## Core Infrastructure and Technology Stack

### 1. Neo4j Knowledge Graph Implementation

#### 1.1 Database Setup and Configuration

**Neo4j Installation and Configuration**
```bash
# Production Neo4j Setup - Version: Neo4j 5.x Enterprise Edition
# Memory Configuration: 32GB heap, 64GB page cache
# Clustering: 3-node cluster for high availability

version: '3.8'
services:
  neo4j-core-1:
    image: neo4j:5.15-enterprise
    environment:
      NEO4J_AUTH: neo4j/production_password
      NEO4J_dbms_mode: CORE
      NEO4J_causal__clustering_minimum__core__cluster__size__at__formation: 3
      NEO4J_causal__clustering_minimum__core__cluster__size__at__runtime: 3
      NEO4J_causal__clustering_initial__discovery__members: neo4j-core-1:5000,neo4j-core-2:5000,neo4j-core-3:5000
      NEO4J_dbms_memory_heap_initial__size: 8G
      NEO4J_dbms_memory_heap_max__size: 8G
      NEO4J_dbms_memory_pagecache_size: 16G
      NEO4J_dbms_security_procedures_unrestricted: apoc.*,gds.*
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j-core-1-data:/data
      - neo4j-core-1-logs:/logs
```

**Database Constraints and Indexes**
```cypher
// === CORE CONSTRAINTS FOR DATA INTEGRITY ===

// Identity constraints for primary entities
CREATE CONSTRAINT unique_commit        IF NOT EXISTS FOR (c:Commit)          REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT unique_action        IF NOT EXISTS FOR (a:Action)          REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT unique_org           IF NOT EXISTS FOR (o:Org)             REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT unique_project       IF NOT EXISTS FOR (p:Project)         REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT unique_source        IF NOT EXISTS FOR (s:Source)          REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT unique_folder        IF NOT EXISTS FOR (f:Folder)          REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT unique_file          IF NOT EXISTS FOR (f:File)            REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT unique_slot          IF NOT EXISTS FOR (s:CanonicalSlot)   REQUIRE s.key IS UNIQUE;
CREATE CONSTRAINT unique_profile       IF NOT EXISTS FOR (p:TaxonomyProfile) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT unique_rule          IF NOT EXISTS FOR (r:TaxonomyRule)    REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT unique_edgefact      IF NOT EXISTS FOR (e:EdgeFact)        REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT unique_branch        IF NOT EXISTS FOR (b:Branch)          REQUIRE b.name IS UNIQUE;

// Content ontology constraints
CREATE CONSTRAINT unique_scene         IF NOT EXISTS FOR (s:Scene)           REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT unique_character     IF NOT EXISTS FOR (c:Character)       REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT unique_prop          IF NOT EXISTS FOR (p:Prop)            REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT unique_location      IF NOT EXISTS FOR (l:Location)        REQUIRE l.id IS UNIQUE;
CREATE CONSTRAINT unique_crew          IF NOT EXISTS FOR (c:Crew)            REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT unique_shootday      IF NOT EXISTS FOR (s:ShootDay)        REQUIRE s.id IS UNIQUE;

// Operations ontology constraints
CREATE CONSTRAINT unique_vendor        IF NOT EXISTS FOR (v:Vendor)          REQUIRE v.id IS UNIQUE;
CREATE CONSTRAINT unique_po            IF NOT EXISTS FOR (p:PO)              REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT unique_invoice       IF NOT EXISTS FOR (i:Invoice)         REQUIRE i.id IS UNIQUE;
CREATE CONSTRAINT unique_timesheet     IF NOT EXISTS FOR (t:Timesheet)       REQUIRE t.id IS UNIQUE;

// Versioning constraints
CREATE CONSTRAINT unique_entityversion IF NOT EXISTS FOR (v:EntityVersion)   REQUIRE v.id IS UNIQUE;

// === PERFORMANCE INDEXES ===

// Multi-tenant isolation indexes
CREATE INDEX file_org_id          IF NOT EXISTS FOR (f:File)          ON (f.org_id);
CREATE INDEX project_org_id       IF NOT EXISTS FOR (p:Project)       ON (p.org_id);
CREATE INDEX folder_org_id        IF NOT EXISTS FOR (f:Folder)        ON (f.org_id);
CREATE INDEX source_org_id        IF NOT EXISTS FOR (s:Source)        ON (s.org_id);
CREATE INDEX scene_org_id         IF NOT EXISTS FOR (s:Scene)         ON (s.org_id);
CREATE INDEX character_org_id     IF NOT EXISTS FOR (c:Character)     ON (c.org_id);
CREATE INDEX prop_org_id          IF NOT EXISTS FOR (p:Prop)          ON (p.org_id);
CREATE INDEX location_org_id      IF NOT EXISTS FOR (l:Location)      ON (l.org_id);
CREATE INDEX crew_org_id          IF NOT EXISTS FOR (c:Crew)          ON (c.org_id);

// Temporal query indexes for versioning
CREATE INDEX edgefact_lookup      IF NOT EXISTS FOR (e:EdgeFact)      ON (e.type, e.from_id, e.to_id, e.valid_to);
CREATE INDEX entityversion_lookup IF NOT EXISTS FOR (v:EntityVersion) ON (v.entity_id, v.entity_type, v.valid_to);
CREATE INDEX entityversion_temporal IF NOT EXISTS FOR (v:EntityVersion) ON (v.valid_from, v.valid_to);

// File system navigation indexes
CREATE INDEX file_path_lookup     IF NOT EXISTS FOR (f:File)          ON (f.path, f.org_id);
CREATE INDEX folder_path_lookup   IF NOT EXISTS FOR (f:Folder)        ON (f.path, f.org_id);
CREATE INDEX file_parent_lookup   IF NOT EXISTS FOR (f:File)          ON (f.parent_id, f.org_id);

// Content relationship indexes
CREATE INDEX scene_project_lookup IF NOT EXISTS FOR (s:Scene)         ON (s.project_id, s.org_id);
CREATE INDEX crew_project_lookup  IF NOT EXISTS FOR (c:Crew)          ON (c.project_id, s.org_id);
CREATE INDEX shootday_project_lookup IF NOT EXISTS FOR (s:ShootDay)   ON (s.project_id, s.org_id);

// Classification and taxonomy indexes
CREATE INDEX file_classification  IF NOT EXISTS FOR (f:File)          ON (f.classification_status, f.org_id);
CREATE INDEX slot_classification  IF NOT EXISTS FOR (s:CanonicalSlot) ON (s.category, f.org_id);

// Provenance and audit indexes
CREATE INDEX commit_timestamp     IF NOT EXISTS FOR (c:Commit)        ON (c.timestamp);
CREATE INDEX commit_author        IF NOT EXISTS FOR (c:Commit)        ON (c.author, c.org_id);
CREATE INDEX action_timestamp     IF NOT EXISTS FOR (a:Action)        ON (a.timestamp);
CREATE INDEX action_tool          IF NOT EXISTS FOR (a:Action)        ON (a.tool, a.status);

// Full-text search indexes
CREATE FULLTEXT INDEX file_content_search IF NOT EXISTS FOR (f:File) ON EACH [f.name, f.extracted_text];
CREATE FULLTEXT INDEX scene_content_search IF NOT EXISTS FOR (s:Scene) ON EACH [s.description, s.notes];
CREATE FULLTEXT INDEX character_search IF NOT EXISTS FOR (c:Character) ON EACH [c.name, c.description];
```

#### 1.2 Multi-Tenant Data Isolation

**Tenant Isolation Strategy**
```typescript
export interface TenantContext {
  orgId: string;
  userId: string;
  permissions: string[];
  projectIds: string[];
}

export class TenantIsolationService {
  /**
   * Validates and injects org_id into all database operations
   * CRITICAL: Every Neo4j query MUST include org_id filtering
   */
  async validateTenantAccess(context: TenantContext, resourceId: string): Promise<boolean> {
    const query = `
      MATCH (resource {id: $resourceId, org_id: $orgId})
      RETURN COUNT(resource) > 0 as hasAccess
    `;
    
    const result = await this.neo4jService.run(query, {
      resourceId,
      orgId: context.orgId
    });
    
    return result.records[0].get('hasAccess');
  }

  /**
   * Wraps all Cypher queries with mandatory org_id filtering
   */
  buildTenantQuery(baseQuery: string, orgId: string): string {
    // Inject org_id filtering into MATCH clauses
    const tenantQuery = baseQuery.replace(
      /MATCH\s*\(([^)]+)\)/g,
      `MATCH ($1 {org_id: "${orgId}"})`
    );
    
    return tenantQuery;
  }
}
```

### 2. Supabase/PostgreSQL Integration

#### 2.1 Core Database Schema

**Essential Tables for Multi-Tenant Architecture**
```sql
-- Organizations (Multi-tenancy root)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- Storage Sources
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'dropbox', 'gdrive', 'supabase'
  provider_account_id TEXT NOT NULL,
  token_ref TEXT, -- Reference to external secret store
  settings JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider_account_id)
);

-- Files with comprehensive metadata
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  size BIGINT,
  mime_type TEXT,
  checksum TEXT,
  metadata JSONB DEFAULT '{}',
  classification_status TEXT DEFAULT 'pending',
  classification_confidence FLOAT,
  canonical_slot TEXT,
  extracted_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  modified TIMESTAMPTZ, -- File system modification time
  UNIQUE(org_id, source_id, path)
);

-- Sync Events for Change Tracking
CREATE TABLE sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'file_created', 'file_updated', 'file_deleted'
  resource_type TEXT NOT NULL, -- 'file', 'folder'
  resource_id UUID,
  resource_path TEXT,
  event_data JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provenance and Versioning
CREATE TABLE commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  branch_name TEXT DEFAULT 'main',
  parent_commit_id UUID REFERENCES commits(id),
  author_id UUID NOT NULL,
  author_type TEXT DEFAULT 'user', -- 'user', 'agent', 'system'
  message TEXT NOT NULL,
  commit_hash TEXT UNIQUE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  signature TEXT -- Cryptographic signature for audit trail
);

-- Row Level Security for multi-tenancy
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY org_isolation ON organizations FOR ALL USING (id = current_setting('app.current_org_id')::uuid);
CREATE POLICY project_isolation ON projects FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY source_isolation ON sources FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY file_isolation ON files FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY sync_event_isolation ON sync_events FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY commit_isolation ON commits FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
```

### 3. GraphQL API Architecture

#### 3.1 Core Schema Design

**Primary GraphQL Types**
```graphql
scalar DateTime
scalar JSON
scalar Upload

type Organization {
  id: ID!
  name: String!
  slug: String!
  settings: JSON
  projects: [Project!]!
  sources: [Source!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Project {
  id: ID!
  orgId: ID!
  name: String!
  description: String
  status: ProjectStatus!
  settings: JSON
  files: [File!]!
  scenes: [Scene!]!
  characters: [Character!]!
  props: [Prop!]!
  locations: [Location!]!
  crew: [Crew!]!
  shootDays: [ShootDay!]!
  commits: [Commit!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type File {
  id: ID!
  orgId: ID!
  sourceId: ID!
  projectId: ID
  parentId: ID
  name: String!
  path: String!
  size: Int
  mimeType: String
  checksum: String
  metadata: JSON
  classificationStatus: ClassificationStatus!
  classificationConfidence: Float
  canonicalSlot: String
  extractedText: String
  createdAt: DateTime!
  updatedAt: DateTime!
  modified: DateTime
  
  # Relationships
  source: Source!
  project: Project
  parent: File
  children: [File!]!
  versions: [EntityVersion!]!
}

enum ProjectStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
  CANCELLED
}

enum ClassificationStatus {
  PENDING
  CLASSIFIED
  MANUAL_REVIEW
  FAILED
}

type Query {
  # Organization queries
  organization(id: ID!): Organization
  organizations: [Organization!]!
  
  # Project queries
  project(id: ID!): Project
  projects(orgId: ID!): [Project!]!
  
  # File queries
  file(id: ID!): File
  files(
    orgId: ID!
    projectId: ID
    sourceId: ID
    classificationStatus: ClassificationStatus
    limit: Int = 50
    offset: Int = 0
  ): [File!]!
  
  # Search queries
  searchFiles(
    orgId: ID!
    query: String!
    filters: FileSearchFilters
  ): FileSearchResults!
}

type Mutation {
  # File operations
  classifyFile(id: ID!, slot: String!): File!
  extractFileContent(id: ID!): File!
  
  # Project operations
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  
  # Sync operations
  triggerSync(sourceId: ID!): SyncResult!
  
  # Commit operations
  createCommit(input: CreateCommitInput!): Commit!
}

type Subscription {
  # Real-time file updates
  fileUpdated(orgId: ID!, projectId: ID): File!
  
  # Sync progress updates
  syncProgress(orgId: ID!, sourceId: ID!): SyncProgressUpdate!
  
  # Classification updates
  classificationCompleted(orgId: ID!): ClassificationResult!
}
```

### 4. Event-Driven Architecture

#### 4.1 Message Queue System

**Redis/BullMQ Implementation**
```typescript
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

export interface SyncJobData {
  orgId: string;
  sourceId: string;
  eventType: 'file_created' | 'file_updated' | 'file_deleted';
  resourcePath: string;
  eventData: any;
}

export class EventProcessingService {
  private redis: Redis;
  private syncQueue: Queue<SyncJobData>;
  private classificationQueue: Queue;
  private extractionQueue: Queue;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    
    this.syncQueue = new Queue('file-sync', { 
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        }
      }
    });

    this.classificationQueue = new Queue('file-classification', { 
      connection: this.redis 
    });
    
    this.extractionQueue = new Queue('content-extraction', { 
      connection: this.redis 
    });
  }

  /**
   * Process file sync events from storage providers
   */
  async processSyncEvent(jobData: SyncJobData): Promise<void> {
    await this.syncQueue.add('sync-file', jobData, {
      priority: this.getSyncPriority(jobData.eventType),
      delay: 0
    });
  }

  /**
   * Initialize workers for processing queues
   */
  initializeWorkers(): void {
    // File sync worker
    new Worker('file-sync', async (job: Job<SyncJobData>) => {
      const { orgId, sourceId, eventType, resourcePath, eventData } = job.data;
      
      try {
        await this.handleSyncEvent(orgId, sourceId, eventType, resourcePath, eventData);
        
        // Trigger classification for new/updated files
        if (eventType === 'file_created' || eventType === 'file_updated') {
          await this.classificationQueue.add('classify-file', {
            orgId,
            filePath: resourcePath,
            sourceId
          });
        }
        
      } catch (error) {
        console.error('Sync job failed:', error);
        throw error;
      }
    }, { connection: this.redis });

    // Classification worker
    new Worker('file-classification', async (job: Job) => {
      await this.classifyFile(job.data);
    }, { connection: this.redis });

    // Content extraction worker
    new Worker('content-extraction', async (job: Job) => {
      await this.extractContent(job.data);
    }, { connection: this.redis });
  }

  private getSyncPriority(eventType: string): number {
    switch (eventType) {
      case 'file_deleted': return 1; // Highest priority
      case 'file_updated': return 2;
      case 'file_created': return 3;
      default: return 5;
    }
  }

  private async handleSyncEvent(
    orgId: string, 
    sourceId: string, 
    eventType: string, 
    resourcePath: string, 
    eventData: any
  ): Promise<void> {
    // Implementation for syncing file changes to Neo4j
    // This will be detailed in the data ingestion section
  }

  private async classifyFile(data: any): Promise<void> {
    // Implementation for file classification
    // This will be detailed in the classification section
  }

  private async extractContent(data: any): Promise<void> {
    // Implementation for content extraction
    // This will be detailed in the content processing section
  }
}
```

This implementation plan provides the foundational architecture for the unified knowledge layer system. The next sections will detail the specific implementation of each ontology, data ingestion pipelines, and AI agent systems.
