import neo4j, { Driver, Session, Transaction, Result } from 'neo4j-driver';
import { getNeo4jConfig, Neo4jConfig } from '../config/neo4j';

export class Neo4jService {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Neo4j service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend Neo4j service tests
  private driver: Driver;
  private config: Neo4jConfig;

  constructor() {
    this.config = getNeo4jConfig();
    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.user, this.config.password),
      {
        maxConnectionPoolSize: this.config.maxConnectionPoolSize,
        connectionTimeout: this.config.connectionTimeout,
        encrypted: this.config.encrypted ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF'
      }
    );
  }

  /**
   * Get a Neo4j session
   * @returns Neo4j session
   */
  getSession(orgId?: string, accessMode?: 'READ' | 'WRITE'): Session {
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend Neo4j service tests
    return this.driver.session({
      database: 'neo4j',
      defaultAccessMode: accessMode || 'READ'
    });
  }

  /**
   * Run a Neo4j query (wrapper for executeQuery to match agent expectations)
   * @param query - Cypher query string
   * @param params - Query parameters
   * @returns Query result
   */
  async run(query: string, params: Record<string, unknown> = {}): Promise<Result> {
    return this.executeQuery(query, params);
  }

  /**
   * Execute a parameterized query
   * @param query Cypher query string
   * @param params Query parameters
   * @param orgId Organization ID for multi-tenant filtering
   * @returns Query result
   * 
   * // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Neo4j query execution with multi-tenant filtering
   * // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend database query tests
   */
  async executeQuery(query: string, params: Record<string, unknown> = {}, orgId?: string): Promise<Result> {
    // Determine if this is a write operation. Be robust to newlines and comments.
    const q = query.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').trim();
    const isWriteQuery = /(CREATE|MERGE|SET\s+|DELETE|REMOVE|DROP|CALL\s+db\.|CREATE\s+CONSTRAINT|CREATE\s+INDEX)/i.test(q);
    const accessMode = isWriteQuery ? 'WRITE' : 'READ';
    
    const session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: accessMode
    });
    try {
      // Add orgId (camelCase) param to satisfy unit tests expecting orgId
      if (orgId) {
        if (!('orgId' in params)) {
          (params as any).orgId = orgId;
        }
      }
      // Ensure no plain object parameters for node/relationship properties
      // Convert known complex objects to JSON strings where they are likely used as properties
      const sanitizedParams: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) {
          sanitizedParams[k] = null
          continue
        }
        if (v instanceof Date) {
          // Normalize JS Date to ISO string to avoid Map-like parameter encoding
          sanitizedParams[k] = v.toISOString()
          continue
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          // Convert plain objects to Neo4j-compatible string to prevent Map property assignment
          const likelyUsedAsProperty = true
          sanitizedParams[k] = likelyUsedAsProperty ? JSON.stringify(v) : v
        } else {
          sanitizedParams[k] = v
        }
      }
      
      const result = await session.run(query, sanitizedParams);
      return result;
    } catch (error) {
      console.error('Error executing Neo4j query:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a parameterized query within a transaction
   * @param query Cypher query string
   * @param params Query parameters
   * @param orgId Organization ID for multi-tenant filtering
   * @returns Query result
   */
  async executeQueryInTransaction(query: string, params: Record<string, unknown> = {}, orgId?: string): Promise<unknown> {
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend Neo4j service tests
    const session = this.getSession(orgId, 'WRITE');
    try {
      const result = await session.executeWrite(tx => tx.run(query, params));
      return result;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write query
   * @param query The query to execute
   * @param params Query parameters
   * @param orgId Organization ID for multi-tenancy
   * @returns Query result
   */
  async executeWriteQuery(query: string, params: Record<string, unknown> = {}, orgId?: string): Promise<unknown> {
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend Neo4j service tests
    const session = this.getSession(orgId, 'WRITE');
    try {
      // Add org_id to params if provided for multi-tenant filtering
      if (orgId) {
        params.orgId = orgId;
      }
      
      const result = await session.run(query, params);
      return result;
    } catch (error) {
      console.error('Error executing Neo4j write query:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param queries Array of queries to execute
   * @param orgId Organization ID for multi-tenancy
   * @returns Array of query results
   */
  async executeTransaction(queries: Array<{query: string, params?: Record<string, unknown>}>, orgId?: string): Promise<unknown[]> {
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend Neo4j service tests
    const session = this.getSession(orgId, 'WRITE');
    const results: unknown[] = [];
    let tx: Transaction | null = null;
    
    try {
      tx = await session.beginTransaction();
      
      for (const {query, params = {}} of queries) {
        const result = await tx.run(query, params);
        results.push(result.records);
      }
      
      await tx.commit();
      return results;
    } catch (error) {
      if (tx) {
        await tx.rollback();
      }
      console.error('Error executing Neo4j transaction:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute batch operations
   * @param queries Array of Cypher queries
   * @param paramsArray Array of parameters for each query
   * @param orgId Organization ID for multi-tenant filtering
   * @returns Array of results
   */
  async executeBatch(queries: string[], paramsArray: Record<string, unknown>[] = [], orgId?: string): Promise<unknown[]> {
    const session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: 'WRITE'
    });
    const results: unknown[] = [];
    let tx: Transaction | null = null;
    
    try {
      tx = await session.beginTransaction();
      
      for (let i = 0; i < queries.length; i++) {
        const params = paramsArray[i] || {};
        // Add org_id to params if provided for multi-tenant filtering
        if (orgId) {
          params.orgId = orgId;
        }
        
        const result = await tx.run(queries[i], params);
        results.push(result.records);
      }
      
      await tx.commit();
      return results;
    } catch (error) {
      if (tx) {
        await tx.rollback();
      }
      console.error('Error executing Neo4j batch operations:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Health check for Neo4j connection
   * @returns Boolean indicating if connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend Neo4j service tests
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch (error) {
      console.error('Neo4j health check failed:', error);
      return false;
    }
  }

  /**
   * Connect to Neo4j (verify connectivity)
   */
  async connect(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  /**
   * Close the Neo4j driver connection
   */
  async close(): Promise<void> {
    await this.driver.close();
  }
}
