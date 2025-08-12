export interface Neo4jConfig {
    uri: string;
    user: string;
    password: string;
    maxConnectionPoolSize: number;
    connectionTimeout: number;
    encrypted: boolean;
}
export declare function getNeo4jConfig(): Neo4jConfig;
//# sourceMappingURL=neo4j.d.ts.map