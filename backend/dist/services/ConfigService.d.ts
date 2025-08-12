interface DatabaseConfig {
    neo4j: {
        uri: string;
        user: string;
        password: string;
        encrypted: boolean;
        maxConnectionPoolSize: number;
        connectionTimeout: number;
    };
    postgres: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        maxConnections: number;
        idleTimeout: number;
        connectionTimeout: number;
    };
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
    };
}
interface AuthConfig {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtIssuer: string;
    bcryptSaltRounds: number;
}
interface AppConfig {
    environment: string;
    port: number;
    logLevel: string;
}
export declare class ConfigService {
    private databaseConfig;
    private authConfig;
    private appConfig;
    constructor();
    private loadDatabaseConfig;
    private loadAuthConfig;
    private loadAppConfig;
    getDatabaseConfig(): DatabaseConfig;
    getNeo4jConfig(): DatabaseConfig['neo4j'];
    getPostgresConfig(): DatabaseConfig['postgres'];
    getRedisConfig(): DatabaseConfig['redis'];
    getAuthConfig(): AuthConfig;
    getJwtConfig(): {
        secret: string;
        expiresIn: string;
        issuer: string;
    };
    getAppConfig(): AppConfig;
    validateConfig(): boolean;
    loadSecretFromFile(secretPath: string): string | null;
    healthCheck(): boolean;
}
export {};
//# sourceMappingURL=ConfigService.d.ts.map