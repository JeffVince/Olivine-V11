"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentResolvers = void 0;
const QueueService_1 = require("../../services/queues/QueueService");
exports.agentResolvers = {
    Query: {
        agentJobs: async (_, args, context) => {
            const { orgId, status, type, limit = 50, offset = 0 } = args;
            if (context.user.orgId !== orgId) {
                throw new Error('Unauthorized access to organization data');
            }
            const jobs = [];
            return jobs.map((job) => ({
                id: job.id,
                orgId: job.data.orgId,
                type: job.data.type || job.name,
                target: job.data.target || job.data.resourcePath || '',
                status: job.opts.delay ? 'delayed' :
                    job.finishedOn ? (job.failedReason ? 'failed' : 'completed') :
                        job.processedOn ? 'active' : 'waiting',
                priority: job.opts.priority || 0,
                attemptsMade: job.attemptsMade || 0,
                retries: job.opts.attempts || 0,
                worker: job.processedBy,
                startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
                finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
                durationMs: job.finishedOn && job.processedOn ?
                    job.finishedOn - job.processedOn : undefined,
                params: job.data
            }));
        },
        agentHealth: async (_, args, context) => {
            const { orgId } = args;
            if (context.user.orgId !== orgId) {
                throw new Error('Unauthorized access to organization data');
            }
            const runningAgents = [];
            const allCriticalRunning = false;
            return {
                status: allCriticalRunning ? 'ok' : 'degraded',
                agents: runningAgents.map((agent) => agent.name)
            };
        },
        queues: async (_, args, context) => {
            const { orgId } = args;
            if (context.user.orgId !== orgId) {
                throw new Error('Unauthorized access to organization data');
            }
            const queueNames = ['file-sync', 'file-classification', 'provenance', 'content-extraction'];
            const stats = queueNames.map((name) => ({
                name,
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0
            }));
            return stats;
        }
    },
    Mutation: {
        enqueueAgentJob: async (_, args, context) => {
            const { orgId, type, target, params, priority = 0 } = args.input;
            if (context.user.orgId !== orgId) {
                throw new Error('Unauthorized access to organization data');
            }
            const queueMap = {
                'file-sync': 'file-sync',
                'file-classification': 'file-classification',
                'content-extraction': 'content-extraction',
                'provenance': 'provenance'
            };
            const queueName = queueMap[type] || 'file-sync';
            const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            return {
                id: jobId,
                type,
                status: 'waiting'
            };
        },
        cancelAgentJob: async (_, args, context) => {
            const { orgId, id } = args;
            if (context.user.orgId !== orgId) {
                throw new Error('Unauthorized access to organization data');
            }
            try {
                console.log(`Cancelling job ${id} for org ${orgId}`);
                return true;
            }
            catch (error) {
                console.error('Failed to cancel job:', error);
                return false;
            }
        }
    },
    Subscription: {
        jobUpdated: {
            subscribe: async (_, args, context) => {
                const { orgId } = args;
                if (context.user.orgId !== orgId) {
                    throw new Error('Unauthorized access to organization data');
                }
                const queueService = QueueService_1.QueueService.getInstance();
                return queueService.subscribeToJobUpdates(orgId);
            }
        }
    }
};
//# sourceMappingURL=AgentResolvers.js.map