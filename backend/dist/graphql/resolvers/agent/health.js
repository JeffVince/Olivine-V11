"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHealthResolvers = buildHealthResolvers;
const Neo4jService_1 = require("../../../services/Neo4jService");
function buildHealthResolvers(queueService) {
    const neo4j = new Neo4jService_1.Neo4jService();
    return {
        Query: {
            agentHealth: async () => {
                const redisOk = await queueService.ping().then(() => true).catch(() => false);
                const neo4jOk = await neo4j.healthCheck();
                return {
                    status: redisOk && neo4jOk ? 'ok' : 'degraded',
                    agents: ['file-steward-agent', 'taxonomy-classification-agent', 'provenance-tracking-agent', 'sync-agent'],
                };
            },
        },
    };
}
//# sourceMappingURL=health.js.map