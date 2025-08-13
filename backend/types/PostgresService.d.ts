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
    executeQuery(query: string, params?: unknown[]): Promise<QueryResult>;
    /**
     * Execute a query within a transaction
     * @param query SQL query string
     * @param params Query parameters
     * @returns Query result
     */
    executeQueryInTransaction(query: string, params?: unknown[]): Promise<QueryResult>;
    /**
     * Execute multiple queries within a transaction
     * @param queries Array of SQL query strings
     * @param paramsArray Array of parameters for each query
     * @returns Array of query results
     */
    executeBatchInTransaction(queries: string[], paramsArray?: unknown[][]): Promise<QueryResult[]>;
    executeTransaction(queries: Array<{
        query: string;
        params?: unknown[];
    }>): Promise<QueryResult[]>;
    /**
     * Health check for PostgreSQL connection
     * @returns Boolean indicating if connection is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Connect to PostgreSQL (test connectivity)
     */
    connect(): Promise<void>;
    /**
     * Close the PostgreSQL connection pool
     */
    close(): Promise<void>;
}
