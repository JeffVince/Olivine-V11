# Knowledge Graph Implementation
## Neo4j Graph Database Schema & Multi-Tenant Architecture

### 1. Canonical Knowledge Model Ontologies Implementation

#### 1.1 File Ontology (Storage Truth Layer)

**Core File Node Schema**
```cypher
// File nodes represent the storage truth layer
CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT file_org_path_unique IF NOT EXISTS FOR (f:File) REQUIRE (f.org_id, f.path) IS UNIQUE;
CREATE INDEX file_org_source_index IF NOT EXISTS FOR (f:File) ON (f.org_id, f.source_id);
CREATE INDEX file_modified_index IF NOT EXISTS FOR (f:File) ON f.modified;

// File node properties
File {
  id: UUID,                    // Unique identifier for the file node
  org_id: String,              // Organization identifier for multi-tenancy
  source_id: String,           // Storage provider source identifier
  path: String,                // Full path of the file in the storage provider
  name: String,                // Filename
  size: Integer,               // File size in bytes
  mime_type: String,           // MIME type of the file
  checksum: String,            // Content hash for integrity verification
  created_at: DateTime,        // When the file node was created in the graph
  modified: DateTime,          // When the file was last modified in storage
  metadata: JSON,              // Additional provider-specific metadata
  current: Boolean = true,     // Whether this is the current version of the file
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID             // Reference to the version record
}
```

**File Relationship Schema**
```cypher
// File containment relationships
CONTAINS {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version of the relationship
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID             // Reference to the version record
}

// File versioning relationships
VERSION_OF {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime,        // When the relationship was created
  version_sequence: Integer,   // Order of versions for this entity
  commit_id: UUID             // Reference to the commit that created this version
}
```

#### 1.2 Content Ontology (Creative Reality Layer)

**Core Content Node Schema**
```cypher
// Content nodes represent creative assets in the production
CREATE CONSTRAINT content_id_unique IF NOT EXISTS FOR (c:Content) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT content_org_key_unique IF NOT EXISTS FOR (c:Content) REQUIRE (c.org_id, c.content_key) IS UNIQUE;
CREATE INDEX content_org_type_index IF NOT EXISTS FOR (c:Content) ON (c.org_id, c.content_type);
CREATE INDEX content_created_index IF NOT EXISTS FOR (c:Content) ON c.created_at;

// Content node properties
Content {
  id: UUID,                    // Unique identifier for the content node
  org_id: String,              // Organization identifier for multi-tenancy
  content_key: String,         // Canonical identifier for this content (e.g., "script-v1")
  content_type: String,        // Type of content (e.g., "script", "storyboard", "asset")
  title: String,               // Human-readable title
  description: String,         // Description of the content
  format: String,              // Format specification (e.g., "fountain", "pdf", "png")
  status: String,              // Current status (e.g., "draft", "review", "final")
  created_at: DateTime,        // When the content node was created in the graph
  updated_at: DateTime,        // When the content was last updated
  metadata: JSON,              // Additional content-specific metadata
  current: Boolean = true,     // Whether this is the current version of the content
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}
```

**Content Relationship Schema**
```cypher
// Content-to-file relationships
REFERENCES {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  reference_type: String,      // Type of reference (e.g., "source", "attachment")
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version of the relationship
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}

// Content-to-content relationships
DERIVED_FROM {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  derivation_type: String,     // Type of derivation (e.g., "adaptation", "translation")
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version of the relationship
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}

// Content versioning relationships
VERSION_OF {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime,        // When the relationship was created
  version_sequence: Integer,   // Order of versions for this entity
  commit_id: UUID             // Reference to the commit that created this version
}
```

#### 1.3 Operational Ontology (Business Layer)

