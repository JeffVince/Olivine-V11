import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';

export default async function globalSetup() {
  console.log('🧪 Setting up global test environment...');

  // Set test environment
  process.env.NODE_ENV = 'test';
  
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
      )`
    ];

    for (const query of createTablesQueries) {
      try {
        await postgresService.executeQuery(query);
      } catch (error) {
        console.warn('Error creating test table:', (error as Error).message);
      }
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
