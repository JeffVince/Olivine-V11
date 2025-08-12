# API Implementation
## GraphQL API with Real-Time Subscriptions and Tenant Context Enforcement

### 1. GraphQL Schema Design

#### 1.1 Core Types Implementation

**File Type Schema**
```graphql
type File {
  id: ID!
  orgId: ID!
  sourceId: ID!
  path: String!
  name: String!
  size: Int!
  mimeType: String!
  checksum: String!
  createdAt: DateTime!
  modified: DateTime!
  metadata: JSON
  current: Boolean!
  deleted: Boolean!
  content: Content
  source: Source
  versions: [Version!]!
}

input FileFilter {
  path: String
  name: String
  mimeType: String
  sourceId: ID
  modifiedAfter: DateTime
  modifiedBefore: DateTime
}

input CreateFileInput {
  orgId: ID!
  sourceId: ID!
  path: String!
  name: String!
  size: Int!
  mimeType: String!
  checksum: String!
  metadata: JSON
}

input UpdateFileInput {
  orgId: ID!
  id: ID!
  path: String
  name: String
  size: Int
  mimeType: String
  checksum: String
  metadata: JSON
}

input DeleteFileInput {
  orgId: ID!
  id: ID!
}
```

**Content Type Schema**
```graphql
type Content {
  id: ID!
  orgId: ID!
  contentKey: String!
  contentType: String!
  title: String!
  description: String
  format: String!
  status: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
  current: Boolean!
  deleted: Boolean!
  references: [File!]!
  derivedFrom: [Content!]!
  versions: [Version!]!
}

input ContentFilter {
  contentKey: String
  contentType: String
  title: String
  status: String
  createdAfter: DateTime
  createdBefore: DateTime
}

input CreateContentInput {
  orgId: ID!
  contentKey: String!
  contentType: String!
  title: String!
  description: String
  format: String!
  status: String!
  metadata: JSON
}

input UpdateContentInput {
  orgId: ID!
  id: ID!
  contentKey: String
  contentType: String
  title: String
  description: String
  format: String
  status: String
  metadata: JSON
}

input DeleteContentInput {
  orgId: ID!
  id: ID!
}
```

**Operational Types Schema**
```graphql
type Project {
  id: ID!
  orgId: ID!
  projectKey: String!
  name: String!
  description: String
  status: String!
  startDate: Date
  endDate: Date
  budget: Float
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
  current: Boolean!
  deleted: Boolean!
  tasks: [Task!]!
  participants: [Participant!]!
  versions: [Version!]!
}

type Task {
  id: ID!
  orgId: ID!
  projectId: ID!
  taskKey: String!
  title: String!
  description: String
  status: String!
  priority: String!
  assignee: String
  dueDate: Date
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
  current: Boolean!
  deleted: Boolean!
  project: Project
  dependencies: [Task!]!
  resources: [Resource!]!
  versions: [Version!]!
}

type Resource {
  id: ID!
  orgId: ID!
  resourceType: String!
  name: String!
  description: String
  cost: Float
  availability: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
  current: Boolean!
  deleted: Boolean!
  tasks: [Task!]!
  versions: [Version!]!
}

input ProjectFilter {
  projectKey: String
  name: String
  status: String
}

input TaskFilter {
  projectId: ID
  taskKey: String
  status: String
  priority: String
  assignee: String
}

input ResourceFilter {
  resourceType: String
  name: String
  availability: String
}
```

**Provenance Types Schema**
```graphql
type Commit {
  id: ID!
  orgId: ID!
  message: String!
  author: String!
  authorType: String!
  createdAt: DateTime!
  parentCommit: Commit
  branchName: String!
  signature: String!
  actions: [Action!]!
}

type Action {
  id: ID!
  commitId: ID!
  actionType: String!
  tool: String!
  entityType: String!
  entityId: ID!
  inputs: JSON
  outputs: JSON
  status: String!
  errorMessage: String
  createdAt: DateTime!
}

type Version {
  id: ID!
  orgId: ID!
  entityId: ID!
  entityType: String!
  properties: JSON!
  commit: Commit!
  createdAt: DateTime!
  contentHash: String!
}
```

