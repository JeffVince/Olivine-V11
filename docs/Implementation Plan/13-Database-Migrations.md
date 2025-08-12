# Database Migrations Implementation
## Comprehensive Migration Framework for Neo4j and PostgreSQL

### 1. Migration Strategy and Framework

#### 1.1 Migration Versioning System

**Migration Versioning Implementation**
```typescript
import fs from 'fs';
import path from 'path';
import { Neo4jService } from '@/services/Neo4jService';
import { Pool } from 'pg';

export class MigrationService {
  private neo4jService: Neo4jService;
  private postgresPool: Pool;
  private migrationDir: string;

  constructor(neo4jService: Neo4jService, postgresPool: Pool) {
    this.neo4jService = neo4jService;
    this.postgresPool = postgresPool;
    this.migrationDir = path.join(__dirname, '../migrations');
  }

  /**
   * Get current migration version from database
   */
  async getCurrentVersion(): Promise<number> {
    try {
      // Check Neo4j migration version
      const neo4jQuery = `
        MATCH (m:MigrationVersion)
        RETURN m.version as version
        ORDER BY m.version DESC
        LIMIT 1
      `;
      
      const neo4jResult = await this.neo4jService.run(neo4jQuery);
      const neo4jVersion = neo4jResult.records.length > 0 
        ? neo4jResult.records[0].get('version') 
        : 0;
      
      // Check PostgreSQL migration version
      const pgResult = await this.postgresPool.query(
        'SELECT version FROM migration_versions ORDER BY version DESC LIMIT 1'
      );
      const pgVersion = pgResult.rows.length > 0 ? pgResult.rows[0].version : 0;
      
      // Return the minimum version to ensure both databases are at the same level
      return Math.min(neo4jVersion, pgVersion);
    } catch (error) {
      console.error('Failed to get current migration version:', error);
      return 0;
    }
  }

  /**
   * Set migration version in database
   */
  async setVersion(version: number, database: 'neo4j' | 'postgres'): Promise<void> {
    if (database === 'neo4j') {
      const query = `
        MERGE (m:MigrationVersion {id: 'current'})
        SET m.version = $version, m.updated_at = datetime()
      `;
      
      await this.neo4jService.run(query, { version });
    } else {
      await this.postgresPool.query(
        `INSERT INTO migration_versions (version, updated_at) 
         VALUES ($1, NOW()) 
         ON CONFLICT (id) 
         DO UPDATE SET version = $1, updated_at = NOW()`,
        [version]
      );
    }
  }

  /**
   * Get all migration files sorted by version
   */
  getMigrationFiles(): MigrationFile[] {
    const files = fs.readdirSync(this.migrationDir);
    const migrationFiles: MigrationFile[] = [];
    
    files.forEach(file => {
      const match = file.match(/^(\d+)-(.+)\.(cypher|sql)$/);
      if (match) {
        migrationFiles.push({
          version: parseInt(match[1]),
          name: match[2],
          type: match[3] as 'cypher' | 'sql',
          path: path.join(this.migrationDir, file)
        });
      }
    });
    
    return migrationFiles.sort((a, b) => a.version - b.version);
  }

  /**
   * Run a specific migration
   */
  async runMigration(migration: MigrationFile): Promise<void> {
    const content = fs.readFileSync(migration.path, 'utf8');
    
    if (migration.type === 'cypher') {
      // Run Neo4j migration
      await this.neo4jService.run(content);
    } else {
      // Run PostgreSQL migration
      await this.postgresPool.query(content);
    }
    
    // Update migration version
    await this.setVersion(migration.version, 
      migration.type === 'cypher' ? 'neo4j' : 'postgres');
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const migrationFiles = this.getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      m => m.version > currentVersion
    );
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Running ${pendingMigrations.length} pending migrations...`);
    
    for (const migration of pendingMigrations) {
      try {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        await this.runMigration(migration);
        console.log(`Migration ${migration.version}: ${migration.name} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.version}: ${migration.name} failed:`, error);
        throw error;
      }
    }
  }
}