**Core Operational Node Schema**
```cypher
// Project nodes
CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT project_org_key_unique IF NOT EXISTS FOR (p:Project) REQUIRE (p.org_id, p.project_key) IS UNIQUE;
CREATE INDEX project_org_status_index IF NOT EXISTS FOR (p:Project) ON (p.org_id, p.status);

Project {
  id: UUID,                    // Unique identifier for the project
  org_id: String,              // Organization identifier for multi-tenancy
  project_key: String,         // Canonical project identifier
  name: String,               // Project name
  description: String,        // Project description
  status: String,             // Project status (e.g., "active", "completed", "archived")
  start_date: Date,           // Project start date
  end_date: Date,             // Project end date
  budget: Float,              // Project budget
  created_at: DateTime,       // When the project node was created
  updated_at: DateTime,       // When the project was last updated
  metadata: JSON,             // Additional project metadata
  current: Boolean = true,    // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID           // Reference to the version record
}

// Task nodes
CREATE CONSTRAINT task_id_unique IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE;
CREATE INDEX task_org_project_index IF NOT EXISTS FOR (t:Task) ON (t.org_id, t.project_id);
CREATE INDEX task_status_index IF NOT EXISTS FOR (t:Task) ON t.status;

Task {
  id: UUID,                    // Unique identifier for the task
  org_id: String,              // Organization identifier for multi-tenancy
  project_id: UUID,           // Reference to the project this task belongs to
  task_key: String,           // Canonical task identifier
  title: String,              // Task title
  description: String,        // Task description
  status: String,             // Task status (e.g., "todo", "in_progress", "completed")
  priority: String,           // Task priority (e.g., "low", "medium", "high")
  assignee: String,           // User assigned to the task
  due_date: Date,             // Task due date
  created_at: DateTime,       // When the task node was created
  updated_at: DateTime,       // When the task was last updated
  metadata: JSON,             // Additional task metadata
  current: Boolean = true,    // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID           // Reference to the version record
}

// Resource nodes
CREATE CONSTRAINT resource_id_unique IF NOT EXISTS FOR (r:Resource) REQUIRE r.id IS UNIQUE;
CREATE INDEX resource_org_type_index IF NOT EXISTS FOR (r:Resource) ON (r.org_id, r.resource_type);

Resource {
  id: UUID,                    // Unique identifier for the resource
  org_id: String,              // Organization identifier for multi-tenancy
  resource_type: String,      // Type of resource (e.g., "person", "equipment", "location")
  name: String,               // Resource name
  description: String,        // Resource description
  cost: Float,                // Resource cost
  availability: String,       // Resource availability status
  created_at: DateTime,       // When the resource node was created
  updated_at: DateTime,       // When the resource was last updated
  metadata: JSON,             // Additional resource metadata
  current: Boolean = true,    // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID           // Reference to the version record
}
```

**Operational Relationship Schema**
```cypher
// Project relationships
PART_OF {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  role: String,               // Role in the project (e.g., "producer", "writer", "director")
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}

// Task relationships
DEPENDS_ON {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  dependency_type: String,     // Type of dependency (e.g., "blocking", "sequential")
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}

ASSIGNED_TO {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}

USES {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  usage_type: String,          // Type of usage (e.g., "primary", "backup")
  created_at: DateTime,        // When the relationship was created
  current: Boolean = true,     // Whether this is the current version
  deleted: Boolean = false,    // Soft delete flag
  version_id: UUID            // Reference to the version record
}
```

#### 1.4 Provenance Ontology (Audit Trail Layer)

**Core Provenance Node Schema**
```cypher
// Commit nodes represent atomic changes to the knowledge graph
CREATE CONSTRAINT commit_id_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE INDEX commit_org_created_index IF NOT EXISTS FOR (c:Commit) ON (c.org_id, c.created_at);

Commit {
  id: UUID,                    // Unique identifier for the commit
  org_id: String,              // Organization identifier for multi-tenancy
  message: String,            // Commit message describing the change
  author: String,             // Author of the commit (user or agent name)
  author_type: String,        // Type of author (e.g., "user", "agent")
  created_at: DateTime,       // When the commit was created
  parent_commit_id: UUID,      // Reference to the parent commit
  branch_name: String,        // Branch this commit belongs to
  signature: String           // Cryptographic signature for integrity verification
}

// Action nodes represent individual operations within a commit
CREATE CONSTRAINT action_id_unique IF NOT EXISTS FOR (a:Action) REQUIRE a.id IS UNIQUE;
CREATE INDEX action_commit_index IF NOT EXISTS FOR (a:Action) ON a.commit_id;

Action {
  id: UUID,                    // Unique identifier for the action
  commit_id: UUID,            // Reference to the commit this action belongs to
  action_type: String,        // Type of action (e.g., "create_node", "update_relationship")
  tool: String,               // Tool that performed the action (e.g., "file-steward-agent")
  entity_type: String,        // Type of entity affected (e.g., "File", "Content")
  entity_id: UUID,            // ID of the entity affected
  inputs: JSON,               // Input parameters for the action
  outputs: JSON,              // Output results from the action
  status: String,             // Action status (e.g., "success", "failed")
  error_message: String,       // Error message if action failed
  created_at: DateTime        // When the action was created
}
```