#### 1.2 Queries Implementation

**Core Query Schema**
```graphql
type Query {
  # File queries
  files(filter: FileFilter, limit: Int, offset: Int): [File!]!
  file(orgId: ID!, id: ID!): File
  
  # Content queries
  content(filter: ContentFilter, limit: Int, offset: Int): [Content!]!
  contentItem(orgId: ID!, id: ID!): Content
  
  # Operational queries
  projects(filter: ProjectFilter, limit: Int, offset: Int): [Project!]!
  project(orgId: ID!, id: ID!): Project
  
  tasks(filter: TaskFilter, limit: Int, offset: Int): [Task!]!
  task(orgId: ID!, id: ID!): Task
  
  resources(filter: ResourceFilter, limit: Int, offset: Int): [Resource!]!
  resource(orgId: ID!, id: ID!): Resource
  
  # Provenance queries
  commits(orgId: ID!, branchName: String, limit: Int): [Commit!]!
  commit(orgId: ID!, id: ID!): Commit
  
  versions(orgId: ID!, entityId: ID!, limit: Int): [Version!]!
  version(orgId: ID!, id: ID!): Version
  
  # Branch queries
  branches(orgId: ID!): [Branch!]!
  branch(orgId: ID!, name: String!): Branch
}
```

#### 1.3 Mutations Implementation

**Core Mutation Schema**
```graphql
type Mutation {
  # File mutations
  createFile(input: CreateFileInput!): File!
  updateFile(input: UpdateFileInput!): File!
  deleteFile(input: DeleteFileInput!): Boolean!
  
  # Content mutations
  createContent(input: CreateContentInput!): Content!
  updateContent(input: UpdateContentInput!): Content!
  deleteContent(input: DeleteContentInput!): Boolean!
  
  # Operational mutations
  createProject(input: CreateProjectInput!): Project!
  updateProject(input: UpdateProjectInput!): Project!
  deleteProject(input: DeleteProjectInput!): Boolean!
  
  createTask(input: CreateTaskInput!): Task!
  updateTask(input: UpdateTaskInput!): Task!
  deleteTask(input: DeleteTaskInput!): Boolean!
  
  createResource(input: CreateResourceInput!): Resource!
  updateResource(input: UpdateResourceInput!): Resource!
  deleteResource(input: DeleteResourceInput!): Boolean!
  
  # Branch mutations
  createBranch(input: CreateBranchInput!): Branch!
  mergeBranch(input: MergeBranchInput!): Commit!
}
```

#### 1.4 Subscriptions Implementation

**Real-Time Subscription Schema**
```graphql
type Subscription {
  # File subscriptions
  fileCreated(orgId: ID!): File!
  fileUpdated(orgId: ID!): File!
  fileDeleted(orgId: ID!): File!
  
  # Content subscriptions
  contentCreated(orgId: ID!): Content!
  contentUpdated(orgId: ID!): Content!
  contentDeleted(orgId: ID!): Content!
  
  # Operational subscriptions
  projectCreated(orgId: ID!): Project!
  projectUpdated(orgId: ID!): Project!
  projectDeleted(orgId: ID!): Project!
  
  taskCreated(orgId: ID!): Task!
  taskUpdated(orgId: ID!): Task!
  taskDeleted(orgId: ID!): Task!
  
  resourceCreated(orgId: ID!): Resource!
  resourceUpdated(orgId: ID!): Resource!
  resourceDeleted(orgId: ID!): Resource!
  
  # Provenance subscriptions
  commitCreated(orgId: ID!): Commit!
  actionCreated(commitId: ID!): Action!
}
```

### 2. API Service Implementation

#### 2.1 GraphQL Schema Generation

