# Olivine Database Schema Implementation Checklist
## Phase 2: Database Design and Core Services Setup

### Neo4j Knowledge Graph Schema

* [X] **Neo4j Connection Service:** Implement the core Neo4j service for knowledge graph operations.

  * [X] **Neo4jService Class:** Create `backend/src/services/Neo4jService.ts` with:
    - Driver initialization with connection pooling
    - Session management with proper cleanup
    - Transaction handling for complex operations
    - Error handling with retry logic for transient failures
    - Multi-tenant query filtering by org_id
  * [X] **Connection Configuration:** Implement connection settings with:
    - Environment variable configuration (URI, credentials)
    - Connection pool settings (max connections, timeout)
    - SSL/TLS configuration for production
    - Health check functionality
  * [X] **Query Helpers:** Create utility methods for:
    - Parameterized query execution
    - Batch operations for bulk data
    - Transaction management
    - Result transformation and mapping

* [X] **Core Ontology Implementation:** Set up the fundamental knowledge graph structure.

  * [X] **File Ontology:** Create constraints and indexes for File nodes:
    ```cypher
    CREATE CONSTRAINT file_id_unique FOR (f:File) REQUIRE f.id IS UNIQUE
    CREATE CONSTRAINT file_org_path FOR (f:File) REQUIRE (f.org_id, f.path) IS UNIQUE
    CREATE INDEX file_org_id FOR (f:File) ON (f.org_id)
    CREATE INDEX file_modified FOR (f:File) ON (f.modified)
    CREATE INDEX file_type FOR (f:File) ON (f.type)
    ```
  * [X] **Content Ontology:** Create constraints and indexes for Content nodes:
    ```cypher
    CREATE CONSTRAINT content_id_unique FOR (c:Content) REQUIRE c.id IS UNIQUE
    CREATE INDEX content_org_id FOR (c:Content) ON (c.org_id)
    CREATE INDEX content_classification FOR (c:Content) ON (c.classification)
    CREATE INDEX content_confidence FOR (c:Content) ON (c.confidence)
    ```
  * [X] **Provenance Ontology:** Create constraints for Commit and Version tracking:
    ```cypher
    CREATE CONSTRAINT commit_id_unique FOR (c:Commit) REQUIRE c.id IS UNIQUE
    CREATE CONSTRAINT version_id_unique FOR (v:Version) REQUIRE v.id IS UNIQUE
    CREATE INDEX commit_org_id FOR (c:Commit) ON (c.org_id)
    CREATE INDEX commit_timestamp FOR (c:Commit) ON (c.timestamp)
    ```
  * [X] **Relationship Definitions:** Define core relationships:
    - [X] `(:File)-[:HAS_CONTENT]->(:Content)` - File to extracted content
    - [X] `(:Content)-[:CLASSIFIED_AS]->(:Category)` - Content classification
    - [X] `(:File)-[:COMMITTED_IN]->(:Commit)` - File change tracking
    - [X] `(:Commit)-[:CREATES_VERSION]->(:Version)` - Version creation

* [X] **Multi-Tenant Security:** Implement strict data isolation at the database level.

  * [X] **Tenant Constraints:** Add org_id to all node types and ensure it's always present:
    ```cypher
    CREATE CONSTRAINT file_org_required FOR (f:File) REQUIRE f.org_id IS NOT NULL
    CREATE CONSTRAINT content_org_required FOR (c:Content) REQUIRE c.org_id IS NOT NULL
    CREATE CONSTRAINT commit_org_required FOR (c:Commit) REQUIRE c.org_id IS NOT NULL
    ```
  * [X] **Query Templates:** Create parameterized query templates that always include org_id filtering.
  * [X] **Tenant Service:** Implement `TenantService.ts` with:
    - Organization validation
    - User-to-organization mapping
    - Permission checking utilities
    - Tenant context management

### PostgreSQL Relational Schema

* [X] **PostgreSQL Connection Service:** Set up relational database operations.

  * [X] **Database Service:** Create `backend/src/services/PostgresService.ts` with:
    - Connection pool management using pg library
    - Transaction support with rollback capabilities
    - Prepared statement handling
    - Migration support and version tracking
    - Row Level Security (RLS) enforcement
  * [X] **Connection Configuration:** Configure PostgreSQL with:
    - Environment-based connection settings
    - SSL configuration for production
    - Connection pool sizing and timeout settings
    - Health check and reconnection logic

* [X] **Core Tables Implementation:** Create essential relational data structures.

  * [X] **Organizations Table:** Create organizations table with:
    ```sql
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ```
  * [X] **Users Table:** Create users table with authentication support:
    ```sql
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'member',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );
    ```
  * [X] **Sources Table:** Create storage source configuration:
    ```sql
    CREATE TABLE sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL, -- 'dropbox', 'google_drive', etc.
      config JSONB NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ```
  * [X] **Files Table:** Create file metadata storage:
    ```sql
    CREATE TABLE files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100),
      size BIGINT,
      modified TIMESTAMPTZ,
      dropbox_cursor TEXT,
      classification VARCHAR(255),
      confidence DECIMAL(3,2),
      content_extracted BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ```

* [X] **Row Level Security (RLS) Implementation:** Enforce multi-tenant data isolation.

  * [X] **Enable RLS:** Enable Row Level Security on all tenant-specific tables:
    ```sql
    ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
    ALTER TABLE files ENABLE ROW LEVEL SECURITY;
    ```
  * [X] **RLS Policies:** Create policies for each table:
    ```sql
    CREATE POLICY users_org_isolation ON users FOR ALL TO authenticated
    USING (org_id = current_setting('app.current_org_id')::UUID);
    
    CREATE POLICY sources_org_isolation ON sources FOR ALL TO authenticated
    USING (org_id = current_setting('app.current_org_id')::UUID);
    
    CREATE POLICY files_org_isolation ON files FOR ALL TO authenticated
    USING (org_id = current_setting('app.current_org_id')::UUID);
    ```
  * [X] **Database Roles:** Create application-specific database roles with limited permissions.
  * [X] **Session Context:** Implement middleware to set org_id context for each request.