**Provenance Relationship Schema**
```cypher
// Commit relationships
PARENT_OF {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime         // When the relationship was created
}

// Action relationships
PART_OF {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime         // When the relationship was created
}

AFFECTS {
  id: UUID,                    // Unique identifier for the relationship
  org_id: String,              // Organization identifier for multi-tenancy
  created_at: DateTime         // When the relationship was created
}
```

### 2. Multi-Tenant Data Isolation Implementation

#### 2.1 Database-Level Isolation

**Tenant Context Enforcement**
```typescript
export class TenantContextService {
  /**
   * Validates that operations are performed within the correct tenant context
   */
  static validateTenantAccess(userId: string, orgId: string): boolean {
    // Check if user belongs to organization
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(o:Organization {id: $orgId})
      RETURN count(o) > 0 as hasAccess
    `;
    
    const result = await neo4jService.run(query, { userId, orgId });
    return result.records[0].get('hasAccess');
  }

  /**
   * Adds tenant context to all Neo4j queries
   */
  static addTenantContext(query: string, orgId: string): string {
    // Add org_id constraint to all MATCH and MERGE clauses
    return query.replace(
      /(MATCH|MERGE)\s*\(([^:)]+):([^)]+)\)/g,
      `$1 ($2:$3 {org_id: '${orgId}'})`
    );
  }
}
```

#### 2.2 API-Level Isolation

**GraphQL Schema with Tenant Context**
```graphql
type Query {
  # All queries automatically enforce tenant context
  files(filter: FileFilter): [File!]!
  content(filter: ContentFilter): [Content!]!
  projects(filter: ProjectFilter): [Project!]!
  tasks(filter: TaskFilter): [Task!]!
  resources(filter: ResourceFilter): [Resource!]!
  
  # Explicit tenant context in mutations
  createFile(input: CreateFileInput!): File!
  updateFile(input: UpdateFileInput!): File!
  deleteFile(input: DeleteFileInput!): Boolean!
  
  createContent(input: CreateContentInput!): Content!
  updateContent(input: UpdateContentInput!): Content!
  deleteContent(input: DeleteContentInput!): Boolean!
}

# All mutations require explicit org_id
input CreateFileInput {
  org_id: ID!                 # Required for tenant isolation
  source_id: ID!
  path: String!
  name: String!
  size: Int!
  mime_type: String!
  checksum: String!
  metadata: JSON
}

input UpdateFileInput {
  org_id: ID!                 # Required for tenant isolation
  id: ID!
  path: String
  name: String
  size: Int
  mime_type: String
  checksum: String
  metadata: JSON
}
```

### 3. Schema Migration Framework

#### 3.1 Neo4j Schema Versioning

**Migration Management System**
```typescript
export class SchemaMigrationService {
  private neo4jService: Neo4jService;
  private migrationHistory: MigrationHistory[];

  constructor(neo4jService: Neo4jService) {
    this.neo4jService = neo4jService;
    this.migrationHistory = [];
  }