**Schema Builder Service**
```typescript
import { makeExecutableSchema } from '@graphql-tools/schema';
import { gql } from 'apollo-server-express';

export class SchemaService {
  private typeDefs: string;
  private resolvers: any;

  constructor() {
    this.typeDefs = this.buildTypeDefs();
    this.resolvers = this.buildResolvers();
  }

  /**
   * Builds the complete GraphQL schema
   */
  getSchema(): GraphQLSchema {
    return makeExecutableSchema({
      typeDefs: this.typeDefs,
      resolvers: this.resolvers
    });
  }

  /**
   * Builds the GraphQL type definitions
   */
  private buildTypeDefs(): string {
    return gql`
      scalar DateTime
      scalar JSON
      
      ${this.buildFileTypeDefs()}
      ${this.buildContentTypeDefs()}
      ${this.buildOperationalTypeDefs()}
      ${this.buildProvenanceTypeDefs()}
      ${this.buildBranchTypeDefs()}
      ${this.buildQueryTypeDefs()}
      ${this.buildMutationTypeDefs()}
      ${this.buildSubscriptionTypeDefs()}
    `;
  }

  private buildFileTypeDefs(): string {
    return `
      type File {
        id: ID!
        orgId: ID!
        sourceId: ID!
        path: String!
        name: String!
        size: Int!
        mimeType: String!
        checksum: String!
        createdAt: DateTime!
        modified: DateTime!
        metadata: JSON
        current: Boolean!
        deleted: Boolean!
        content: Content
        source: Source
        versions: [Version!]!
      }
      
      input FileFilter {
        path: String
        name: String
        mimeType: String
        sourceId: ID
        modifiedAfter: DateTime
        modifiedBefore: DateTime
      }
      
      input CreateFileInput {
        orgId: ID!
        sourceId: ID!
        path: String!
        name: String!
        size: Int!
        mimeType: String!
        checksum: String!
        metadata: JSON
      }
      
      input UpdateFileInput {
        orgId: ID!
        id: ID!
        path: String
        name: String
        size: Int
        mimeType: String
        checksum: String
        metadata: JSON
      }
      
      input DeleteFileInput {
        orgId: ID!
        id: ID!
      }
    `;
  }

  private buildContentTypeDefs(): string {
    return `
      type Content {
        id: ID!
        orgId: ID!
        contentKey: String!
        contentType: String!
        title: String!
        description: String
        format: String!
        status: String!
        createdAt: DateTime!
        updatedAt: DateTime!
        metadata: JSON
        current: Boolean!
        deleted: Boolean!
        references: [File!]!
        derivedFrom: [Content!]!
        versions: [Version!]!
      }
      
      input ContentFilter {
        contentKey: String
        contentType: String
        title: String
        status: String
        createdAfter: DateTime
        createdBefore: DateTime
      }
      
      input CreateContentInput {
        orgId: ID!
        contentKey: String!
        contentType: String!
        title: String!
        description: String
        format: String!
        status: String!
        metadata: JSON
      }
      
      input UpdateContentInput {
        orgId: ID!
        id: ID!
        contentKey: String
        contentType: String
        title: String
        description: String
        format: String
        status: String
        metadata: JSON
      }
      
      input DeleteContentInput {
        orgId: ID!
        id: ID!
      }
    `;
  }

  // ... other type definition builders
}
```

#### 2.2 Query Resolvers Implementation

