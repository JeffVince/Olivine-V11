"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalSetup;
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const QueueService_1 = require("../services/queues/QueueService");
async function globalSetup() {
    console.log('🧪 Setting up global test environment...');
    process.env.NODE_ENV = 'test';
    process.env.TEST_MODE = 'true';
    process.env.USE_IN_MEMORY_QUEUES = 'true';
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
                console.warn(`Could not truncate table ${table}:`, error instanceof Error ? error.message : String(error));
            }
        }
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
        try {
            await postgresService.executeQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        }
        catch { }
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
        org_id VARCHAR(255),
        entities_count INTEGER DEFAULT 0,
        links_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
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
            }
            catch (error) {
                console.warn('Error creating test table:', error.message);
            }
        }
        try {
            const { MigrationService } = await Promise.resolve().then(() => __importStar(require('../services/MigrationService')));
            const ms = new MigrationService();
            await ms.createMigrationDirectories();
            await ms.applyAllMigrations();
            await ms.close();
        }
        catch (e) {
            console.warn('Migrations not executed in tests:', e.message);
        }
        try {
            await postgresService.executeQuery(`ALTER TABLE IF EXISTS files ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending'`);
            await postgresService.executeQuery(`ALTER TABLE IF EXISTS content_cluster ADD COLUMN IF NOT EXISTS org_id VARCHAR(255)`);
        }
        catch (e) {
            console.warn('Post-migration schema alignment skipped:', e.message);
        }
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
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
        }
        catch (e) {
            console.warn('Schema copy skipped:', e.message);
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