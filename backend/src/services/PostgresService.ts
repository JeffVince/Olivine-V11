import { Pool, PoolConfig, QueryResult } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

export class PostgresService {
  // TODO: Implementation Plan - 04-Data-Storage-Implementation.md - PostgreSQL service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend PostgreSQL service tests
  private pool: Pool;

  constructor() {
    const poolConfig: PoolConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'olivine',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000')
    };

    this.pool = new Pool(poolConfig);
  }

  /**
   * Execute a query against the PostgreSQL database
   * @param query SQL query string
   * @param params Query parameters
   * @returns Query result
   */
  async executeQuery(query: string, params: unknown[] = []): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return result;
    } catch (error) {
      console.error('Error executing PostgreSQL query:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Alias for executeQuery to match cluster logic expectations
   * @param query SQL query string
   * @param params Query parameters
   * @returns Query result
   */
  async query(query: string, params: unknown[] = []): Promise<QueryResult> {
    return this.executeQuery(query, params);
  }

  /**
   * Execute a query within a transaction
   * @param query SQL query string
   * @param params Query parameters
   * @returns Query result
   */
  async executeQueryInTransaction(query: string, params: unknown[] = []): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(query, params);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error executing PostgreSQL query in transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries within a transaction
   * @param queries Array of SQL query strings
   * @param paramsArray Array of parameters for each query
   * @returns Array of query results
   */
  async executeBatchInTransaction(queries: string[], paramsArray: unknown[][] = []): Promise<QueryResult[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results: QueryResult[] = [];
      
      for (let i = 0; i < queries.length; i++) {
        const params = paramsArray[i] || [];
        const result = await client.query(queries[i], params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async executeTransaction(queries: Array<{query: string, params?: unknown[]}>) : Promise<QueryResult[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results: QueryResult[] = [];
      
      for (const {query, params = []} of queries) {
        const result = await client.query(query, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check for PostgreSQL connection
   * @returns Boolean indicating if connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT 1');
      return true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  /**
   * Connect to PostgreSQL (test connectivity)
   */
  async connect(): Promise<void> {
    await this.healthCheck();
  }

  /**
   * Close the PostgreSQL connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