**Query Resolver Service**
```typescript
export class QueryResolvers {
  private neo4jService: Neo4jService;
  private tenantService: TenantService;

  constructor(neo4jService: Neo4jService, tenantService: TenantService) {
    this.neo4jService = neo4jService;
    this.tenantService = tenantService;
  }

  /**
   * Resolves file queries with tenant context enforcement
   */
  async files(parent: any, args: any, context: any): Promise<File[]> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.userId, args.filter.orgId);
    
    const { filter, limit = 100, offset = 0 } = args;
    
    let whereClause = 'WHERE f.org_id = $orgId AND f.current = true AND f.deleted = false';
    const params: any = { orgId: filter.orgId };
    
    if (filter.path) {
      whereClause += ' AND f.path CONTAINS $path';
      params.path = filter.path;
    }
    
    if (filter.name) {
      whereClause += ' AND f.name CONTAINS $name';
      params.name = filter.name;
    }
    
    if (filter.mimeType) {
      whereClause += ' AND f.mime_type = $mimeType';
      params.mimeType = filter.mimeType;
    }
    
    if (filter.sourceId) {
      whereClause += ' AND f.source_id = $sourceId';
      params.sourceId = filter.sourceId;
    }
    
    if (filter.modifiedAfter) {
      whereClause += ' AND f.modified >= datetime($modifiedAfter)';
      params.modifiedAfter = filter.modifiedAfter;
    }
    
    if (filter.modifiedBefore) {
      whereClause += ' AND f.modified <= datetime($modifiedBefore)';
      params.modifiedBefore = filter.modifiedBefore;
    }
    
    const query = `
      MATCH (f:File)
      ${whereClause}
      RETURN f
      SKIP $offset
      LIMIT $limit
    `;
    
    params.offset = offset;
    params.limit = limit;
    
    const result = await this.neo4jService.run(query, params);
    
    return result.records.map(record => {
      const file = record.get('f').properties;
      return this.mapFileNode(file);
    });
  }

  /**
   * Resolves a single file query
   */
  async file(parent: any, args: any, context: any): Promise<File> {
    const { orgId, id } = args;
    
    // Validate tenant access
    await this.tenantService.validateAccess(context.userId, orgId);
    
    const query = `
      MATCH (f:File {id: $id, org_id: $orgId, current: true, deleted: false})
      RETURN f
    `;
    
    const result = await this.neo4jService.run(query, { id, orgId });
    
    if (result.records.length === 0) {
      throw new Error(`File not found: ${id}`);
    }
    
    const file = result.records[0].get('f').properties;
    return this.mapFileNode(file);
  }

  /**
   * Resolves content queries with tenant context enforcement
   */
  async content(parent: any, args: any, context: any): Promise<Content[]> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.userId, args.filter.orgId);
    
    const { filter, limit = 100, offset = 0 } = args;
    
    let whereClause = 'WHERE c.org_id = $orgId AND c.current = true AND c.deleted = false';
    const params: any = { orgId: filter.orgId };
    
    if (filter.contentKey) {
      whereClause += ' AND c.content_key = $contentKey';
      params.contentKey = filter.contentKey;
    }
    
    if (filter.contentType) {
      whereClause += ' AND c.content_type = $contentType';
      params.contentType = filter.contentType;
    }
    
    if (filter.title) {
      whereClause += ' AND c.title CONTAINS $title';
      params.title = filter.title;
    }
    
    if (filter.status) {
      whereClause += ' AND c.status = $status';
      params.status = filter.status;
    }
    
    const query = `
      MATCH (c:Content)
      ${whereClause}
      RETURN c
      SKIP $offset
      LIMIT $limit
    `;
    
    params.offset = offset;
    params.limit = limit;
    
    const result = await this.neo4jService.run(query, params);
    
    return result.records.map(record => {
      const content = record.get('c').properties;
      return this.mapContentNode(content);
    });
  }

  /**
   * Maps Neo4j File node to GraphQL File type
   */
  private mapFileNode(file: any): File {
    return {
      id: file.id,
      orgId: file.org_id,
      sourceId: file.source_id,
      path: file.path,
      name: file.name,
      size: file.size,
      mimeType: file.mime_type,
      checksum: file.checksum,
      createdAt: file.created_at,
      modified: file.modified,
      metadata: file.metadata ? JSON.parse(file.metadata) : null,
      current: file.current,
      deleted: file.deleted
    };
  }

  /**
   * Maps Neo4j Content node to GraphQL Content type
   */
  private mapContentNode(content: any): Content {
    return {
      id: content.id,
      orgId: content.org_id,
      contentKey: content.content_key,
      contentType: content.content_type,
      title: content.title,
      description: content.description,
      format: content.format,
      status: content.status,
      createdAt: content.created_at,
      updatedAt: content.updated_at,
      metadata: content.metadata ? JSON.parse(content.metadata) : null,
      current: content.current,
      deleted: content.deleted
    };
  }
}
```

#### 2.3 Mutation Resolvers Implementation

