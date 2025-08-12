import { Session } from 'neo4j-driver';
export declare class Neo4jService {
    private driver;
    private config;
    constructor();
    getSession(orgId?: string, accessMode?: 'READ' | 'WRITE'): Session;
    run(query: string, params?: Record<string, any>): Promise<any>;
    executeQuery(query: string, params?: Record<string, any>, orgId?: string): Promise<any>;
    executeQueryInTransaction(query: string, params?: Record<string, any>, orgId?: string): Promise<any>;
    executeWriteQuery(query: string, params?: Record<string, any>, orgId?: string): Promise<any>;
    executeTransaction(queries: Array<{
        query: string;
        params?: Record<string, any>;
    }>, orgId?: string): Promise<any[]>;
    executeBatch(queries: string[], paramsArray?: Record<string, any>[], orgId?: string): Promise<any[]>;
    healthCheck(): Promise<boolean>;
    connect(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=Neo4jService.d.ts.map