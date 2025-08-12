"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalTeardown;
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const QueueService_1 = require("../services/queues/QueueService");
async function globalTeardown() {
    console.log('🧹 Tearing down global test environment...');
    try {
        const neo4jService = new Neo4jService_1.Neo4jService();
        const postgresService = new PostgresService_1.PostgresService();
        const queueService = new QueueService_1.QueueService();
        await neo4jService.connect();
        await postgresService.connect();
        await queueService.connect();
        console.log('🗑️ Cleaning up test data...');
        await neo4jService.run('MATCH (n) DETACH DELETE n');
        await queueService.clearAllQueues();
        await neo4jService.close();
        await postgresService.close();
        await queueService.close();
        console.log('✅ Global test teardown completed successfully');
    }
    catch (error) {
        console.error('❌ Global test teardown failed:', error);
    }
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}
//# sourceMappingURL=globalTeardown.js.map