**Mutation Resolver Service**
```typescript
export class MutationResolvers {
  private neo4jService: Neo4jService;
  private tenantService: TenantService;
  private commitService: CommitService;
  private versionService: VersionService;

  constructor(
    neo4jService: Neo4jService,
    tenantService: TenantService,
    commitService: CommitService,
    versionService: VersionService
  ) {
    this.neo4jService = neo4jService;
    this.tenantService = tenantService;
    this.commitService = commitService;
    this.versionService = versionService;
  }

  /**
   * Creates a new file with versioning and provenance
   */
  async createFile(parent: any, args: any, context: any): Promise<File> {
    const { input } = args;
    
    // Validate tenant access
    await this.tenantService.validateAccess(context.userId, input.orgId);
    
    // Create commit for this operation
    const commitId = await this.commitService.createCommit(input.orgId, {
      message: `Create file: ${input.path}`,
      author: context.userId,
      authorType: 'user'
    });
    
    // Create file node
    const fileId = uuidv4();
    const createdAt = new Date().toISOString();
    const modified = input.modified || createdAt;
    
    const query = `
      CREATE (f:File {
        id: $fileId,
        org_id: $orgId,
        source_id: $sourceId,
        path: $path,
        name: $name,
        size: $size,
        mime_type: $mimeType,
        checksum: $checksum,
        created_at: datetime($createdAt),
        modified: datetime($modified),
        metadata: $metadata,
        current: true,
        deleted: false
      })
      RETURN f
    `;
    
    const result = await this.neo4jService.run(query, {
      fileId,
      orgId: input.orgId,
      sourceId: input.sourceId,
      path: input.path,
      name: input.name,
      size: input.size,
      mimeType: input.mimeType,
      checksum: input.checksum,
      createdAt,
      modified,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null
    });
    
    // Create version record
    const versionId = await this.versionService.createEntityVersion(
      input.orgId,
      fileId,
      'File',
      result.records[0].get('f').properties,
      commitId
    );
    
    // Update file with version reference
    const updateQuery = `
      MATCH (f:File {id: $fileId})
      SET f.version_id = $versionId
      RETURN f
    `;
    
    await this.neo4jService.run(updateQuery, { fileId, versionId });
    
    // Create action record
    await this.createAction(commitId, {
      actionType: 'create_file',
      tool: 'api',
      entityType: 'File',
      entityId: fileId,
      inputs: input,
      outputs: { fileId, versionId },
      status: 'success'
    });
    
    const file = result.records[0].get('f').properties;
    return this.mapFileNode(file);
  }

  /**
   * Updates an existing file with versioning and provenance
   */
  async updateFile(parent: any, args: any, context: any): Promise<File> {
    const { input } = args;
    
    // Validate tenant access
    await this.tenantService.validateAccess(context.userId, input.orgId);
    
    // Get current file version
    const currentFile = await this.getCurrentFile(input.orgId, input.id);
    
    // Create commit for this operation
    const commitId = await this.commitService.createCommit(input.orgId, {
      message: `Update file: ${currentFile.path}`,
      author: context.userId,
      authorType: 'user'
    });
    
    // Create version record of current state
    await this.versionService.createEntityVersion(
      input.orgId,
      input.id,
      'File',
      currentFile,
      commitId
    );
    
    // Update file node
    const updateFields: string[] = [];
    const params: any = { fileId: input.id, orgId: input.orgId };
    
    if (input.path !== undefined) {
      updateFields.push('f.path = $path');
      params.path = input.path;
    }
    
    if (input.name !== undefined) {
      updateFields.push('f.name = $name');
      params.name = input.name;
    }
    
    if (input.size !== undefined) {
      updateFields.push('f.size = $size');
      params.size = input.size;
    }
    
    if (input.mimeType !== undefined) {
      updateFields.push('f.mime_type = $mimeType');
      params.mimeType = input.mimeType;
    }
    
    if (input.checksum !== undefined) {
      updateFields.push('f.checksum = $checksum');
      params.checksum = input.checksum;
    }
    
    if (input.metadata !== undefined) {
      updateFields.push('f.metadata = $metadata');
      params.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    }
    
    updateFields.push('f.modified = datetime($modified)');
    params.modified = new Date().toISOString();
    
    const query = `
      MATCH (f:File {id: $fileId, org_id: $orgId, current: true})
      SET ${updateFields.join(', ')}
      RETURN f
    `;
    
    const result = await this.neo4jService.run(query, params);
    
    // Create new version record
    const updatedFile = result.records[0].get('f').properties;
    const versionId = await this.versionService.createEntityVersion(
      input.orgId,
      input.id,
      'File',
      updatedFile,
      commitId
    );
    
    // Update file with new version reference
    const versionQuery = `
      MATCH (f:File {id: $fileId})
      SET f.version_id = $versionId
      RETURN f
    `;
    
    await this.neo4jService.run(versionQuery, { fileId: input.id, versionId });
    
    // Create action record
    await this.createAction(commitId, {
      actionType: 'update_file',
      tool: 'api',
      entityType: 'File',
      entityId: input.id,
      inputs: input,
      outputs: { fileId: input.id, versionId },
      status: 'success'
    });
    
    return this.mapFileNode(updatedFile);
  }

  /**
   * Deletes a file with versioning and provenance (soft delete)
   */
  async deleteFile(parent: any, args: any, context: any): Promise<boolean> {
    const { input } = args;
    
    // Validate tenant access
    await this.tenantService.validateAccess(context.userId, input.orgId);
    
    // Get current file
    const currentFile = await this.getCurrentFile(input.orgId, input.id);
    
    // Create commit for this operation
    const commitId = await this.commitService.createCommit(input.orgId, {
      message: `Delete file: ${currentFile.path}`,
      author: context.userId,
      authorType: 'user'
    });
    
    // Create version record before deletion
    await this.versionService.createEntityVersion(
      input.orgId,
      input.id,
      'File',
      currentFile,
      commitId
    );
    
    // Soft delete file node
    const query = `
      MATCH (f:File {id: $fileId, org_id: $orgId})
      SET f.deleted = true, f.current = false, f.end_date = datetime()
      RETURN f
    `;
    
    await this.neo4jService.run(query, { fileId: input.id, orgId: input.orgId });
    
    // End-date all relationships
    const relationshipQuery = `
      MATCH (f:File {id: $fileId})-[r]->()
      WHERE r.current = true
      SET r.current = false, r.end_date = datetime()
    `;
    
    await this.neo4jService.run(relationshipQuery, { fileId: input.id });
    
    // Create action record
    await this.createAction(commitId, {
      actionType: 'delete_file',
      tool: 'api',
      entityType: 'File',
      entityId: input.id,
      inputs: input,
      outputs: { fileId: input.id },
      status: 'success'
    });
    
    return true;
  }

  /**
   * Gets current version of a file
   */
  private async getCurrentFile(orgId: string, fileId: string): Promise<any> {
    const query = `
      MATCH (f:File {id: $fileId, org_id: $orgId, current: true})
      RETURN f
    `;
    
    const result = await this.neo4jService.run(query, { fileId, orgId });
    
    if (result.records.length === 0) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    return result.records[0].get('f').properties;
  }

  /**
   * Creates an action record for provenance tracking
   */
  private async createAction(commitId: string, actionData: any): Promise<void> {
    const query = `
      CREATE (a:Action {
        id: randomUUID(),
        commit_id: $commitId,
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
      commitId,
      actionType: actionData.actionType,
      tool: actionData.tool,
      entityType: actionData.entityType,
      entityId: actionData.entityId,
      inputs: JSON.stringify(actionData.inputs || {}),
      outputs: JSON.stringify(actionData.outputs || {}),
      status: actionData.status,
      errorMessage: actionData.errorMessage || null
    });
  }

  private mapFileNode(file: any): File {
    return {
      id: file.id,
      orgId: file.org_id,
      sourceId: file.source_id,
      path: file.path,
      name: file.name,
      size: file.size,
      mimeType: file.mime_type,
      checksum: file.checksum,
      createdAt: file.created_at,
      modified: file.modified,
      metadata: file.metadata ? JSON.parse(file.metadata) : null,
      current: file.current,
      deleted: file.deleted
    };
  }
}
```

#### 2.4 Subscription Resolvers Implementation

**Subscription Resolver Service**
```typescript
import { PubSub } from 'apollo-server-express';
import { withFilter } from 'graphql-subscriptions';

