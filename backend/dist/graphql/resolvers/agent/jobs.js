"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentJobResolvers = buildAgentJobResolvers;
const JobService_1 = require("../../../services/agent/JobService");
const RunbookService_1 = require("../../../services/agent/RunbookService");
const PubSub_1 = require("../../../services/graphql/PubSub");
function buildAgentJobResolvers(queueService) {
    const jobService = new JobService_1.JobService(queueService);
    const runbookService = new RunbookService_1.RunbookService();
    return {
        Query: {
            agentJobs: async (_, args) => jobService.listAgentJobs({ status: args.status, type: args.type, limit: args.limit, offset: args.offset }),
            agentJob: async (_, args) => jobService.getAgentJob(args.id),
            runbooks: async (_, args) => runbookService.list(args.orgId),
            queues: async () => jobService.getQueueStats(),
            agentHealth: async () => {
                return {
                    status: 'ok',
                    agents: ['file-steward-agent', 'taxonomy-classification-agent', 'provenance-tracking-agent', 'sync-agent'],
                };
            },
        },
        Mutation: {
            enqueueAgentJob: async (_, { input }) => {
                const job = await jobService.enqueueAgentJob(input);
                await PubSub_1.pubsub.publish(PubSub_1.TOPICS.JobUpdated, { jobUpdated: job });
                return job;
            },
            cancelAgentJob: async (_, { id }) => jobService.cancelAgentJob(id),
            saveRunbook: async (_, { input }) => runbookService.save(input),
            executeRunbook: async (_, { orgId, id, params }) => jobService.enqueueAgentJob({ orgId, type: 'custom', target: id, params }),
        },
        Subscription: {
            jobUpdated: {
                subscribe: () => PubSub_1.pubsub.asyncIterator([PubSub_1.TOPICS.JobUpdated]),
            },
            jobLogAppended: {
                subscribe: () => PubSub_1.pubsub.asyncIterator([PubSub_1.TOPICS.JobLogAppended]),
            },
        },
    };
}
//# sourceMappingURL=jobs.js.map