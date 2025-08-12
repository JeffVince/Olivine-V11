"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ConfigService_1 = require("../../services/ConfigService");
const mockEnv = {
    NEO4J_URI: 'bolt://localhost:7687',
    NEO4J_USER: 'neo4j',
    NEO4J_PASSWORD: 'password',
    NEO4J_ENCRYPTED: 'true',
    NEO4J_MAX_CONNECTION_POOL_SIZE: '15',
    NEO4J_CONNECTION_TIMEOUT: '40000',
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: '5432',
    POSTGRES_DB: 'olivine_test',
    POSTGRES_USER: 'test_user',
    POSTGRES_PASSWORD: 'test_password',
    POSTGRES_MAX_CONNECTIONS: '25',
    POSTGRES_IDLE_TIMEOUT: '40000',
    POSTGRES_CONNECTION_TIMEOUT: '3000',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'redis_password',
    REDIS_DB: '1',
    JWT_SECRET: 'test_jwt_secret',
    JWT_EXPIRES_IN: '2h',
    JWT_ISSUER: 'olivine_test',
    BCRYPT_SALT_ROUNDS: '12',
    NODE_ENV: 'test',
    PORT: '3001',
    LOG_LEVEL: 'debug'
};
describe('ConfigService', () => {
    let originalEnv;
    let configService;
    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...mockEnv };
        configService = new ConfigService_1.ConfigService();
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    describe('getDatabaseConfig', () => {
        it('should return complete database configuration', () => {
            const dbConfig = configService.getDatabaseConfig();
            expect(dbConfig).toBeDefined();
            expect(dbConfig.neo4j).toBeDefined();
            expect(dbConfig.postgres).toBeDefined();
            expect(dbConfig.redis).toBeDefined();
        });
        it('should return correct Neo4j configuration', () => {
            const neo4jConfig = configService.getNeo4jConfig();
            expect(neo4jConfig.uri).toBe('bolt://localhost:7687');
            expect(neo4jConfig.user).toBe('neo4j');
            expect(neo4jConfig.password).toBe('password');
            expect(neo4jConfig.encrypted).toBe(true);
            expect(neo4jConfig.maxConnectionPoolSize).toBe(15);
            expect(neo4jConfig.connectionTimeout).toBe(40000);
        });
        it('should return correct PostgreSQL configuration', () => {
            const postgresConfig = configService.getPostgresConfig();
            expect(postgresConfig.host).toBe('localhost');
            expect(postgresConfig.port).toBe(5432);
            expect(postgresConfig.database).toBe('olivine_test');
            expect(postgresConfig.user).toBe('test_user');
            expect(postgresConfig.password).toBe('test_password');
            expect(postgresConfig.maxConnections).toBe(25);
            expect(postgresConfig.idleTimeout).toBe(40000);
            expect(postgresConfig.connectionTimeout).toBe(3000);
        });
        it('should return correct Redis configuration', () => {
            const redisConfig = configService.getRedisConfig();
            expect(redisConfig.host).toBe('localhost');
            expect(redisConfig.port).toBe(6379);
            expect(redisConfig.password).toBe('redis_password');
            expect(redisConfig.db).toBe(1);
        });
    });
    describe('getAuthConfig', () => {
        it('should return complete authentication configuration', () => {
            const authConfig = configService.getAuthConfig();
            expect(authConfig).toBeDefined();
            expect(authConfig.jwtSecret).toBe('test_jwt_secret');
            expect(authConfig.jwtExpiresIn).toBe('2h');
            expect(authConfig.jwtIssuer).toBe('olivine_test');
            expect(authConfig.bcryptSaltRounds).toBe(12);
        });
    });
    describe('getAppConfig', () => {
        it('should return complete application configuration', () => {
            const appConfig = configService.getAppConfig();
            expect(appConfig).toBeDefined();
            expect(appConfig.environment).toBe('test');
            expect(appConfig.port).toBe(3001);
            expect(appConfig.logLevel).toBe('debug');
        });
    });
    describe('validateConfig', () => {
        it('should return true for valid configuration', () => {
            const isValid = configService.validateConfig();
            expect(isValid).toBe(true);
        });
        it('should return false when Neo4j configuration is missing', () => {
            delete process.env.NEO4J_PASSWORD;
            const configServiceMissingNeo4j = new ConfigService_1.ConfigService();
            const isValid = configServiceMissingNeo4j.validateConfig();
            expect(isValid).toBe(false);
        });
        it('should return false when PostgreSQL configuration is missing', () => {
            delete process.env.POSTGRES_DB;
            const configServiceMissingPostgres = new ConfigService_1.ConfigService();
            const isValid = configServiceMissingPostgres.validateConfig();
            expect(isValid).toBe(false);
        });
        it('should return false when Redis configuration is missing', () => {
            delete process.env.REDIS_HOST;
            const configServiceMissingRedis = new ConfigService_1.ConfigService();
            const isValid = configServiceMissingRedis.validateConfig();
            expect(isValid).toBe(false);
        });
        it('should warn when using default JWT secret', () => {
            process.env.JWT_SECRET = 'default_secret';
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const configServiceWithDefaultSecret = new ConfigService_1.ConfigService();
            const isValid = configServiceWithDefaultSecret.validateConfig();
            expect(isValid).toBe(true);
            expect(consoleWarnSpy).toHaveBeenCalledWith('Using default JWT secret - not recommended for production');
            consoleWarnSpy.mockRestore();
        });
    });
    describe('loadSecretFromFile', () => {
        it('should return null when file does not exist', () => {
            const secret = configService.loadSecretFromFile('/non/existent/file');
            expect(secret).toBeNull();
        });
    });
    describe('healthCheck', () => {
        it('should return true when configuration is valid', () => {
            const isHealthy = configService.healthCheck();
            expect(isHealthy).toBe(true);
        });
        it('should return false when configuration validation fails', () => {
            delete process.env.NEO4J_URI;
            const configServiceInvalid = new ConfigService_1.ConfigService();
            const isHealthy = configServiceInvalid.healthCheck();
            expect(isHealthy).toBe(false);
        });
    });
});
//# sourceMappingURL=ConfigService.test.js.map