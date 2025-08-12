# Versioning & Branching Implementation
## Immutable Versioning System with Commit-Based Provenance

### 1. Versioning Architecture Overview

#### 1.1 Core Principles

**Immutable Versions**
- Every change to any entity creates a new version rather than modifying existing data
- Previous versions are preserved indefinitely with full history
- Version identifiers are UUIDs ensuring global uniqueness
- Content hashes are used to detect duplicate versions and optimize storage

**Commit-Based Provenance**
- All changes are grouped into atomic commits
- Each commit contains multiple actions that represent individual operations
- Commits form an immutable chain with cryptographic signatures
- Branching is implemented through commit ancestry relationships

**Temporal Validity**
- Entities and relationships have validity periods defined by start and end dates
- Current versions are marked with a `current: true` property
- Historical queries can retrieve entities as they existed at specific points in time
- Soft deletion maintains historical integrity while marking entities as inactive

### 2. Commit System Implementation

#### 2.1 Commit Data Structure

**Commit Node Schema**
```cypher
CREATE CONSTRAINT commit_id_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE INDEX commit_org_branch_index IF NOT EXISTS FOR (c:Commit) ON (c.org_id, c.branch_name);
CREATE INDEX commit_created_at_index IF NOT EXISTS FOR (c:Commit) ON c.created_at;

Commit {
  id: UUID,                    // Unique identifier for the commit
  org_id: String,              // Organization identifier for multi-tenancy
  message: String,            // Commit message describing the change
  author: String,             // Author of the commit (user or agent name)
  author_type: String,        // Type of author (e.g., "user", "agent")
  created_at: DateTime,       // When the commit was created
  parent_commit_id: UUID,      // Reference to the parent commit
  branch_name: String,        // Branch this commit belongs to
  signature: String,          // Cryptographic signature for integrity verification
  metadata: JSON              // Additional commit metadata
}
```

#### 2.2 Commit Service Implementation

**Commit Management System**
```typescript
export class CommitService {
  private neo4jService: Neo4jService;
  private cryptoService: CryptoService;

  constructor(neo4jService: Neo4jService, cryptoService: CryptoService) {
    this.neo4jService = neo4jService;
    this.cryptoService = cryptoService;
  }

  /**
   * Creates a new commit with cryptographic signature
   */
  async createCommit(orgId: string, commitData: CommitInput): Promise<string> {
    const commitId = uuidv4();
    const createdAt = new Date().toISOString();
    
    // Create commit content for signing
    const commitContent = {
      id: commitId,
      orgId,
      message: commitData.message,
      author: commitData.author,
      authorType: commitData.authorType,
      createdAt,
      parentCommitId: commitData.parentCommitId,
      branchName: commitData.branchName
    };
    
    // Generate cryptographic signature
    const signature = this.cryptoService.sign(JSON.stringify(commitContent));
    
    // Store commit in Neo4j
    const query = `
      CREATE (c:Commit {
        id: $commitId,
        org_id: $orgId,
        message: $message,
        author: $author,
        author_type: $authorType,
        created_at: datetime($createdAt),
        parent_commit_id: $parentCommitId,
        branch_name: $branchName,
        signature: $signature
      })
      RETURN c.id as commitId
    `;
    
    const result = await this.neo4jService.run(query, {
      commitId,
      orgId,
      message: commitData.message,
      author: commitData.author,
      authorType: commitData.authorType,
      createdAt,
      parentCommitId: commitData.parentCommitId || null,
      branchName: commitData.branchName || 'main',
      signature
    });
    
    return result.records[0].get('commitId');
  }

  /**
   * Retrieves commit history for a branch
   */
  async getCommitHistory(orgId: string, branchName: string, limit: number = 50): Promise<Commit[]> {
    const query = `
      MATCH (c:Commit {org_id: $orgId, branch_name: $branchName})
      RETURN c
      ORDER BY c.created_at DESC
      LIMIT $limit
    `;
    
    const result = await this.neo4jService.run(query, { orgId, branchName, limit });
    
    return result.records.map(record => {
      const commit = record.get('c').properties;
      return {
        id: commit.id,
        orgId: commit.org_id,
        message: commit.message,
        author: commit.author,
        authorType: commit.author_type,
        createdAt: commit.created_at,
        parentCommitId: commit.parent_commit_id,
        branchName: commit.branch_name,
        signature: commit.signature
      };
    });
  }

  /**
   * Validates commit integrity using cryptographic signature
   */
  async validateCommit(commitId: string): Promise<boolean> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      RETURN c
    `;
    
    const result = await this.neo4jService.run(query, { commitId });
    
    if (result.records.length === 0) {
      throw new Error(`Commit not found: ${commitId}`);
    }
    
    const commit = result.records[0].get('c').properties;
    
    // Recreate commit content for verification
    const commitContent = {
      id: commit.id,
      orgId: commit.org_id,
      message: commit.message,
      author: commit.author,
      authorType: commit.author_type,
      createdAt: commit.created_at,
      parentCommitId: commit.parent_commit_id,
      branchName: commit.branch_name
    };
    
    return this.cryptoService.verify(JSON.stringify(commitContent), commit.signature);
  }
}
```

### 3. Entity Versioning Implementation

#### 3.1 Version Data Structure

**Version Node Schema**
```cypher
CREATE CONSTRAINT version_id_unique IF NOT EXISTS FOR (v:Version) REQUIRE v.id IS UNIQUE;
CREATE INDEX version_entity_index IF NOT EXISTS FOR (v:Version) ON (v.org_id, v.entity_id);
CREATE INDEX version_created_at_index IF NOT EXISTS FOR (v:Version) ON v.created_at;

