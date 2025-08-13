import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';
import { AuthService } from '../services/AuthService';

/**
 * Database Testing Utilities
 * Provides helper functions for database testing
 */

export class DbTestUtils {
  // TODO: Implementation Plan - 07-Testing-QA-Implementation.md - Database testing utilities implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend database testing utilities
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private queueService: QueueService;
  private authService: AuthService;

  constructor() {
    // Use test configuration
    process.env.NODE_ENV = 'test';
    
    // Initialize services with test configurations
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.queueService = new QueueService();
    this.authService = new AuthService();
  }

  /**
   * Clear all data from Neo4j database
   */
  async clearNeo4jData(): Promise<void> {
    try {
      // Delete all nodes and relationships
      await this.neo4jService.executeQuery(`
        MATCH (n)
        DETACH DELETE n
      `);
      
      console.log('Neo4j test data cleared successfully');
    } catch (error) {
      console.error('Error clearing Neo4j test data:', error);
      throw error;
    }
  }

  /**
   * Clear all data from PostgreSQL database
   */
  async clearPostgresData(): Promise<void> {
    try {
      // Truncate all tables
      await this.postgresService.executeQuery(`
        TRUNCATE TABLE organizations, users, sources, files RESTART IDENTITY CASCADE
      `);
      
      console.log('PostgreSQL test data cleared successfully');
    } catch (error) {
      console.error('Error clearing PostgreSQL test data:', error);
      throw error;
    }
  }

  /**
   * Create test organization
   */
  async createTestOrganization(name = 'Test Organization', slug = 'test-org'): Promise<unknown> {
    try {
      const result = await this.postgresService.executeQuery(
        `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug`,
        [name, slug]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating test organization:', error);
      throw error;
    }
  }

  /**
   * Create test user
   */
  async createTestUser(email: string, password: string, orgId: string, role = 'member'): Promise<unknown> {
    try {
      // Hash password
      const passwordHash = await this.authService.hashPassword(password);
      
      const result = await this.postgresService.executeQuery(
        `INSERT INTO users (email, password_hash, organization_id, role) VALUES ($1, $2, $3, $4) RETURNING id, email, organization_id, role`,
        [email, passwordHash, orgId, role]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating test user:', error);
      throw error;
    }
  }

  /**
   * Health check for all database services
   */
  async healthCheckAll(): Promise<boolean> {
    try {
      const neo4jHealthy = await this.neo4jService.healthCheck();
      const postgresHealthy = await this.postgresService.healthCheck();
      const redisPing = await this.queueService.ping();
      const redisHealthy = redisPing === 'PONG';
      
      return neo4jHealthy && postgresHealthy && redisHealthy;
    } catch (error) {
      console.error('Database services health check failed:', error);
      return false;
    }
  }

  /**
   * Close all database connections
   */
  async closeAll(): Promise<void> {
    await this.neo4jService.close();
    await this.postgresService.close();
    await this.queueService.close();
    await this.authService.close();
  }
}