const pubsub = new PubSub();

export class SubscriptionResolvers {
  /**
   * Publishes file creation events
   */
  static async publishFileCreated(file: File): Promise<void> {
    pubsub.publish('FILE_CREATED', { fileCreated: file });
  }

  /**
   * Publishes file update events
   */
  static async publishFileUpdated(file: File): Promise<void> {
    pubsub.publish('FILE_UPDATED', { fileUpdated: file });
  }

  /**
   * Publishes file deletion events
   */
  static async publishFileDeleted(file: File): Promise<void> {
    pubsub.publish('FILE_DELETED', { fileDeleted: file });
  }

  /**
   * Resolves file creation subscriptions with tenant filtering
   */
  fileCreated: {
    subscribe: withFilter(
      () => pubsub.asyncIterator('FILE_CREATED'),
      (payload, variables) => {
        return payload.fileCreated.orgId === variables.orgId;
      }
    )
  }

  /**
   * Resolves file update subscriptions with tenant filtering
   */
  fileUpdated: {
    subscribe: withFilter(
      () => pubsub.asyncIterator('FILE_UPDATED'),
      (payload, variables) => {
        return payload.fileUpdated.orgId === variables.orgId;
      }
    )
  }

  /**
   * Resolves file deletion subscriptions with tenant filtering
   */
  fileDeleted: {
    subscribe: withFilter(
      () => pubsub.asyncIterator('FILE_DELETED'),
      (payload, variables) => {
        return payload.fileDeleted.orgId === variables.orgId;
      }
    )
  }
}
```

### 3. Tenant Context Enforcement

#### 3.1 Authentication Middleware

**Tenant Validation Service**
```typescript
export class TenantService {
  private neo4jService: Neo4jService;

