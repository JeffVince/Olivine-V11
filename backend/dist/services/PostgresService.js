"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresService = void 0;
const pg_1 = require("pg");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
class PostgresService {
    constructor() {
        const poolConfig = {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB || 'olivine',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'password',
            max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
            idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
            connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000')
        };
        this.pool = new pg_1.Pool(poolConfig);
    }
    async executeQuery(query, params = []) {
        try {
            const result = await this.pool.query(query, params ?? []);
            return result;
        }
        catch (error) {
            console.error('Error executing PostgreSQL query:', error);
            throw error;
        }
    }
    async query(query, params = []) {
        return this.executeQuery(query, params);
    }
    async executeQueryInTransaction(query, params = []) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(query, params);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('Error executing PostgreSQL query in transaction:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async executeBatchInTransaction(queries, paramsArray = []) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const results = [];
            for (let i = 0; i < queries.length; i++) {
                const params = paramsArray[i] || [];
                const result = await client.query(queries[i], params);
                results.push(result);
            }
            await client.query('COMMIT');
            return results;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async executeTransaction(queries) {
        const client = await this.pool.connect();
        const isTestMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test';
        try {
            if (!isTestMode) {
                await client.query('BEGIN');
            }
            const results = [];
            for (const { query, params = [] } of queries) {
                const res = await client.query(query, params);
                results.push(res);
            }
            if (!isTestMode) {
                await client.query('COMMIT');
            }
            return results;
        }
        catch (error) {
            if (!isTestMode) {
                try {
                    await client.query('ROLLBACK');
                }
                catch { }
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
    async healthCheck() {
        try {
            await this.pool.query('SELECT 1');
            return true;
        }
        catch (error) {
            console.error('PostgreSQL health check failed:', error);
            return false;
        }
    }
    async connect() {
        await this.healthCheck();
    }
    async close() {
        await this.pool.end();
    }
}
exports.PostgresService = PostgresService;
//# sourceMappingURL=PostgresService.js.map