Version {
  id: UUID,                    // Unique identifier for the version
  org_id: String,              // Organization identifier for multi-tenancy
  entity_id: UUID,            // Reference to the entity this version belongs to
  entity_type: String,        // Type of entity (e.g., "File", "Content", "Project")
  properties: JSON,           // Serialized entity properties at time of versioning
  commit_id: UUID,            // Reference to the commit that created this version
  created_at: DateTime,       // When the version was created
  content_hash: String,       // Hash of the entity properties for deduplication
  metadata: JSON             // Additional version metadata
}
```

#### 3.2 Version Management Service

**Entity Versioning System**
```typescript
export class VersionService {
  private neo4jService: Neo4jService;
  private cryptoService: CryptoService;

  constructor(neo4jService: Neo4jService, cryptoService: CryptoService) {
    this.neo4jService = neo4jService;
    this.cryptoService = cryptoService;
  }

  /**
   * Creates a version record for an entity
   */
  async createEntityVersion(
    orgId: string,
    entityId: string,
    entityType: string,
    properties: any,
    commitId: string
  ): Promise<string> {
    const versionId = uuidv4();
    const createdAt = new Date().toISOString();
    
    // Create content hash for deduplication
    const contentHash = this.cryptoService.hash(JSON.stringify(properties));
    
    // Check if version with same content already exists
    const existingVersionId = await this.getExistingVersion(orgId, entityId, contentHash);
    
    if (existingVersionId) {
      // Return existing version instead of creating duplicate
      return existingVersionId;
    }
    
    // Store version in Neo4j
    const query = `
      CREATE (v:Version {
        id: $versionId,
        org_id: $orgId,
        entity_id: $entityId,
        entity_type: $entityType,
        properties: $properties,
        commit_id: $commitId,
        created_at: datetime($createdAt),
        content_hash: $contentHash
      })
      RETURN v.id as versionId
    `;
    
    const result = await this.neo4jService.run(query, {
      versionId,
      orgId,
      entityId,
      entityType,
      properties: JSON.stringify(properties),
      commitId,
      createdAt,
      contentHash
    });
    
    return result.records[0].get('versionId');
  }

