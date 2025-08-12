import { Neo4jService } from './Neo4jService';
import { PostgresService } from './PostgresService';
import fs from 'fs';
import path from 'path';

export class MigrationService {
  // TODO: Implementation Plan - 01-Foundation-Setup.md - Migration service implementation
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Neo4j migration support
  // TODO: Implementation Plan - 04-Data-Storage-Implementation.md - PostgreSQL migration support
  // TODO: Implementation Checklist - 01-Foundation-Setup-Checklist.md - Database schema migrations
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend migration service tests
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private migrationsDir: string;

  constructor() {
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.migrationsDir = path.join(__dirname, '../migrations');
  }

  /**
   * Apply all pending migrations
   */
  async applyAllMigrations(): Promise<void> {
    console.log('Applying all pending migrations...');
    
    // Apply Neo4j migrations
    await this.applyNeo4jMigrations();
    
    // Apply PostgreSQL migrations
    await this.applyPostgresMigrations();
    
    console.log('All migrations applied successfully!');
  }

  /**
   * Apply Neo4j migrations
   */
  private async applyNeo4jMigrations(): Promise<void> {
    const neo4jMigrationsDir = path.join(this.migrationsDir, 'neo4j');
    
    if (!fs.existsSync(neo4jMigrationsDir)) {
      console.log('No Neo4j migrations directory found');
      return;
    }
    
    const migrationFiles = fs.readdirSync(neo4jMigrationsDir)
      .filter(file => file.endsWith('.cypher'))
      .sort();
    
    for (const file of migrationFiles) {
      const migrationPath = path.join(neo4jMigrationsDir, file);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');
      
      // Split migration content into separate statements
      const statements = migrationContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      console.log(`Applying Neo4j migration: ${file} with ${statements.length} statements`);
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.trim().length > 0) {
          await this.neo4jService.executeQuery(statement);
        }
      }
    }
  }

  /**
   * Apply PostgreSQL migrations
   */
  private async applyPostgresMigrations(): Promise<void> {
    const postgresMigrationsDir = path.join(this.migrationsDir, 'postgres');
    
    if (!fs.existsSync(postgresMigrationsDir)) {
      console.log('No PostgreSQL migrations directory found');
      return;
    }
    
    const migrationFiles = fs.readdirSync(postgresMigrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      const migrationPath = path.join(postgresMigrationsDir, file);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');
      
      // Split migration content into separate statements
      const statements = migrationContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      console.log(`Applying PostgreSQL migration: ${file} with ${statements.length} statements`);
      
      // Execute each statement separately
      for (const statement of statements) {
        if (statement.trim().length > 0) {
          try {
            await this.postgresService.executeQuery(statement);
          } catch (error: any) {
            // Skip errors for CREATE POLICY statements if they already exist
            // PostgreSQL error code 42710 indicates duplicate policy
            if (statement.trim().toUpperCase().startsWith('CREATE POLICY') && 
                (error.message.includes('already exists') || error.message.includes('duplicate key') || error.code === '42710')) {
              console.log(`Policy already exists, skipping: ${statement.substring(0, 50)}...`);
            } else {
              throw error;
            }
          }
        }
      }
    }
  }

  /**
   * Create migration directories
   */
  async createMigrationDirectories(): Promise<void> {
    const neo4jMigrationsDir = path.join(this.migrationsDir, 'neo4j');
    const postgresMigrationsDir = path.join(this.migrationsDir, 'postgres');
    
    if (!fs.existsSync(neo4jMigrationsDir)) {
      fs.mkdirSync(neo4jMigrationsDir, { recursive: true });
      console.log('Created Neo4j migrations directory');
    }
    
    if (!fs.existsSync(postgresMigrationsDir)) {
      fs.mkdirSync(postgresMigrationsDir, { recursive: true });
      console.log('Created PostgreSQL migrations directory');
    }
  }

  /**
   * Health check for migration service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const neo4jHealthy = await this.neo4jService.healthCheck();
      const postgresHealthy = await this.postgresService.healthCheck();
      
      return neo4jHealthy && postgresHealthy;
    } catch (error) {
      console.error('Migration service health check failed:', error);
      return false;
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.neo4jService.close();
    await this.postgresService.close();
  }
}
