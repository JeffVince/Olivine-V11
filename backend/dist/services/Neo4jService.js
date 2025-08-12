"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Neo4jService = void 0;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const neo4j_1 = require("../config/neo4j");
class Neo4jService {
    constructor() {
        this.config = (0, neo4j_1.getNeo4jConfig)();
        this.driver = neo4j_driver_1.default.driver(this.config.uri, neo4j_driver_1.default.auth.basic(this.config.user, this.config.password), {
            maxConnectionPoolSize: this.config.maxConnectionPoolSize,
            connectionTimeout: this.config.connectionTimeout,
            encrypted: this.config.encrypted ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF'
        });
    }
    getSession(orgId) {
        return this.driver.session({
            database: 'neo4j',
            defaultAccessMode: 'READ'
        });
    }
    async run(query, params = {}) {
        return this.executeQuery(query, params);
    }
    async executeQuery(query, params = {}, orgId) {
        const session = this.driver.session({
            database: 'neo4j',
            defaultAccessMode: 'READ'
        });
        try {
            if (orgId) {
                params.orgId = orgId;
            }
            const result = await session.run(query, params);
            return result;
        }
        catch (error) {
            console.error('Error executing Neo4j query:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    async executeQueryInTransaction(query, params = {}, orgId) {
        const session = this.getSession();
        try {
            const result = await session.executeWrite(tx => tx.run(query, params));
            return result;
        }
        finally {
            await session.close();
        }
    }
    async executeWriteQuery(query, params = {}, orgId) {
        const session = this.driver.session({
            database: 'neo4j',
            defaultAccessMode: 'WRITE'
        });
        try {
            if (orgId) {
                params.orgId = orgId;
            }
            const result = await session.run(query, params);
            return result;
        }
        catch (error) {
            console.error('Error executing Neo4j write query:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    async executeTransaction(queries, orgId) {
        const session = this.driver.session({
            database: 'neo4j',
            defaultAccessMode: 'WRITE'
        });
        const results = [];
        let tx = null;
        try {
            tx = await session.beginTransaction();
            for (const { query, params = {} } of queries) {
                const result = await tx.run(query, params);
                results.push(result.records);
            }
            await tx.commit();
            return results;
        }
        catch (error) {
            if (tx) {
                await tx.rollback();
            }
            console.error('Error executing Neo4j transaction:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    async executeBatch(queries, paramsArray = [], orgId) {
        const session = this.driver.session({
            database: 'neo4j',
            defaultAccessMode: 'WRITE'
        });
        const results = [];
        let tx = null;
        try {
            tx = await session.beginTransaction();
            for (let i = 0; i < queries.length; i++) {
                const params = paramsArray[i] || {};
                if (orgId) {
                    params.orgId = orgId;
                }
                const result = await tx.run(queries[i], params);
                results.push(result.records);
            }
            await tx.commit();
            return results;
        }
        catch (error) {
            if (tx) {
                await tx.rollback();
            }
            console.error('Error executing Neo4j batch operations:', error);
            throw error;
        }
        finally {
            await session.close();
        }
    }
    async healthCheck() {
        try {
            await this.driver.verifyConnectivity();
            return true;
        }
        catch (error) {
            console.error('Neo4j health check failed:', error);
            return false;
        }
    }
    async connect() {
        await this.driver.verifyConnectivity();
    }
    async close() {
        await this.driver.close();
    }
}
exports.Neo4jService = Neo4jService;
//# sourceMappingURL=Neo4jService.js.map