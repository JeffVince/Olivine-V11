"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PostgresService_1 = require("../services/PostgresService");
async function setupPostgresTables() {
    const postgresService = new PostgresService_1.PostgresService();
    try {
        console.log('Setting up core PostgreSQL tables...');
        await postgresService.executeQuery(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await postgresService.executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        orgId UUID NOT NULL REFERENCES organizations(id),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      )
    `);
        await postgresService.executeQuery(`
      CREATE TABLE IF NOT EXISTS sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        orgId UUID NOT NULL REFERENCES organizations(id),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await postgresService.executeQuery(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        orgId UUID NOT NULL REFERENCES organizations(id),
        source_id UUID NOT NULL REFERENCES sources(id),
        path VARCHAR(1000) NOT NULL,
        name VARCHAR(255) NOT NULL,
        extension VARCHAR(50),
        mime_type VARCHAR(100),
        size BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP WITH TIME ZONE,
        deleted_at TIMESTAMP WITH TIME ZONE,
        version_id UUID,
        metadata JSONB
      )
    `);
        console.log('PostgreSQL tables setup completed successfully!');
    }
    catch (error) {
        console.error('Error setting up PostgreSQL tables:', error);
    }
    finally {
        await postgresService.close();
    }
}
setupPostgresTables();
//# sourceMappingURL=setupPostgresTables.js.map