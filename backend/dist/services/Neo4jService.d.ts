import { Session, Result } from 'neo4j-driver';
export declare class Neo4jService {
    private driver;
    private config;
    constructor();
    getSession(orgId?: string, accessMode?: 'READ' | 'WRITE'): Session;
    run(query: string, params?: Record<string, unknown>): Promise<Result>;
    executeQuery(query: string, params?: Record<string, unknown>, orgId?: string): Promise<Result>;
    executeQueryInTransaction(query: string, params?: Record<string, unknown>, orgId?: string): Promise<unknown>;
    executeWriteQuery(query: string, params?: Record<string, unknown>, orgId?: string): Promise<unknown>;
    executeTransaction(queries: Array<{
        query: string;
        params?: Record<string, unknown>;
    }>, orgId?: string): Promise<unknown[]>;
    executeBatch(queries: string[], paramsArray?: Record<string, unknown>[], orgId?: string): Promise<unknown[]>;
    healthCheck(): Promise<boolean>;
    connect(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=Neo4jService.d.ts.map