interface MigrationFile {
  version: number;
  name: string;
  type: 'cypher' | 'sql';
  path: string;
}
```

### 2. Neo4j Migration Scripts

#### 2.1 Version 001 - Initial Schema Setup

**001-initial-schema.cypher**
```cypher
// Create constraints for File nodes
CREATE CONSTRAINT file_path_org_id IF NOT EXISTS FOR (f:File) REQUIRE (f.path, f.org_id) IS NODE KEY;
CREATE INDEX file_source_id FOR (f:File) ON (f.source_id);
CREATE INDEX file_modified FOR (f:File) ON (f.modified);
CREATE INDEX file_created_at FOR (f:File) ON (f.created_at);

// Create constraints for Content nodes
CREATE CONSTRAINT content_key_org_id IF NOT EXISTS FOR (c:Content) REQUIRE (c.content_key, c.org_id) IS NODE KEY;
CREATE INDEX content_status FOR (c:Content) ON (c.status);
CREATE INDEX content_updated_at FOR (c:Content) ON (c.updated_at);

// Create constraints for Commit nodes
CREATE CONSTRAINT commit_id IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE INDEX commit_created_at FOR (c:Commit) ON (c.created_at);
CREATE INDEX commit_org_id FOR (c:Commit) ON (c.org_id);

// Create constraints for Version nodes
CREATE CONSTRAINT version_id IF NOT EXISTS FOR (v:Version) REQUIRE v.id IS UNIQUE;
CREATE INDEX version_entity_id FOR (v:Version) ON (v.entity_id);
CREATE INDEX version_created_at FOR (v:Version) ON (v.created_at);
CREATE INDEX version_org_id FOR (v:Version) ON (v.org_id);

// Create constraints for Action nodes
CREATE CONSTRAINT action_id IF NOT EXISTS FOR (a:Action) REQUIRE a.id IS UNIQUE;
CREATE INDEX action_commit_id FOR (a:Action) ON (a.commit_id);
CREATE INDEX action_org_id FOR (a:Action) ON (a.org_id);

// Create constraints for Organization nodes
CREATE CONSTRAINT organization_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE INDEX organization_name FOR (o:Organization) ON (o.name);

// Create constraints for Source nodes
CREATE INDEX source_org_id FOR (s:Source) ON (s.org_id);
CREATE INDEX source_type FOR (s:Source) ON (s.type);

// Create constraints for User nodes
CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE;
CREATE INDEX user_name FOR (u:User) ON (u.name);

// Create relationship indexes
CREATE INDEX file_content_rel FOR ()-[r:HAS_CONTENT]->() ON (r.created_at);
CREATE INDEX version_commit_rel FOR ()-[r:VERSION_OF]->() ON (r.created_at);
CREATE INDEX commit_parent_rel FOR ()-[r:PARENT]->() ON (r.created_at);
CREATE INDEX action_commit_rel FOR ()-[r:ACTION_OF]->() ON (r.created_at);
CREATE INDEX user_org_rel FOR ()-[r:MEMBER_OF]->() ON (r.role);
CREATE INDEX source_org_rel FOR ()-[r:BELONGS_TO]->() ON (r.created_at);

// Create MigrationVersion node for tracking
CREATE CONSTRAINT migration_version_id IF NOT EXISTS FOR (m:MigrationVersion) REQUIRE m.id IS UNIQUE;
```

#### 2.2 Version 002 - Provenance and Temporal Extensions

**002-provenance-temporal.cypher**
```cypher
// Add temporal validity constraints to Version nodes
CREATE CONSTRAINT version_validity IF NOT EXISTS FOR (v:Version) REQUIRE (v.entity_id, v.valid_from) IS NODE KEY;

// Create temporal indexes
CREATE INDEX version_valid_to FOR (v:Version) ON (v.valid_to);
CREATE INDEX version_is_current FOR (v:Version) ON (v.is_current);

// Add provenance tracking constraints
CREATE CONSTRAINT provenance_id IF NOT EXISTS FOR (p:Provenance) REQUIRE p.id IS UNIQUE;
CREATE INDEX provenance_entity_id FOR (p:Provenance) ON (p.entity_id);
CREATE INDEX provenance_timestamp FOR (p:Provenance) ON (p.timestamp);

// Create relationship constraints for provenance
CREATE CONSTRAINT provenance_action_rel IF NOT EXISTS FOR ()-[r:PROVENANCE]->() REQUIRE r.id IS UNIQUE;

