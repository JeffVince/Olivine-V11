"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbTestUtils = void 0;
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const QueueService_1 = require("../services/queues/QueueService");
const AuthService_1 = require("../services/AuthService");
class DbTestUtils {
    constructor() {
        process.env.NODE_ENV = 'test';
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.queueService = new QueueService_1.QueueService();
        this.authService = new AuthService_1.AuthService();
    }
    async clearNeo4jData() {
        try {
            await this.neo4jService.executeQuery(`
        MATCH (n)
        DETACH DELETE n
      `);
            console.log('Neo4j test data cleared successfully');
        }
        catch (error) {
            console.error('Error clearing Neo4j test data:', error);
            throw error;
        }
    }
    async clearPostgresData() {
        try {
            await this.postgresService.executeQuery(`
        TRUNCATE TABLE organizations, users, sources, files RESTART IDENTITY CASCADE
      `);
            console.log('PostgreSQL test data cleared successfully');
        }
        catch (error) {
            console.error('Error clearing PostgreSQL test data:', error);
            throw error;
        }
    }
    async createTestOrganization(name = 'Test Organization', slug = 'test-org') {
        try {
            const result = await this.postgresService.executeQuery(`INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug`, [name, slug]);
            return result.rows[0];
        }
        catch (error) {
            console.error('Error creating test organization:', error);
            throw error;
        }
    }
    async createTestUser(email, password, orgId, role = 'member') {
        try {
            const passwordHash = await this.authService.hashPassword(password);
            const result = await this.postgresService.executeQuery(`INSERT INTO users (email, password_hash, organization_id, role) VALUES ($1, $2, $3, $4) RETURNING id, email, organization_id, role`, [email, passwordHash, orgId, role]);
            return result.rows[0];
        }
        catch (error) {
            console.error('Error creating test user:', error);
            throw error;
        }
    }
    async healthCheckAll() {
        try {
            const neo4jHealthy = await this.neo4jService.healthCheck();
            const postgresHealthy = await this.postgresService.healthCheck();
            const redisPing = await this.queueService.ping();
            const redisHealthy = redisPing === 'PONG';
            return neo4jHealthy && postgresHealthy && redisHealthy;
        }
        catch (error) {
            console.error('Database services health check failed:', error);
            return false;
        }
    }
    async closeAll() {
        await this.neo4jService.close();
        await this.postgresService.close();
        await this.queueService.close();
        await this.authService.close();
    }
}
exports.DbTestUtils = DbTestUtils;
//# sourceMappingURL=dbTestUtils.js.map