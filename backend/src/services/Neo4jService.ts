import neo4j, { Driver, Session, Transaction } from 'neo4j-driver';
import { getNeo4jConfig, Neo4jConfig } from '../config/neo4j';

export class Neo4jService {
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
  getSession(): Session {
    return this.driver.session();
  }

  /**
   * Execute a parameterized query
   * @param query Cypher query string
   * @param params Query parameters
   * @param orgId Organization ID for multi-tenant filtering
   * @returns Query result
   */
  async executeQuery(query: string, params: Record<string, any> = {}, orgId?: string): Promise<any> {
    const session = this.getSession();
    try {
      // Add org_id to params if provided for multi-tenant filtering
      if (orgId) {
        params.orgId = orgId;
      }
      
      const result = await session.run(query, params);
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
  async executeQueryInTransaction(query: string, params: Record<string, any> = {}, orgId?: string): Promise<any> {
    const session = this.getSession();
    const transaction = session.beginTransaction();
    
    try {
      // Add org_id to params if provided for multi-tenant filtering
      if (orgId) {
        params.orgId = orgId;
      }
      
      const result = await transaction.run(query, params);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      console.error('Error executing Neo4j query in transaction:', error);
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
  async executeBatch(queries: string[], paramsArray: Record<string, any>[] = [], orgId?: string): Promise<any[]> {
    const session = this.getSession();
    const transaction = session.beginTransaction();
    const results = [];
    
    try {
      for (let i = 0; i < queries.length; i++) {
        const params = paramsArray[i] || {};
        // Add org_id to params if provided for multi-tenant filtering
        if (orgId) {
          params.orgId = orgId;
        }
        
        const result = await transaction.run(queries[i], params);
        results.push(result);
      }
      
      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
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
    const session = this.getSession();
    try {
      await session.run('RETURN 1');
      return true;
    } catch (error) {
      console.error('Neo4j health check failed:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Close the Neo4j driver connection
   */
  async close(): Promise<void> {
    await this.driver.close();
  }
}
