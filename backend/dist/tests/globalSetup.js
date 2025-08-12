"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalSetup;
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const QueueService_1 = require("../services/queues/QueueService");
async function globalSetup() {
    console.log('🧪 Setting up global test environment...');
    process.env.NODE_ENV = 'test';
    process.env.NEO4J_URI = process.env.NEO4J_TEST_URI || 'bolt://localhost:7687';
    process.env.NEO4J_DATABASE = 'test';
    process.env.POSTGRES_DATABASE = process.env.POSTGRES_TEST_DATABASE || 'olivine_test';
    process.env.REDIS_DATABASE = '1';
    try {
        const neo4jService = new Neo4jService_1.Neo4jService();
        const postgresService = new PostgresService_1.PostgresService();
        const queueService = new QueueService_1.QueueService();
        await neo4jService.connect();
        await postgresService.connect();
        await queueService.connect();
        console.log('🧹 Cleaning test databases...');
        await neo4jService.run('MATCH (n) DETACH DELETE n');
        const tables = [
            'taxonomy_rules', 'taxonomy_profiles', 'files', 'sources',
            'organizations', 'projects', 'users', 'commits', 'actions'
        ];
        for (const table of tables) {
            try {
                await postgresService.executeQuery(`TRUNCATE TABLE ${table} CASCADE`);
            }
            catch (error) {
                console.warn(`Could not truncate table ${table}:`, error.message);
            }
        }
        await queueService.clearAllQueues();
        console.log('🏗️ Setting up test database schema...');
        const neo4jConstraints = [
            'CREATE CONSTRAINT test_org_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE',
            'CREATE CONSTRAINT test_project_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
            'CREATE CONSTRAINT test_file_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
            'CREATE CONSTRAINT test_commit_unique IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE'
        ];
        for (const constraint of neo4jConstraints) {
            try {
                await neo4jService.run(constraint);
            }
            catch (error) {
            }
        }
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
            }
            catch (error) {
                console.warn('Error creating test table:', error.message);
            }
        }
        await neo4jService.close();
        await postgresService.close();
        await queueService.close();
        console.log('✅ Global test setup completed successfully');
    }
    catch (error) {
        console.error('❌ Global test setup failed:', error);
        throw error;
    }
}
//# sourceMappingURL=globalSetup.js.map