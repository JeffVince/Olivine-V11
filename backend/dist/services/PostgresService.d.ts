import { QueryResult } from 'pg';
export declare class PostgresService {
    private pool;
    constructor();
    executeQuery(query: string, params?: unknown[]): Promise<QueryResult>;
    query(query: string, params?: unknown[]): Promise<QueryResult>;
    executeQueryInTransaction(query: string, params?: unknown[]): Promise<QueryResult>;
    executeBatchInTransaction(queries: string[], paramsArray?: unknown[][]): Promise<QueryResult[]>;
    executeTransaction(queries: Array<{
        query: string;
        params?: unknown[];
    }>): Promise<QueryResult[]>;
    healthCheck(): Promise<boolean>;
    connect(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=PostgresService.d.ts.map