### Redis Queue System

* [X] **Queue Service Implementation:** Set up background job processing with Redis.

  * [X] **QueueService Class:** Create `backend/src/services/QueueService.ts` with:
    - Redis connection management
    - Job queue creation and management
    - Worker process handling
    - Job retry logic with exponential backoff
    - Dead letter queue for failed jobs
  * [X] **Queue Types:** Define specific queues for different operations:
    - `file-processing` - File content extraction and analysis
    - `classification` - Automated file classification
    - `sync` - Storage provider synchronization
    - `provenance` - Commit and version tracking
  * [X] **Job Definitions:** Create job interfaces and handlers:
    - Job payload validation
    - Progress tracking and reporting
    - Error handling and logging
    - Completion callbacks

### Database Migration System

* [X] **Migration Framework:** Implement database schema versioning and migration.

  * [X] **Migration Service:** Create `backend/src/services/MigrationService.ts` with:
    - Version tracking for both Neo4j and PostgreSQL
    - Migration file discovery and execution
    - Rollback capability for failed migrations
    - Dry-run mode for testing migrations
  * [X] **Neo4j Migrations:** Create migration scripts in `backend/src/migrations/neo4j/`:
    - `001_initial_schema.cypher` - Core ontology setup
    - `002_constraints_indexes.cypher` - Performance optimizations
    - `003_multi_tenant_security.cypher` - Tenant isolation
  * [X] **PostgreSQL Migrations:** Create migration scripts in `backend/src/migrations/postgres/`:
    - `001_initial_schema.sql` - Core tables
    - `002_rls_policies.sql` - Row Level Security
    - `003_indexes_performance.sql` - Query optimization
  * [X] **Migration CLI:** Create command-line interface for migration management:
    - `npm run migrate` - Run pending migrations
    - `npm run migrate:rollback` - Rollback last migration
    - `npm run migrate:status` - Show migration status

### Authentication and Authorization

* [X] **Authentication Service:** Implement JWT-based user authentication.

  * [X] **AuthService Class:** Create `backend/src/services/AuthService.ts` with:
    - User registration and login
    - Password hashing with bcrypt
    - JWT token generation and validation
    - Token refresh mechanism
    - Password reset functionality
  * [X] **JWT Configuration:** Set up JSON Web Token handling:
    - Secret key management from environment
    - Token expiration settings
    - Payload structure with user and org info
    - Token blacklisting for logout
  * [X] **Middleware:** Create authentication middleware:
    - Token extraction from headers
    - Token validation and user lookup
    - Request context population
    - Error handling for invalid tokens

* [X] **Authorization System:** Implement role-based access control.

  * [X] **Role Definitions:** Define user roles and permissions:
    - `owner` - Full organization access
    - `admin` - User and source management
    - `member` - File access and classification
    - `viewer` - Read-only access
  * [X] **Permission Middleware:** Create authorization middleware:
    - Role-based route protection
    - Resource-level permissions
    - Organization context validation
    - Permission checking utilities

### Configuration Management

* [X] **Configuration Service:** Centralize application configuration.

  * [X] **Config Structure:** Create `backend/src/config/` directory with:
    - `database.ts` - Database connection settings
    - `auth.ts` - Authentication configuration
    - `providers.ts` - Storage provider settings
    - `queue.ts` - Redis and job queue settings
  * [X] **Environment Validation:** Implement configuration validation:
    - Required environment variable checking
    - Type validation and conversion
    - Default value handling
    - Configuration error reporting
  * [X] **Secrets Management:** Implement secure handling of sensitive data:
    - Environment variable encryption
    - Secret rotation support
    - Development vs production configurations

### Testing Infrastructure

* [X] **Database Testing Setup:** Configure test databases and utilities.

  * [X] **Test Database Configuration:** Set up separate test databases:
    - Neo4j test instance with isolated data
    - PostgreSQL test database with clean schema
    - Redis test instance for queue testing
  * [X] **Test Utilities:** Create testing helper functions:
    - Database seeding and cleanup
    - Test data factories
    - Mock service implementations
    - Integration test helpers
  * [X] **Test Suites:** Implement comprehensive tests:
    - Unit tests for each service
    - Integration tests for database operations
    - Authentication and authorization tests
    - Multi-tenant isolation tests

### Verification and Validation

* [X] **Schema Validation:** Ensure all database schemas are correctly implemented.

  * [X] **Neo4j Schema Check:** Verify constraints and indexes are created:
    - Run constraint validation queries
    - Test multi-tenant data isolation
    - Verify relationship integrity
    - Performance test with sample data
  * [X] **PostgreSQL Schema Check:** Validate relational schema:
    - Test RLS policies with different users
    - Verify foreign key constraints
    - Test migration rollback functionality
    - Performance test with indexes
  * [X] **Service Integration:** Test all services work together:
    - Authentication flow end-to-end
    - Database operations with tenant isolation
    - Queue job processing
    - Error handling and recovery

* [X] **Documentation and Handoff:** Prepare for next development phase.

  * [X] **API Documentation:** Document database service interfaces.
  * [X] **Schema Documentation:** Create ERD and graph model diagrams.
  * [X] **Migration Guide:** Document how to add new migrations.
  * [X] **Troubleshooting:** Create database troubleshooting guide.
  * [X] **Performance Baseline:** Establish performance benchmarks for database operations.
