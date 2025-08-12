export declare class MigrationService {
    private neo4jService;
    private postgresService;
    private migrationsDir;
    constructor();
    applyAllMigrations(): Promise<void>;
    private applyNeo4jMigrations;
    private applyPostgresMigrations;
    createMigrationDirectories(): Promise<void>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
}
//# sourceMappingURL=MigrationService.d.ts.map