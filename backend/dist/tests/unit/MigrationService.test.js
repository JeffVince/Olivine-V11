"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const MigrationService_1 = require("../../services/MigrationService");
const Neo4jService_1 = require("../../services/Neo4jService");
const PostgresService_1 = require("../../services/PostgresService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
jest.mock('../../services/Neo4jService');
jest.mock('../../services/PostgresService');
jest.mock('fs');
describe('MigrationService', () => {
    let migrationService;
    let mockNeo4jService;
    let mockPostgresService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockNeo4jService = new Neo4jService_1.Neo4jService();
        mockPostgresService = new PostgresService_1.PostgresService();
        mockNeo4jService.executeQuery = jest.fn();
        mockNeo4jService.healthCheck = jest.fn().mockResolvedValue(true);
        mockNeo4jService.close = jest.fn().mockResolvedValue(undefined);
        mockPostgresService.executeQuery = jest.fn();
        mockPostgresService.healthCheck = jest.fn().mockResolvedValue(true);
        mockPostgresService.close = jest.fn().mockResolvedValue(undefined);
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync
            .mockReturnValueOnce(['001_test_migration.cypher', '002_test_migration.cypher'])
            .mockReturnValueOnce(['001_test_migration.sql', '002_test_migration.sql']);
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.endsWith('.cypher')) {
                return 'MATCH (n) RETURN n; MATCH (m) RETURN m;';
            }
            else if (filePath.endsWith('.sql')) {
                return 'SELECT * FROM users; CREATE TABLE test (id SERIAL PRIMARY KEY);';
            }
            return '';
        });
        migrationService = new MigrationService_1.MigrationService();
        migrationService.neo4jService = mockNeo4jService;
        migrationService.postgresService = mockPostgresService;
    });
    describe('applyAllMigrations', () => {
        it('should apply both Neo4j and PostgreSQL migrations', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.applyAllMigrations();
            expect(consoleLogSpy).toHaveBeenCalledWith('Applying all pending migrations...');
            expect(consoleLogSpy).toHaveBeenCalledWith('All migrations applied successfully!');
            consoleLogSpy.mockRestore();
        });
    });
    describe('applyNeo4jMigrations', () => {
        it('should read and execute Neo4j migration files', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.applyNeo4jMigrations();
            expect(fs.existsSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j'));
            expect(fs.readdirSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j'));
            expect(fs.readFileSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j/001_test_migration.cypher'), 'utf8');
            expect(fs.readFileSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j/002_test_migration.cypher'), 'utf8');
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledTimes(4);
            consoleLogSpy.mockRestore();
        });
        it('should handle case when Neo4j migrations directory does not exist', async () => {
            fs.existsSync.mockImplementation((dirPath) => {
                return !dirPath.includes('neo4j');
            });
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.applyNeo4jMigrations();
            expect(consoleLogSpy).toHaveBeenCalledWith('No Neo4j migrations directory found');
            consoleLogSpy.mockRestore();
        });
    });
    describe('applyPostgresMigrations', () => {
        it('should read and execute PostgreSQL migration files', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.applyPostgresMigrations();
            expect(fs.existsSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres'));
            expect(fs.readdirSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres'));
            expect(fs.readFileSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres/001_test_migration.sql'), 'utf8');
            expect(fs.readFileSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres/002_test_migration.sql'), 'utf8');
            expect(mockPostgresService.executeQuery).toHaveBeenCalledTimes(4);
            consoleLogSpy.mockRestore();
        });
        it('should handle case when PostgreSQL migrations directory does not exist', async () => {
            fs.existsSync.mockImplementation((dirPath) => {
                return !dirPath.includes('postgres');
            });
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.applyPostgresMigrations();
            expect(consoleLogSpy).toHaveBeenCalledWith('No PostgreSQL migrations directory found');
            consoleLogSpy.mockRestore();
        });
        it('should skip duplicate policy errors', async () => {
            fs.readdirSync
                .mockReturnValueOnce([])
                .mockReturnValueOnce(['001_policy_migration.sql']);
            fs.readFileSync.mockImplementation((filePath) => {
                if (filePath.endsWith('001_policy_migration.sql')) {
                    return 'CREATE POLICY test_policy ON test_table;\nSELECT * FROM test_table;';
                }
                return '';
            });
            mockPostgresService.executeQuery
                .mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] })
                .mockRejectedValueOnce(new Error('already exists'))
                .mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] });
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.applyPostgresMigrations();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Policy already exists, skipping'));
            consoleLogSpy.mockRestore();
        });
    });
    describe('createMigrationDirectories', () => {
        it('should create migration directories if they do not exist', async () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValueOnce([]).mockReturnValueOnce([]);
            fs.mkdirSync.mockReturnValue(undefined);
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await migrationService.createMigrationDirectories();
            expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/neo4j'), { recursive: true });
            expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(__dirname, '../../migrations/postgres'), { recursive: true });
            expect(consoleLogSpy).toHaveBeenCalledWith('Created Neo4j migrations directory');
            expect(consoleLogSpy).toHaveBeenCalledWith('Created PostgreSQL migrations directory');
            consoleLogSpy.mockRestore();
        });
    });
    describe('healthCheck', () => {
        it('should return true when both services are healthy', async () => {
            mockNeo4jService.healthCheck.mockResolvedValue(true);
            mockPostgresService.healthCheck.mockResolvedValue(true);
            const isHealthy = await migrationService.healthCheck();
            expect(isHealthy).toBe(true);
            expect(mockNeo4jService.healthCheck).toHaveBeenCalled();
            expect(mockPostgresService.healthCheck).toHaveBeenCalled();
        });
        it('should return false when Neo4j service is not healthy', async () => {
            mockNeo4jService.healthCheck.mockResolvedValue(false);
            mockPostgresService.healthCheck.mockResolvedValue(true);
            const isHealthy = await migrationService.healthCheck();
            expect(isHealthy).toBe(false);
        });
        it('should return false when PostgreSQL service is not healthy', async () => {
            mockNeo4jService.healthCheck.mockResolvedValue(true);
            mockPostgresService.healthCheck.mockResolvedValue(false);
            const isHealthy = await migrationService.healthCheck();
            expect(isHealthy).toBe(false);
        });
        it('should handle errors during health check', async () => {
            mockNeo4jService.healthCheck.mockRejectedValue(new Error('Health check failed'));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const isHealthy = await migrationService.healthCheck();
            expect(isHealthy).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Migration service health check failed:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });
    describe('close', () => {
        it('should close both Neo4j and PostgreSQL connections', async () => {
            await migrationService.close();
            expect(mockNeo4jService.close).toHaveBeenCalled();
            expect(mockPostgresService.close).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=MigrationService.test.js.map