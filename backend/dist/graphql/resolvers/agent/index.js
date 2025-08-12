"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentResolvers = buildAgentResolvers;
const jobs_1 = require("./jobs");
const health_1 = require("./health");
function buildAgentResolvers(queueService) {
    const jobs = (0, jobs_1.buildAgentJobResolvers)(queueService);
    const health = (0, health_1.buildHealthResolvers)(queueService);
    return {
        Query: {
            ...(jobs.Query || {}),
            ...(health.Query || {}),
        },
        Mutation: {
            ...(jobs.Mutation || {}),
        },
        Subscription: {
            ...(jobs.Subscription || {}),
        },
    };
}
//# sourceMappingURL=index.js.map