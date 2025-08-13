import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';

export default async function globalSetup() {
  console.log('🧪 Setting up global test environment...');

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  process.env.USE_IN_MEMORY_QUEUES = 'true';
  
  // Override database configurations for testing
  process.env.NEO4J_URI = process.env.NEO4J_TEST_URI || 'bolt://localhost:7687';
  process.env.NEO4J_DATABASE = 'test';
  process.env.POSTGRES_DATABASE = process.env.POSTGRES_TEST_DATABASE || 'olivine_test';
  process.env.REDIS_DATABASE = '1'; // Use Redis DB 1 for tests

  try {
    // Initialize test services
    const neo4jService = new Neo4jService();
    const postgresService = new PostgresService();
    const queueService = new QueueService();

    // Connect to services
    await neo4jService.connect();
    await postgresService.connect();
    await queueService.connect();

    // Clean test databases
    console.log('🧹 Cleaning test databases...');
    
    // Clear Neo4j test database
    await neo4jService.run('MATCH (n) DETACH DELETE n');
    
    // Clear PostgreSQL test tables
    const tables = [
      'taxonomy_rules', 'taxonomy_profiles', 'files', 'sources', 
      'organizations', 'projects', 'users', 'commits', 'actions'
    ];
    
    for (const table of tables) {
      try {
        await postgresService.executeQuery(`TRUNCATE TABLE ${table} CASCADE`);
      } catch (error) {
        // Table might not exist, which is fine for tests
        console.warn(`Could not truncate table ${table}:`, error instanceof Error ? error.message : String(error));
      }
    }

    // Clear Redis data (if needed)
    // Note: QueueService doesn't have clearAllQueues method, so we'll skip this for now

    // Create test database schema if needed
    console.log('🏗️ Setting up test database schema...');
    
    // Run Neo4j constraints and indexes for testing
    const neo4jConstraints = [
      'CREATE CONSTRAINT test_org_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE',
      'CREATE CONSTRAINT test_project_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT test_file_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT test_commit_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE'
    ];

    for (const constraint of neo4jConstraints) {
      try {
        await neo4jService.run(constraint);
      } catch (error) {
        // Constraint might already exist
      }
    }

    // Ensure UUID extension for tests (if needed by migrations)
    try {
      await postgresService.executeQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    } catch {}

    // Create test PostgreSQL tables if they don't exist
    const createTablesQueries = [
      `CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        org_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        org_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS sources (
        id VARCHAR(255) PRIMARY KEY,
        organization_id VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS taxonomy_profiles (
        id VARCHAR(255) PRIMARY KEY,
        org_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS taxonomy_rules (
        id VARCHAR(255) PRIMARY KEY,
        profile_id VARCHAR(255) NOT NULL,
        org_id VARCHAR(255) NOT NULL,
        slot_key VARCHAR(255) NOT NULL,
        priority INTEGER NOT NULL,
        enabled BOOLEAN DEFAULT true,
        conditions JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // Minimal tables used by integration tests
      `CREATE TABLE IF NOT EXISTS parser_registry (
        id VARCHAR(255) PRIMARY KEY,
        org_id VARCHAR(255) NOT NULL,
        slot VARCHAR(255),
        mime_type VARCHAR(255),
        extension VARCHAR(50),
        parser_name VARCHAR(255),
        parser_version VARCHAR(50),
        min_confidence NUMERIC DEFAULT 0,
        feature_flag BOOLEAN DEFAULT false,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // Seed minimal parser row used in tests
      `INSERT INTO parser_registry (id, org_id, slot, mime_type, extension, parser_name, parser_version, min_confidence, feature_flag, enabled)
       VALUES ('test-parser-1', 'test-org-123', 'SCRIPT_PRIMARY', '*/*', 'txt', 'script-parser-v1', '1.0.0', 0.5, true, true)
       ON CONFLICT (id) DO NOTHING`,
      `CREATE TABLE IF NOT EXISTS promotion_audit (
        id VARCHAR(255) PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        actor VARCHAR(255),
        action VARCHAR(50),
        before_json JSONB,
        after_json JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS extraction_job (
        id VARCHAR(255) PRIMARY KEY,
        org_id VARCHAR(255) NOT NULL,
        file_id VARCHAR(255) NOT NULL,
        project_id VARCHAR(255),
        parser_name VARCHAR(255),
        parser_version VARCHAR(50),
        method VARCHAR(50),
        dedupe_key VARCHAR(255) UNIQUE,
        status VARCHAR(50),
        confidence NUMERIC,
        promoted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      )`,
      `CREATE TABLE IF NOT EXISTS extracted_entity_temp (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        kind VARCHAR(100) NOT NULL,
        raw_json JSONB NOT NULL,
        hash VARCHAR(255) NOT NULL,
        confidence NUMERIC,
        source_offset VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS extracted_link_temp (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        from_hash VARCHAR(255) NOT NULL,
        to_hash VARCHAR(255) NOT NULL,
        rel_type VARCHAR(100) NOT NULL,
        raw_json JSONB,
        confidence NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS content_cluster (
        id VARCHAR(255) PRIMARY KEY,
        file_id VARCHAR(255),
        entities_count INTEGER DEFAULT 0,
        links_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50)
      )`,
      `CREATE TABLE IF NOT EXISTS sync_errors (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(255),
        org_id VARCHAR(255),
        error_message TEXT,
        error_stack TEXT,
        job_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS files (
        id VARCHAR(255) PRIMARY KEY,
        org_id VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        mime_type VARCHAR(100),
        size INTEGER,
        checksum VARCHAR(255),
        organization_id VARCHAR(255),
        deleted_at TIMESTAMP,
        classification_status TEXT DEFAULT 'pending',
        extracted_text TEXT,
        content_metadata JSONB DEFAULT '{}'::jsonb
      )`
    ];

    for (const query of createTablesQueries) {
      try {
        await postgresService.executeQuery(query);
      } catch (error) {
        console.warn('Error creating test table:', (error as Error).message);
      }
    }

    // Run project migrations instead of synthetic schema when available
    try {
      const { MigrationService } = await import('../services/MigrationService');
      const ms = new MigrationService();
      await ms.createMigrationDirectories();
      await ms.applyAllMigrations();
      await ms.close();
    } catch (e) {
      console.warn('Migrations not executed in tests:', (e as Error).message);
    }

    // Copy compiled GraphQL schema for tests expecting dist path
    try {
      const fs = await import('fs');
      const path = await import('path');
      const srcSchemaDir = path.join(process.cwd(), 'dist', 'graphql', 'schema');
      const dstSchemaDir = path.join(process.cwd(), 'src', 'dist', 'graphql', 'schema');
      fs.mkdirSync(dstSchemaDir, { recursive: true });
      for (const file of ['enhanced.graphql', 'core.graphql']) {
        const src = path.join(srcSchemaDir, file);
        const dst = path.join(dstSchemaDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dst);
        }
      }
    } catch (e) {
      console.warn('Schema copy skipped:', (e as Error).message);
    }

    // Close connections
    await neo4jService.close();
    await postgresService.close();
    await queueService.close();

    console.log('✅ Global test setup completed successfully');

  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}