// Add soft delete support to File nodes
CREATE INDEX file_deleted FOR (f:File) ON (f.deleted);
CREATE INDEX file_current FOR (f:File) ON (f.current);

// Add content hash to Version nodes for integrity verification
CREATE INDEX version_content_hash FOR (v:Version) ON (v.content_hash);

// Add classification confidence scores
CREATE INDEX content_classification_score FOR (c:Content) ON (c.classification_score);
```

#### 2.3 Version 003 - Multi-Tenant Performance Optimization

**003-tenant-optimization.cypher**
```cypher
// Create composite indexes for multi-tenant queries
CREATE INDEX file_tenant_query FOR (f:File) ON (f.org_id, f.source_id, f.current);
CREATE INDEX content_tenant_query FOR (c:Content) ON (c.org_id, c.status, c.updated_at);
CREATE INDEX version_tenant_query FOR (v:Version) ON (v.org_id, v.entity_id, v.is_current);

// Add organization-specific constraints
CREATE CONSTRAINT org_file_path IF NOT EXISTS FOR (f:File) REQUIRE (f.org_id, f.path) IS NODE KEY;
CREATE CONSTRAINT org_content_key IF NOT EXISTS FOR (c:Content) REQUIRE (c.org_id, c.content_key) IS NODE KEY;

// Create tenant isolation verification constraints
CREATE INDEX tenant_isolation_check FOR (f:File) ON (f.org_id, f.id);
CREATE INDEX tenant_isolation_check_content FOR (c:Content) ON (c.org_id, c.id);

// Add performance monitoring labels
MATCH (f:File)
SET f:PerformanceOptimized
RETURN count(f) as optimized_files;

MATCH (c:Content)
SET c:PerformanceOptimized
RETURN count(c) as optimized_content;

MATCH (v:Version)
SET v:PerformanceOptimized
RETURN count(v) as optimized_versions;
```

### 3. PostgreSQL Migration Scripts

#### 3.1 Version 001 - Initial Schema Setup

**001-initial-schema.sql**
```sql
-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_organizations table
CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    org_id UUID NOT NULL REFERENCES organizations(id),
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dropbox_events table
CREATE TABLE dropbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    source_id UUID NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    cursor VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    source_id UUID NOT NULL,
    path VARCHAR(1000) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    checksum VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted BOOLEAN DEFAULT FALSE,
    current BOOLEAN DEFAULT TRUE
);

