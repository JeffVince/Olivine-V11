import { QueryResult } from 'pg';
export declare class PostgresService {
    private pool;
    constructor();
    executeQuery(query: string, params?: any[]): Promise<QueryResult>;
    executeQueryInTransaction(query: string, params?: any[]): Promise<QueryResult>;
    executeBatchInTransaction(queries: string[], paramsArray?: any[][]): Promise<QueryResult[]>;
    executeTransaction(queries: Array<{
        query: string;
        params?: any[];
    }>): Promise<QueryResult[]>;
    healthCheck(): Promise<boolean>;
    connect(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=PostgresService.d.ts.map