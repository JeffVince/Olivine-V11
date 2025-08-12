import { QueryResult } from 'pg';
export declare class PostgresService {
    private pool;
    constructor();
    /**
     * Execute a query against the PostgreSQL database
     * @param query SQL query string
     * @param params Query parameters
     * @returns Query result
     */
    executeQuery(query: string, params?: any[]): Promise<QueryResult>;
    /**
     * Execute a query within a transaction
     * @param query SQL query string
     * @param params Query parameters
     * @returns Query result
     */
    executeQueryInTransaction(query: string, params?: any[]): Promise<QueryResult>;
    /**
     * Execute multiple queries within a transaction
     * @param queries Array of SQL query strings
     * @param paramsArray Array of parameters for each query
     * @returns Array of query results
     */
    executeBatchInTransaction(queries: string[], paramsArray?: any[][]): Promise<QueryResult[]>;
    /**
     * Health check for PostgreSQL connection
     * @returns Boolean indicating if connection is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Close the PostgreSQL connection pool
     */
    close(): Promise<void>;
}
