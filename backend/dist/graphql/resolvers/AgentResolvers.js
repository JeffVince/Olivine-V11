"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentResolvers = void 0;
const QueueService_1 = require("../../services/queues/QueueService");
const JobService_1 = require("../../services/agent/JobService");
exports.agentResolvers = {
    Query: {
        agentJobs: async (_, args, context) => {
            const { organizationId, status, type, limit = 50, offset = 0 } = args;
            if (context.user.organizationId !== organizationId) {
                throw new Error('Unauthorized access to organization jobs');
            }
            const jobService = new JobService_1.JobService(new QueueService_1.QueueService());
            const jobs = await jobService.listAgentJobs({ status, type, limit, offset });
            return jobs.map((job) => ({
                id: job.id,
                organizationId: job.data.organizationId,
                type: job.name,
                target: job.data.target || job.data.sceneId || job.data.characterId || job.data.projectId,
                status: job.status,
                priority: job.priority,
                attemptsMade: job.attemptsMade,
                retries: job.opts.attempts - job.attemptsMade - 1,
                worker: job.progress?.worker,
                startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
                finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
                durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
                params: job.data.params || {}
            }));
        },
        agentHealth: async (_, args, context) => {
            const { organizationId } = args;
            if (context.user.organizationId !== organizationId) {
                throw new Error('Unauthorized access to organization health');
            }
            return { status: 'ok', agents: [] };
        },
        queues: async (_, args, context) => {
            const { organizationId } = args;
            if (context.user.organizationId !== organizationId) {
                throw new Error('Unauthorized access to organization queues');
            }
            const jobService = new JobService_1.JobService(new QueueService_1.QueueService());
            return await jobService.getQueueStats();
        }
    },
    Mutation: {
        enqueueAgentJob: async (_, args, context) => {
            const { organizationId, type, target, params, priority = 0 } = args.input;
            if (context.user.organizationId !== organizationId) {
                throw new Error('Unauthorized access to organization jobs');
            }
            const jobService = new JobService_1.JobService(new QueueService_1.QueueService());
            const job = await jobService.enqueueAgentJob({ orgId: organizationId, type, target, params, priority });
            return { id: job.id, success: true };
        },
        cancelAgentJob: async (_, args, context) => {
            const { organizationId, id } = args;
            if (context.user.organizationId !== organizationId) {
                throw new Error('Unauthorized access to organization jobs');
            }
            const jobService = new JobService_1.JobService(new QueueService_1.QueueService());
            console.log(`Cancelling job ${id} for org ${organizationId}`);
            return await jobService.cancelAgentJob(id);
        }
    },
    Subscription: {
        jobUpdated: {
            subscribe: async (_, args, context) => {
                const { organizationId } = args;
                if (context.user.organizationId !== organizationId) {
                    throw new Error('Unauthorized access to organization job updates');
                }
                const queueService = new QueueService_1.QueueService();
                return queueService.subscribeToJobUpdates(organizationId);
            }
        }
    }
};
//# sourceMappingURL=AgentResolvers.js.map