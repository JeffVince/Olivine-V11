"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const Neo4jService_1 = require("./Neo4jService");
const PostgresService_1 = require("./PostgresService");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class MigrationService {
    constructor() {
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.migrationsDir = path_1.default.join(__dirname, '../migrations');
    }
    async applyAllMigrations() {
        console.log('Applying all pending migrations...');
        await this.applyNeo4jMigrations();
        await this.applyPostgresMigrations();
        console.log('All migrations applied successfully!');
    }
    async applyNeo4jMigrations() {
        const neo4jMigrationsDir = path_1.default.join(this.migrationsDir, 'neo4j');
        if (!fs_1.default.existsSync(neo4jMigrationsDir)) {
            console.log('No Neo4j migrations directory found');
            return;
        }
        const migrationFiles = fs_1.default.readdirSync(neo4jMigrationsDir)
            .filter(file => file.endsWith('.cypher'))
            .sort();
        for (const file of migrationFiles) {
            const migrationPath = path_1.default.join(neo4jMigrationsDir, file);
            const migrationContent = fs_1.default.readFileSync(migrationPath, 'utf8');
            const cleanedContent = migrationContent
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            const statements = cleanedContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
            console.log(`Applying Neo4j migration: ${file} with ${statements.length} statements`);
            for (const statement of statements) {
                if (statement.trim().length > 0) {
                    await this.neo4jService.executeWriteQuery(statement);
                }
            }
        }
    }
    async applyPostgresMigrations() {
        const postgresMigrationsDir = path_1.default.join(this.migrationsDir, 'postgres');
        if (!fs_1.default.existsSync(postgresMigrationsDir)) {
            console.log('No PostgreSQL migrations directory found');
            return;
        }
        const migrationFiles = fs_1.default.readdirSync(postgresMigrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        for (const file of migrationFiles) {
            const migrationPath = path_1.default.join(postgresMigrationsDir, file);
            const migrationContent = fs_1.default.readFileSync(migrationPath, 'utf8');
            const statements = migrationContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
            console.log(`Applying PostgreSQL migration: ${file} with ${statements.length} statements`);
            for (const statement of statements) {
                if (statement.trim().length > 0) {
                    try {
                        await this.postgresService.executeQuery(statement);
                    }
                    catch (error) {
                        if (statement.trim().toUpperCase().startsWith('CREATE POLICY') &&
                            ((typeof error === 'object' && error !== null && 'message' in error && error.message.toLowerCase().includes('already exists')) ||
                                (typeof error === 'object' && error !== null && 'message' in error && error.message.toLowerCase().includes('duplicate')) ||
                                (typeof error === 'object' && error !== null && 'code' in error && String(error.code) === '42710'))) {
                            console.log('Policy already exists, skipping');
                        }
                        else {
                            throw error;
                        }
                    }
                }
            }
        }
    }
    async createMigrationDirectories() {
        const neo4jMigrationsDir = path_1.default.join(this.migrationsDir, 'neo4j');
        const postgresMigrationsDir = path_1.default.join(this.migrationsDir, 'postgres');
        if (!fs_1.default.existsSync(neo4jMigrationsDir)) {
            fs_1.default.mkdirSync(neo4jMigrationsDir, { recursive: true });
            console.log('Created Neo4j migrations directory');
        }
        if (!fs_1.default.existsSync(postgresMigrationsDir)) {
            fs_1.default.mkdirSync(postgresMigrationsDir, { recursive: true });
            console.log('Created PostgreSQL migrations directory');
        }
    }
    async healthCheck() {
        try {
            const neo4jHealthy = await this.neo4jService.healthCheck();
            const postgresHealthy = await this.postgresService.healthCheck();
            return neo4jHealthy && postgresHealthy;
        }
        catch (error) {
            console.error('Migration service health check failed:', error);
            return false;
        }
    }
    async close() {
        await this.neo4jService.close();
        await this.postgresService.close();
    }
}
exports.MigrationService = MigrationService;
//# sourceMappingURL=MigrationService.js.map