  constructor(neo4jService: Neo4jService) {
    this.neo4jService = neo4jService;
  }

  /**
   * Validates that a user has access to an organization
   */
  async validateAccess(userId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(o:Organization {id: $orgId})
      RETURN count(o) > 0 as hasAccess
    `;
    
    const result = await this.neo4jService.run(query, { userId, orgId });
    const hasAccess = result.records[0].get('hasAccess');
    
    if (!hasAccess) {
      throw new Error(`User ${userId} does not have access to organization ${orgId}`);
    }
  }

  /**
   * Gets organizations accessible to a user
   */
  async getUserOrganizations(userId: string): Promise<string[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(o:Organization)
      RETURN o.id as orgId
    `;
    
    const result = await this.neo4jService.run(query, { userId });
    
    return result.records.map(record => record.get('orgId'));
  }
}
```

#### 3.2 Context Provider

**GraphQL Context Service**
```typescript
export class ContextService {
  private tenantService: TenantService;
  private userService: UserService;

  constructor(tenantService: TenantService, userService: UserService) {
    this.tenantService = tenantService;
    this.userService = userService;
  }

  /**
   * Creates GraphQL context with tenant validation
   */
  async createContext({ req }: { req: Request }): Promise<GraphQLContext> {
    // Extract user from request (assumes authentication middleware has run)
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      throw new Error('Authentication required');
    }
    
    // Validate user exists
    const userExists = await this.userService.userExists(userId);
    if (!userExists) {
      throw new Error('Invalid user');
    }
    
    // Get accessible organizations
    const orgIds = await this.tenantService.getUserOrganizations(userId);
    
    return {
      userId,
      orgIds,
      neo4jService: this.neo4jService,
      tenantService: this.tenantService
    };
  }
}
```

This implementation provides a comprehensive GraphQL API with real-time subscriptions, tenant context enforcement, and full integration with the versioning and provenance systems. The API supports querying and mutating all entity types while maintaining data integrity and security through tenant isolation.