  /**
   * Checks if a version with the same content already exists
   */
  private async getExistingVersion(orgId: string, entityId: string, contentHash: string): Promise<string | null> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId, content_hash: $contentHash})
      RETURN v.id as versionId
      LIMIT 1
    `;
    
    const result = await this.neo4jService.run(query, { orgId, entityId, contentHash });
    
    return result.records.length > 0 ? result.records[0].get('versionId') : null;
  }

  /**
   * Retrieves version history for an entity
   */
  async getEntityVersionHistory(orgId: string, entityId: string): Promise<Version[]> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId})
      RETURN v
      ORDER BY v.created_at DESC
    `;
    
    const result = await this.neo4jService.run(query, { orgId, entityId });
    
    return result.records.map(record => {
      const version = record.get('v').properties;
      return {
        id: version.id,
        orgId: version.org_id,
        entityId: version.entity_id,
        entityType: version.entity_type,
        properties: JSON.parse(version.properties),
        commitId: version.commit_id,
        createdAt: version.created_at,
        contentHash: version.content_hash
      };
    });
  }

  /**
   * Retrieves entity state at specific commit
   */
  async getEntityAtCommit(orgId: string, entityId: string, commitId: string): Promise<any> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId})
      WHERE v.commit_id = $commitId OR v.created_at <= datetime($commitTimestamp)
      RETURN v
      ORDER BY v.created_at DESC
      LIMIT 1
    `;
    
    // Get commit timestamp
    const commitTimestamp = await this.getCommitTimestamp(commitId);
    
    const result = await this.neo4jService.run(query, {
      orgId,
      entityId,
      commitId,
      commitTimestamp
    });
    
    if (result.records.length === 0) {
      throw new Error(`Version not found for entity ${entityId} at commit ${commitId}`);
    }
    
    const version = result.records[0].get('v').properties;
    return JSON.parse(version.properties);
  }

  /**
   * Gets timestamp for a specific commit
   */
  private async getCommitTimestamp(commitId: string): Promise<string> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      RETURN c.created_at as createdAt
    `;
    
    const result = await this.neo4jService.run(query, { commitId });
    
    if (result.records.length === 0) {
      throw new Error(`Commit not found: ${commitId}`);
    }
    
    return result.records[0].get('createdAt');
  }
}
```

### 4. Branching Implementation

#### 4.1 Branch Data Structure

**Branch Node Schema**
```cypher
CREATE CONSTRAINT branch_id_unique IF NOT EXISTS FOR (b:Branch) REQUIRE (b.org_id, b.name) IS UNIQUE;
CREATE INDEX branch_org_active_index IF NOT EXISTS FOR (b:Branch) ON (b.org_id, b.active);

Branch {
  id: UUID,                    // Unique identifier for the branch
  org_id: String,              // Organization identifier for multi-tenancy
  name: String,               // Branch name (e.g., "main", "feature/script-refactor")
  description: String,        // Human-readable description of the branch
  created_at: DateTime,       // When the branch was created
  created_by: String,         // User or agent that created the branch
  active: Boolean = true,     // Whether the branch is currently active
  base_commit_id: UUID,       // Commit this branch was created from
  metadata: JSON             // Additional branch metadata
}
```

#### 4.2 Branch Management Service

**Branching System**
```typescript
export class BranchService {
  private neo4jService: Neo4jService;
  private commitService: CommitService;

  constructor(neo4jService: Neo4jService, commitService: CommitService) {
    this.neo4jService = neo4jService;
    this.commitService = commitService;
  }

  /**
   * Creates a new branch from a base commit
   */
  async createBranch(orgId: string, branchData: BranchInput): Promise<string> {
    const branchId = uuidv4();
    const createdAt = new Date().toISOString();
    
    // Validate base commit exists
    if (branchData.baseCommitId) {
      const baseCommitExists = await this.commitExists(orgId, branchData.baseCommitId);
      if (!baseCommitExists) {
        throw new Error(`Base commit not found: ${branchData.baseCommitId}`);
      }
    }
    
    // Store branch in Neo4j
    const query = `
      CREATE (b:Branch {
        id: $branchId,
        org_id: $orgId,
        name: $name,
        description: $description,
        created_at: datetime($createdAt),
        created_by: $createdBy,
        active: true,
        base_commit_id: $baseCommitId
      })
      RETURN b.id as branchId
    `;
    
    const result = await this.neo4jService.run(query, {
      branchId,
      orgId,
      name: branchData.name,
      description: branchData.description || '',
      createdAt,
      createdBy: branchData.createdBy,
      baseCommitId: branchData.baseCommitId || null
    });
    
    return result.records[0].get('branchId');
  }