  /**
   * Applies schema migrations to the Neo4j database
   */
  async applyMigrations(orgId: string, targetVersion?: string): Promise<void> {
    // Get current schema version for organization
    const currentVersion = await this.getCurrentSchemaVersion(orgId);
    
    // Get all pending migrations
    const pendingMigrations = await this.getPendingMigrations(currentVersion, targetVersion);
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(orgId, migration);
    }
  }

  /**
   * Gets the current schema version for an organization
   */
  private async getCurrentSchemaVersion(orgId: string): Promise<string> {
    const query = `
      MATCH (s:SchemaVersion {org_id: $orgId})
      RETURN s.version as version
      ORDER BY s.applied_at DESC
      LIMIT 1
    `;
    
    const result = await this.neo4jService.run(query, { orgId });
    return result.records.length > 0 ? result.records[0].get('version') : '0.0.0';
  }

  /**
   * Gets pending migrations that need to be applied
   */
  private async getPendingMigrations(currentVersion: string, targetVersion?: string): Promise<Migration[]> {
    const migrations = await this.loadMigrationFiles();
    const currentVersionIndex = migrations.findIndex(m => m.version === currentVersion);
    
    let endIndex = migrations.length;
    if (targetVersion) {
      endIndex = migrations.findIndex(m => m.version === targetVersion) + 1;
    }
    
    return migrations.slice(currentVersionIndex + 1, endIndex);
  }

  /**
   * Applies a single migration to an organization
   */
  private async applyMigration(orgId: string, migration: Migration): Promise<void> {
    const session = this.neo4jService.getSession();
    
    try {
      await session.beginTransaction();
      
      // Apply migration steps
      for (const step of migration.steps) {
        await this.executeMigrationStep(step, orgId);
      }
      
      // Record migration in history
      await this.recordMigration(orgId, migration);
      
      await session.commitTransaction();
      
    } catch (error) {
      await session.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Executes a single migration step
   */
  private async executeMigrationStep(step: MigrationStep, orgId: string): Promise<void> {
    switch (step.type) {
      case 'constraint':
        await this.applyConstraint(step.query, orgId);
        break;
      case 'index':
        await this.applyIndex(step.query, orgId);
        break;
      case 'data_migration':
        await this.applyDataMigration(step.query, orgId);
        break;
      default:
        throw new Error(`Unknown migration step type: ${step.type}`);
    }
  }

  /**
   * Applies a constraint with tenant context
   */
  private async applyConstraint(query: string, orgId: string): Promise<void> {
    const tenantQuery = query.replace(/\$orgId/g, `'${orgId}'`);
    await this.neo4jService.run(tenantQuery);
  }

  /**
   * Applies an index with tenant context
   */
  private async applyIndex(query: string, orgId: string): Promise<void> {
    const tenantQuery = query.replace(/\$orgId/g, `'${orgId}'`);
    await this.neo4jService.run(tenantQuery);
  }

  /**
   * Applies a data migration with tenant context
   */
  private async applyDataMigration(query: string, orgId: string): Promise<void> {
    const tenantQuery = query.replace(/\$orgId/g, `'${orgId}'`);
    await this.neo4jService.run(tenantQuery);
  }

  /**
   * Records a migration in the schema version history
   */
  private async recordMigration(orgId: string, migration: Migration): Promise<void> {
    const query = `
      CREATE (s:SchemaVersion {
        org_id: $orgId,
        version: $version,
        description: $description,
        applied_at: datetime()
      })
    `;
    
    await this.neo4jService.run(query, {
      orgId,
      version: migration.version,
      description: migration.description
    });
  }

  /**
   * Loads migration files from the filesystem
   */
  private async loadMigrationFiles(): Promise<Migration[]> {
    const migrationDir = path.join(__dirname, 'migrations');
    const files = await fs.promises.readdir(migrationDir);
    
    const migrations: Migration[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.promises.readFile(path.join(migrationDir, file), 'utf8');
        migrations.push(JSON.parse(content));
      }
    }
    
    // Sort migrations by version
    return migrations.sort((a, b) => {
      const aParts = a.version.split('.').map(Number);
      const bParts = b.version.split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart !== bPart) {
          return aPart - bPart;
        }
      }
      
      return 0;
    });
  }
}
```

This implementation provides a comprehensive knowledge graph schema with all four ontologies (File, Content, Operational, Provenance) properly defined. It includes multi-tenant data isolation at both the database and API levels, and a robust schema migration framework to handle versioning of the graph schema.