-- Create migration_versions table
CREATE TABLE migration_versions (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
    version INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sources_org_id ON sources(org_id);
CREATE INDEX idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX idx_user_organizations_org_id ON user_organizations(org_id);
CREATE INDEX idx_dropbox_events_org_id ON dropbox_events(org_id);
CREATE INDEX idx_dropbox_events_source_id ON dropbox_events(source_id);
CREATE INDEX idx_dropbox_events_processed ON dropbox_events(processed);
CREATE INDEX idx_files_org_id ON files(org_id);
CREATE INDEX idx_files_source_id ON files(source_id);
CREATE INDEX idx_files_modified ON files(modified);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_deleted ON files(deleted);
CREATE INDEX idx_files_current ON files(current);
```

#### 3.2 Version 002 - Row Level Security Implementation

**002-rls-implementation.sql**
```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Organizations isolation policy
CREATE POLICY org_isolation_policy ON organizations
    FOR ALL TO blueprint_user
    USING (
        id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- Sources isolation policy
CREATE POLICY source_isolation_policy ON sources
    FOR ALL TO blueprint_user
    USING (
        org_id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- Dropbox events isolation policy
CREATE POLICY dropbox_events_isolation_policy ON dropbox_events
    FOR ALL TO blueprint_user
    USING (
        org_id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- Files isolation policy
CREATE POLICY files_isolation_policy ON files
    FOR ALL TO blueprint_user
    USING (
        org_id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- User organizations isolation policy
CREATE POLICY user_orgs_isolation_policy ON user_organizations
    FOR ALL TO blueprint_user
    USING (user_id = current_setting('app.current_user_id'));

-- Create application user if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'blueprint_user') THEN
        CREATE USER blueprint_user WITH PASSWORD 'secure-password';
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO blueprint_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO blueprint_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO blueprint_user;

-- Add current user ID function for RLS
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id')::UUID;
EXCEPTION
    WHEN undefined_object THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create index for RLS performance
CREATE INDEX idx_user_organizations_user_id_fast ON user_organizations(user_id);
```

#### 3.3 Version 003 - Performance and Monitoring Extensions

**003-performance-monitoring.sql**
```sql
-- Add performance monitoring columns
ALTER TABLE files ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE;
ALTER TABLE files ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Create monitoring tables
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC NOT NULL,
    org_id UUID,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_org ON system_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Create hypertables for time-series data (if TimescaleDB is available)
-- This provides better performance for time-series monitoring data
/*
SELECT create_hypertable('system_metrics', 'recorded_at', if_not_exists => TRUE);
SELECT create_hypertable('audit_logs', 'created_at', if_not_exists => TRUE);
*/

-- Add monitoring functions
CREATE OR REPLACE FUNCTION record_file_access(file_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE files 
    SET last_accessed = NOW(), access_count = access_count + 1 
    WHERE id = file_id;
    
    INSERT INTO audit_logs (org_id, action, entity_type, entity_id, details)
    SELECT org_id, 'file_access', 'File', file_id, jsonb_build_object('access_count', access_count + 1)
    FROM files 
    WHERE id = file_id;
END;
$$ LANGUAGE plpgsql;

-- Create monitoring views
CREATE OR REPLACE VIEW file_access_summary AS
SELECT 
    org_id,
    COUNT(*) as total_files,
    AVG(access_count) as avg_access_count,
    MAX(last_accessed) as most_recent_access
FROM files 
GROUP BY org_id;

CREATE OR REPLACE VIEW migration_status AS
SELECT 
    version,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_since_migration
FROM migration_versions;
```

### 4. Migration Execution Scripts

#### 4.1 Migration Runner CLI

**Migration CLI Implementation**
```typescript
#!/usr/bin/env node

import { MigrationService } from '@/services/MigrationService';
import { Neo4jService } from '@/services/Neo4jService';
import { Pool } from 'pg';

async function runMigrations() {
  const neo4jService = new Neo4jService();
  const postgresPool = new Pool({
    connectionString: process.env.POSTGRES_URI
  });
  
  const migrationService = new MigrationService(neo4jService, postgresPool);
  
  try {
    console.log('Starting database migrations...');
    await migrationService.runPendingMigrations();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await neo4jService.close();
    await postgresPool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--status')) {
  // Show migration status
  const neo4jService = new Neo4jService();
  const postgresPool = new Pool({
    connectionString: process.env.POSTGRES_URI
  });
  
  const migrationService = new MigrationService(neo4jService, postgresPool);
  
  migrationService.getCurrentVersion().then(version => {
    console.log(`Current migration version: ${version}`);
    
    const migrationFiles = migrationService.getMigrationFiles();
    console.log('Available migrations:');
    migrationFiles.forEach(file => {
      console.log(`  ${file.version}: ${file.name}.${file.type}`);
    });
  }).catch(error => {
    console.error('Failed to get migration status:', error);
  }).finally(async () => {
    await neo4jService.close();
    await postgresPool.end();
  });
} else {
  runMigrations();
}
```

#### 4.2 Migration Validation Scripts

**Migration Validation Implementation**
```typescript
import { Neo4jService } from '@/services/Neo4jService';
import { Pool } from 'pg';

export class MigrationValidator {
  private neo4jService: Neo4jService;
  private postgresPool: Pool;

  constructor(neo4jService: Neo4jService, postgresPool: Pool) {
    this.neo4jService = neo4jService;
    this.postgresPool = postgresPool;
  }

  /**
   * Validate Neo4j schema after migrations
   */
  async validateNeo4jSchema(): Promise<ValidationResult> {
    const results: ValidationIssue[] = [];
    
    try {
      // Check if required constraints exist
      const constraintsQuery = `
        SHOW CONSTRAINTS
      `;
      
      const constraintsResult = await this.neo4jService.run(constraintsQuery);
      const constraints = constraintsResult.records.map(record => record.toObject());
      
      const requiredConstraints = [
        'file_path_org_id',
        'content_key_org_id',
        'commit_id',
        'version_id',
        'action_id'
      ];
      
      requiredConstraints.forEach(constraintName => {
        const exists = constraints.some(c => c.name === constraintName);
        if (!exists) {
          results.push({
            type: 'error',
            message: `Required constraint ${constraintName} is missing`,
            severity: 'high'
          });
        }
      });
      
      // Check if required indexes exist
      const indexesQuery = `
        SHOW INDEXES
      `;
      
      const indexesResult = await this.neo4jService.run(indexesQuery);
      const indexes = indexesResult.records.map(record => record.toObject());
      
      const requiredIndexes = [
        'file_source_id',
        'file_modified',
        'content_status',
        'commit_created_at'
      ];
      
      requiredIndexes.forEach(indexName => {
        const exists = indexes.some(i => i.name === indexName);
        if (!exists) {
          results.push({
            type: 'warning',
            message: `Recommended index ${indexName} is missing`,
            severity: 'medium'
          });
        }
      });
      
    } catch (error) {
      results.push({
        type: 'error',
        message: `Failed to validate Neo4j schema: ${error.message}`,
        severity: 'high'
      });
    }
    
    return {
      database: 'neo4j',
      isValid: !results.some(r => r.type === 'error'),
      issues: results
    };
  }

  /**
   * Validate PostgreSQL schema after migrations
   */
  async validatePostgresSchema(): Promise<ValidationResult> {
    const results: ValidationIssue[] = [];
    
    try {
      // Check if required tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      
      const tablesResult = await this.postgresPool.query(tablesQuery);
      const tables = tablesResult.rows.map(row => row.table_name);
      
      const requiredTables = [
        'organizations',
        'sources',
        'users',
        'user_organizations',
        'dropbox_events',
        'files',
        'migration_versions'
      ];
      
      requiredTables.forEach(tableName => {
        const exists = tables.includes(tableName);
        if (!exists) {
          results.push({
            type: 'error',
            message: `Required table ${tableName} is missing`,
            severity: 'high'
          });
        }
      });
      
      // Check if RLS is enabled on required tables
      const rlsQuery = `
        SELECT tablename, relrowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = ANY($1)
      `;
      
      const rlsResult = await this.postgresPool.query(rlsQuery, [requiredTables]);
      const rlsStatus = rlsResult.rows;
      
      rlsStatus.forEach(table => {
        if (!table.relrowsecurity) {
          results.push({
            type: 'error',
            message: `RLS is not enabled on table ${table.tablename}`,
            severity: 'high'
          });
        }
      });
      
      // Check if required indexes exist
      const indexesQuery = `
        SELECT tablename, indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
      `;
      
      const indexesResult = await this.postgresPool.query(indexesQuery);
      const indexes = indexesResult.rows;
      
      const requiredIndexes = [
        'idx_sources_org_id',
        'idx_user_organizations_user_id',
        'idx_files_org_id'
      ];
      
      requiredIndexes.forEach(indexName => {
        const exists = indexes.some(i => i.indexname === indexName);
        if (!exists) {
          results.push({
            type: 'warning',
            message: `Recommended index ${indexName} is missing`,
            severity: 'medium'
          });
        }
      });
      
    } catch (error) {
      results.push({
        type: 'error',
        message: `Failed to validate PostgreSQL schema: ${error.message}`,
        severity: 'high'
      });
    }
    
    return {
      database: 'postgres',
      isValid: !results.some(r => r.type === 'error'),
      issues: results
    };
  }

  /**
   * Run all validation checks
   */
  async validateAll(): Promise<ValidationReport> {
    const neo4jValidation = await this.validateNeo4jSchema();
    const postgresValidation = await this.validatePostgresSchema();
    
    return {
      timestamp: new Date().toISOString(),
      databases: [neo4jValidation, postgresValidation],
      isValid: neo4jValidation.isValid && postgresValidation.isValid
    };
  }
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

interface ValidationResult {
  database: 'neo4j' | 'postgres';
  isValid: boolean;
  issues: ValidationIssue[];
}

interface ValidationReport {
  timestamp: string;
  databases: ValidationResult[];
  isValid: boolean;
}
```

This database migration implementation provides a comprehensive framework for managing schema changes across both Neo4j and PostgreSQL databases. It includes version tracking, migration execution, validation checks, and sample migration scripts for initial setup, provenance extensions, and performance optimizations.