  /**
   * Checks if a commit exists
   */
  private async commitExists(orgId: string, commitId: string): Promise<boolean> {
    const query = `
      MATCH (c:Commit {id: $commitId, org_id: $orgId})
      RETURN count(c) > 0 as exists
    `;
    
    const result = await this.neo4jService.run(query, { orgId, commitId });
    return result.records[0].get('exists');
  }

  /**
   * Lists all branches for an organization
   */
  async listBranches(orgId: string): Promise<Branch[]> {
    const query = `
      MATCH (b:Branch {org_id: $orgId})
      RETURN b
      ORDER BY b.created_at DESC
    `;
    
    const result = await this.neo4jService.run(query, { orgId });
    
    return result.records.map(record => {
      const branch = record.get('b').properties;
      return {
        id: branch.id,
        orgId: branch.org_id,
        name: branch.name,
        description: branch.description,
        createdAt: branch.created_at,
        createdBy: branch.created_by,
        active: branch.active,
        baseCommitId: branch.base_commit_id
      };
    });
  }

  /**
   * Merges a branch into another branch
   */
  async mergeBranch(
    orgId: string,
    sourceBranch: string,
    targetBranch: string,
    mergeMessage: string,
    author: string
  ): Promise<string> {
    // Get latest commit from source branch
    const sourceCommit = await this.getLatestCommit(orgId, sourceBranch);
    
    // Create merge commit in target branch
    const mergeCommitId = await this.commitService.createCommit(orgId, {
      message: mergeMessage,
      author,
      authorType: 'user',
      parentCommitId: await this.getLatestCommitId(orgId, targetBranch),
      branchName: targetBranch
    });
    
    // Apply changes from source branch to target branch
    await this.applyBranchChanges(orgId, sourceCommit.id, targetBranch, mergeCommitId);
    
    return mergeCommitId;
  }

