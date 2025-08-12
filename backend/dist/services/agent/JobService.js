"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobService = void 0;
const PubSub_1 = require("../graphql/PubSub");
const JobMapper_1 = require("./JobMapper");
class JobService {
    constructor(queueService) {
        this.queueService = queueService;
    }
    async listAgentJobs(filter = {}) {
        const queue = this.queueService.getQueue('agent-jobs');
        const limit = filter.limit ?? 50;
        const offset = filter.offset ?? 0;
        const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'], offset, offset + limit - 1, false);
        return jobs
            .filter((j) => (filter.type ? j.name === filter.type : true))
            .map(JobMapper_1.mapBullJob);
    }
    async getAgentJob(id) {
        const queue = this.queueService.getQueue('agent-jobs');
        const job = await queue.getJob(id);
        return job ? (0, JobMapper_1.mapBullJob)(job) : null;
    }
    async enqueueAgentJob(input) {
        const queue = this.queueService.getQueue('agent-jobs');
        const job = await queue.add(input.type, input, { priority: input.priority ?? 5 });
        const mapped = (0, JobMapper_1.mapBullJob)(job);
        await PubSub_1.pubsub.publish(PubSub_1.TOPICS.JobUpdated, { jobUpdated: mapped });
        return mapped;
    }
    async cancelAgentJob(id) {
        const queue = this.queueService.getQueue('agent-jobs');
        const job = await queue.getJob(id);
        if (!job)
            return false;
        await job.remove();
        return true;
    }
    async getQueueStats() {
        const queues = [
            'agent-jobs',
            'file-sync',
            'file-classification',
            'content-extraction',
            'provenance',
        ];
        const stats = [];
        for (const name of queues) {
            const q = this.queueService.getQueue(name);
            const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
            stats.push({ name, waiting: counts.waiting, active: counts.active, completed: counts.completed, failed: counts.failed, delayed: counts.delayed });
        }
        return stats;
    }
}
exports.JobService = JobService;
//# sourceMappingURL=JobService.js.map