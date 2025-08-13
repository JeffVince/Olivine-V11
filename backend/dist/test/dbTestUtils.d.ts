export declare class DbTestUtils {
    private neo4jService;
    private postgresService;
    private queueService;
    private authService;
    constructor();
    clearNeo4jData(): Promise<void>;
    clearPostgresData(): Promise<void>;
    createTestOrganization(name?: string, slug?: string): Promise<unknown>;
    createTestUser(email: string, password: string, orgId: string, role?: string): Promise<unknown>;
    healthCheckAll(): Promise<boolean>;
    closeAll(): Promise<void>;
}
//# sourceMappingURL=dbTestUtils.d.ts.map