  /**
   * Gets the latest commit for a branch
   */
  private async getLatestCommit(orgId: string, branchName: string): Promise<Commit> {
    const query = `
      MATCH (c:Commit {org_id: $orgId, branch_name: $branchName})
      RETURN c
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    
    const result = await this.neo4jService.run(query, { orgId, branchName });
    
    if (result.records.length === 0) {
      throw new Error(`No commits found for branch: ${branchName}`);
    }
    
    const commit = result.records[0].get('c').properties;
    return {
      id: commit.id,
      orgId: commit.org_id,
      message: commit.message,
      author: commit.author,
      authorType: commit.author_type,
      createdAt: commit.created_at,
      parentCommitId: commit.parent_commit_id,
      branchName: commit.branch_name,
      signature: commit.signature
    };
  }

  /**
   * Gets the latest commit ID for a branch
   */
  private async getLatestCommitId(orgId: string, branchName: string): Promise<string> {
    const commit = await this.getLatestCommit(orgId, branchName);
    return commit.id;
  }

  /**
   * Applies changes from a commit to a branch
   */
  private async applyBranchChanges(
    orgId: string,
    sourceCommitId: string,
    targetBranch: string,
    mergeCommitId: string
  ): Promise<void> {
    // Get all actions from source commit
    const actions = await this.getCommitActions(sourceCommitId);
    
    // Apply each action to target branch with new commit ID
    for (const action of actions) {
      await this.applyActionToBranch(orgId, action, targetBranch, mergeCommitId);
    }
  }

  /**
   * Gets all actions associated with a commit
   */
  private async getCommitActions(commitId: string): Promise<Action[]> {
    const query = `
      MATCH (a:Action {commit_id: $commitId})
      RETURN a
    `;
    
    const result = await this.neo4jService.run(query, { commitId });
    
    return result.records.map(record => {
      const action = record.get('a').properties;
      return {
        id: action.id,
        commitId: action.commit_id,
        actionType: action.action_type,
        tool: action.tool,
        entityType: action.entity_type,
        entityId: action.entity_id,
        inputs: JSON.parse(action.inputs),
        outputs: JSON.parse(action.outputs),
        status: action.status,
        errorMessage: action.error_message,
        createdAt: action.created_at
      };
    });
  }

  /**
   * Applies an action to a branch
   */
  private async applyActionToBranch(
    orgId: string,
    action: Action,
    targetBranch: string,
    mergeCommitId: string
  ): Promise<void> {
    // Create new action with merge commit ID
    const query = `
      CREATE (a:Action {
        id: randomUUID(),
        commit_id: $mergeCommitId,
        action_type: $actionType,
        tool: $tool,
        entity_type: $entityType,
        entity_id: $entityId,
        inputs: $inputs,
        outputs: $outputs,
        status: $status,
        error_message: $errorMessage,
        created_at: datetime()
      })
    `;
    
    await this.neo4jService.run(query, {
      mergeCommitId,
      actionType: action.actionType,
      tool: action.tool,
      entityType: action.entityType,
      entityId: action.entityId,
      inputs: JSON.stringify(action.inputs),
      outputs: JSON.stringify(action.outputs),
      status: action.status,
      errorMessage: action.errorMessage || null
    });
  }
}
```

### 5. Temporal Validity Implementation

#### 5.1 Validity Period Management

**Temporal Validity System**
```typescript
export class TemporalValidityService {
  private neo4jService: Neo4jService;

  constructor(neo4jService: Neo4jService) {
    this.neo4jService = neo4jService;
  }

  /**
   * Marks an entity as current and ends previous versions
   */
  async markEntityAsCurrent(
    orgId: string,
    entityId: string,
    entityType: string,
    commitId: string
  ): Promise<void> {
    // End-date all previous versions of this entity
    const endDateQuery = `
      MATCH (e:${entityType} {id: $entityId, org_id: $orgId, current: true})
      SET e.current = false, e.end_date = datetime()
      RETURN e
    `;
    
    await this.neo4jService.run(endDateQuery, { entityId, orgId });
    
    // Mark new version as current
    const markCurrentQuery = `
      MATCH (e:${entityType} {id: $entityId, org_id: $orgId})
      WHERE e.version_id IN [
        MATCH (v:Version {entity_id: $entityId, commit_id: $commitId})
        RETURN v.id
      ]
      SET e.current = true
      RETURN e
    `;
    
    await this.neo4jService.run(markCurrentQuery, { entityId, orgId, commitId });
  }

  /**
   * Soft deletes an entity while preserving history
   */
  async softDeleteEntity(
    orgId: string,
    entityId: string,
    entityType: string,
    commitId: string
  ): Promise<void> {
    // Mark entity as deleted
    const deleteQuery = `
      MATCH (e:${entityType} {id: $entityId, org_id: $orgId})
      SET e.deleted = true, e.current = false, e.end_date = datetime()
      RETURN e
    `;
    
    await this.neo4jService.run(deleteQuery, { entityId, orgId });
    
    // End-date all relationships involving this entity
    const endDateRelationshipsQuery = `
      MATCH (e:${entityType} {id: $entityId, org_id: $orgId})-[r]->()
      WHERE r.current = true
      SET r.current = false, r.end_date = datetime()
      RETURN r
    `;
    
    await this.neo4jService.run(endDateRelationshipsQuery, { entityId, orgId });
  }

  /**
   * Retrieves entity state at a specific point in time
   */
  async getEntityAtTime(
    orgId: string,
    entityId: string,
    entityType: string,
    timestamp: string
  ): Promise<any> {
    const query = `
      MATCH (e:${entityType} {id: $entityId, org_id: $orgId})
      WHERE e.start_date <= datetime($timestamp) 
      AND (e.end_date IS NULL OR e.end_date > datetime($timestamp))
      AND e.deleted = false
      RETURN e
    `;
    
    const result = await this.neo4jService.run(query, { entityId, orgId, timestamp });
    
    if (result.records.length === 0) {
      throw new Error(`Entity not found or was deleted at timestamp: ${timestamp}`);
    }
    
    return result.records[0].get('e').properties;
  }
}
```

This implementation provides a comprehensive versioning and branching system with immutable commits, entity versioning, branch management, and temporal validity. The system ensures full audit trails and enables safe data evolution through atomic commits and proper version tracking.
