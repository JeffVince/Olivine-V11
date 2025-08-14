# Olivine Backend Services Documentation

This document provides comprehensive documentation for the Olivine backend database services, including API interfaces, schema diagrams, migration guides, troubleshooting tips, and performance baselines.

## Table of Contents
1. [API Documentation](#api-documentation)
2. [Schema Documentation](#schema-documentation)
3. [Migration Guide](#migration-guide)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Performance Baselines](#performance-baselines)

## API Documentation

### Neo4jService

The Neo4jService provides a centralized interface for interacting with the Neo4j graph database.

**Methods:**

- `executeQuery(cypher: string, params: any = {})`: Execute a Cypher query with optional parameters
- `executeBatch(queries: Array<{ cypher: string; params: any }>)`: Execute multiple queries in a batch
- `executeTransaction(queries: Array<{ cypher: string; params: any }>)`: Execute multiple queries within a transaction
- `healthCheck()`: Verify database connectivity
- `close()`: Close database connections

**Example Usage:**
```typescript
const neo4jService = new Neo4jService();
const result = await neo4jService.executeQuery(
  'MATCH (f:File {org_id: $orgId}) RETURN f.path, f.name',
  { orgId: '123e4567-e89b-12d3-a456-426614174000' }
);
```

### PostgresService

The PostgresService provides a centralized interface for interacting with the PostgreSQL relational database.

**Methods:**
- `executeQuery(sql: string, params: any[] = [])`: Execute a SQL query with optional parameters
- `executeBatch(queries: Array<{ sql: string; params: any[] }>)`: Execute multiple queries in a batch
- `executeTransaction(queries: Array<{ sql: string; params: any[] }>)`: Execute multiple queries within a transaction
- `healthCheck()`: Verify database connectivity
- `close()`: Close database connections

**Example Usage:**
```typescript
const postgresService = new PostgresService();
const result = await postgresService.executeQuery(
  'SELECT * FROM files WHERE orgId = $1',
  ['123e4567-e89b-12d3-a456-426614174000']
);
```

### TenantService

The TenantService provides multi-tenant filtering capabilities for database queries.

**Methods:**
- `validateOrgId(orgId: string)`: Validate that an organization ID is present
- `addOrgId(params: any, orgId: string)`: Add organization ID to query parameters
- `createFileQuery(query: string)`: Create a tenant-filtered File query template
- `createContentQuery(query: string)`: Create a tenant-filtered Content query template
- `createProvenanceQuery(query: string)`: Create a tenant-filtered Provenance query template
- `createOpsQuery(query: string)`: Create a tenant-filtered Ops query template
- `executeTenantQuery(cypher: string, params: any)`: Execute a tenant-scoped Neo4j query

**Example Usage:**
```typescript
const tenantService = new TenantService();
const query = tenantService.createFileQuery('MATCH (f:File) WHERE f.path = $path RETURN f');
const result = await tenantService.executeTenantQuery(query, { 
  orgId: '123e4567-e89b-12d3-a456-426614174000',
  path: '/documents/contract.pdf'
});
```

### QueueService

The QueueService provides Redis-based background job processing capabilities.

**Methods:**
- `enqueueJob(queueName: string, jobData: any)`: Add a job to the specified queue
- `processJobs(queueName: string, handler: Function)`: Process jobs from the specified queue
- `getJobStatus(jobId: string)`: Get the status of a specific job
- `updateJobStatus(jobId: string, status: string, result?: any)`: Update job status
- `healthCheck()`: Verify Redis connectivity
- `close()`: Close Redis connections

**Example Usage:**
```typescript
const queueService = new QueueService();
const jobId = await queueService.enqueueJob('file-processing', {
  fileId: '123e4567-e89b-12d3-a456-426614174000',
  action: 'classify'
});

queueService.processJobs('file-processing', async (jobData) => {
  // Process the job
  console.log('Processing job:', jobData);
});
```

### AuthService

The AuthService provides JWT-based user authentication and password hashing capabilities.

**Methods:**
- `hashPassword(password: string)`: Hash a password using bcrypt
- `comparePasswords(password: string, hash: string)`: Compare a password with its hash
- `generateToken(userId: string, orgId: string, role: string)`: Generate a JWT token
- `verifyToken(token: string)`: Verify a JWT token
- `authenticateUser(email: string, password: string)`: Authenticate a user with email and password
- `healthCheck()`: Verify authentication service health
- `close()`: Close database connections

**Example Usage:**
```typescript
const authService = new AuthService();
const hashedPassword = await authService.hashPassword('userPassword');
const token = authService.generateToken(
  '123e4567-e89b-12d3-a456-426614174000',
  '456e7890-e89b-12d3-a456-426614174000',
  'member'
);
```

### ConfigService

The ConfigService provides centralized application configuration management.

**Methods:**
- `getDatabaseConfig()`: Get all database configurations
- `getNeo4jConfig()`: Get Neo4j configuration
- `getPostgresConfig()`: Get PostgreSQL configuration
- `getRedisConfig()`: Get Redis configuration
- `getAuthConfig()`: Get authentication configuration
- `getJwtConfig()`: Get JWT configuration
- `getAppConfig()`: Get application configuration
- `validateConfig()`: Validate configuration
- `loadSecretFromFile(secretPath: string)`: Load secrets from files
- `healthCheck()`: Verify configuration service health

## Schema Documentation

### Neo4j Graph Schema

The Olivine knowledge graph consists of four core ontologies:

1. **File Ontology** - Represents storage truth with file metadata
2. **Content Ontology** - Represents creative reality with content classification
3. **Provenance Ontology** - Represents audit trail with commit history
4. **Ops Ontology** - Represents business layer with operational data

**Core Node Types:**
- `File`: Storage truth nodes with path, name, extension, mime_type, size, timestamps
- `Content`: Creative reality nodes with classification, confidence, timestamps
- `Commit`: Audit trail nodes with author, timestamp, message
- `Version`: Branch/version nodes with branch_name, commit_hash, timestamps
- `Tag`: Metadata tagging nodes with key, value, timestamps
- `User`: User identity nodes with email, role, timestamps

**Relationships:**
- `BELONGS_TO`: File → Content (file belongs to content)
- `VERSION`: File → Version (file is part of a version)
- `AUTHORED`: Content → User (content authored by user)
- `LINKED`: Content → Content (content linked to other content)
- `TAGGED`: File/Content → Tag (entities tagged with metadata)

**Constraints:**
- `file_id_unique`: File nodes have unique IDs
- `content_id_unique`: Content nodes have unique IDs
- `commit_id_unique`: Commit nodes have unique IDs
- `version_id_unique`: Version nodes have unique IDs
- `file_org_path`: File nodes have unique path per organization

**Indexes:**
- All node types have indexes on `org_id` for multi-tenant filtering
- Content nodes have indexes on `classification` and `confidence`
- File nodes have indexes on `path`, `type`, and `modified_at`
- Commit nodes have indexes on `author` and `timestamp`

### PostgreSQL Relational Schema

**Core Tables:**
1. `organizations` - Organization entities with ID, name, slug
2. `users` - User entities with ID, email, password_hash, orgId, role
3. `sources` - Source entities with ID, orgId, name, type, config
4. `files` - File entities with ID, orgId, source_id, path, name, extension, mime_type, size, timestamps

**Row Level Security (RLS) Policies:**
All tables have RLS enabled with policies that filter data by `orgId`:
- Users can only access data from their own organization
- Files can only be accessed by users from the same organization
- Sources can only be accessed by users from the same organization

## Migration Guide

### Adding Neo4j Migrations

1. Create a new Cypher file in `backend/src/migrations/neo4j/` with the next sequential number:
   - Example: `004_new_constraints.cypher`
2. Add your schema changes to the file:
   ```cypher
   CREATE CONSTRAINT new_constraint FOR (n:NodeType) REQUIRE n.property IS UNIQUE
   ```
3. Run migrations with `npm run migrate`

### Provided PostgreSQL SQL (Manual Execution)

For the agent system features (Runbooks and Taxonomy Rules), the following SQL files are provided for manual execution in your Supabase SQL editor (do not run via CLI here):

- `src/migrations/postgres/2025-08-12_01_create_runbooks.sql`
- `src/migrations/postgres/2025-08-12_02_create_taxonomy_rules.sql`

Execute these to create `runbooks` and `taxonomy_rules` tables used by the frontend and agents.

### Adding PostgreSQL Migrations

1. Create a new SQL file in `backend/src/migrations/postgres/` with the next sequential number:
   - Example: `004_new_table.sql`
2. Add your schema changes to the file:
   ```sql
   CREATE TABLE new_table (
     id UUID PRIMARY KEY,
     orgId UUID NOT NULL REFERENCES organizations(id),
     name VARCHAR(255) NOT NULL
   );
   
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY new_table_org_isolation 
   ON new_table 
   FOR ALL 
   USING (orgId = current_setting('app.orgId')::UUID);
   ```
3. Run migrations with `npm run migrate`

## Troubleshooting Guide

### Common Neo4j Issues

1. **Connection Errors**
   - Check `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` environment variables
   - Verify Neo4j container is running: `docker-compose ps`
   - Test connection with schema validation script: `npm run validate:schemas`

2. **Constraint Violations**
   - Run `SHOW CONSTRAINTS` in Neo4j Browser to verify constraints
   - Check for duplicate nodes that might violate uniqueness constraints
   - Use `MATCH (n:NodeType) RETURN n.property, count(n) AS count WHERE count > 1` to find duplicates

3. **Performance Issues**
   - Verify indexes exist for frequently queried properties
   - Use `EXPLAIN` or `PROFILE` before Cypher queries to analyze execution plans
   - Check for cartesian products in complex queries

### Common PostgreSQL Issues

1. **Connection Errors**
   - Check `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` environment variables
   - Verify PostgreSQL container is running: `docker-compose ps`
   - Test connection with schema validation script: `npm run validate:schemas`

2. **RLS Policy Issues**
   - Verify RLS is enabled on tables: `SELECT tablename, relrowsecurity FROM pg_tables JOIN pg_class ON tablename = relname WHERE schemaname = 'public'`
   - Check that `app.orgId` is set in session context
   - Test queries with different organization contexts

3. **Foreign Key Constraint Violations**
   - Verify referenced entities exist before creating relationships
   - Check for orphaned records when deleting entities
   - Use transactions for related operations to ensure consistency

### Common Redis Issues

1. **Connection Errors**
   - Check `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` environment variables
   - Verify Redis container is running: `docker-compose ps`
   - Test connection with queue service health check

2. **Job Processing Issues**
   - Check worker processes are running
   - Verify job status updates are working correctly
   - Monitor Redis memory usage and cleanup stale jobs if needed

## Performance Baselines

### Neo4j Performance

**Query Execution Times:**
- Simple node retrieval: < 10ms
- Complex relationship traversal: < 50ms
- Batch operations (100 nodes): < 200ms

**Connection Pooling:**
- Max pool size: 10 connections
- Connection timeout: 30 seconds

### PostgreSQL Performance

**Query Execution Times:**
- Simple row retrieval: < 5ms
- Complex joins with RLS: < 20ms
- Batch operations (100 rows): < 100ms

**Connection Pooling:**
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Redis Performance

**Queue Operations:**
- Job enqueue: < 1ms
- Job dequeue: < 1ms
- Job status update: < 1ms

**Connection Management:**
- Connection pooling with default settings
- Automatic reconnection on connection loss

## Development Commands

- `npm run build`: Compile TypeScript to JavaScript
- `npm run start`: Start the backend server
- `npm run dev`: Start the backend server in development mode with hot reloading
- `npm run migrate`: Run pending database migrations
- `npm run validate:schemas`: Validate database schemas
- `npm test`: Run test suites

## Environment Variables

### Neo4j Configuration
- `NEO4J_URI`: Connection URI for Neo4j database
- `NEO4J_USER`: Username for Neo4j database
- `NEO4J_PASSWORD`: Password for Neo4j database
- `NEO4J_ENCRYPTED`: Whether to use encrypted connections
- `NEO4J_MAX_CONNECTION_POOL_SIZE`: Maximum connection pool size
- `NEO4J_CONNECTION_TIMEOUT`: Connection timeout in milliseconds

### PostgreSQL Configuration
- `POSTGRES_HOST`: Host for PostgreSQL database
- `POSTGRES_PORT`: Port for PostgreSQL database
- `POSTGRES_DB`: Database name for PostgreSQL
- `POSTGRES_USER`: Username for PostgreSQL database
- `POSTGRES_PASSWORD`: Password for PostgreSQL database
- `POSTGRES_MAX_CONNECTIONS`: Maximum connection pool size
- `POSTGRES_IDLE_TIMEOUT`: Connection idle timeout in milliseconds
- `POSTGRES_CONNECTION_TIMEOUT`: Connection timeout in milliseconds

### Redis Configuration
- `REDIS_HOST`: Host for Redis server
- `REDIS_PORT`: Port for Redis server
- `REDIS_PASSWORD`: Password for Redis server (optional)
- `REDIS_DB`: Database number for Redis

### Authentication Configuration
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time
- `JWT_ISSUER`: Token issuer identifier
- `BCRYPT_SALT_ROUNDS`: Number of salt rounds for bcrypt hashing
