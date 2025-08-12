"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueMonitor = void 0;
const PubSub_1 = require("../graphql/PubSub");
const JobMapper_1 = require("../agent/JobMapper");
class QueueMonitor {
    constructor(queueService) {
        this.queueService = queueService;
        this.queues = [
            'agent-jobs',
            'file-sync',
            'file-classification',
            'content-extraction',
            'provenance',
        ];
    }
    start() {
        for (const name of this.queues) {
            const events = this.queueService.getQueueEvents(name);
            const queue = this.queueService.getQueue(name);
            events.on('active', async ({ jobId }) => {
                const job = await queue.getJob(jobId);
                if (job)
                    await PubSub_1.pubsub.publish(PubSub_1.TOPICS.JobUpdated, { jobUpdated: (0, JobMapper_1.mapBullJob)(job) });
            });
            events.on('completed', async ({ jobId }) => {
                const job = await queue.getJob(jobId);
                if (job)
                    await PubSub_1.pubsub.publish(PubSub_1.TOPICS.JobUpdated, { jobUpdated: (0, JobMapper_1.mapBullJob)(job) });
            });
            events.on('failed', async ({ jobId }) => {
                const job = await queue.getJob(jobId);
                if (job)
                    await PubSub_1.pubsub.publish(PubSub_1.TOPICS.JobUpdated, { jobUpdated: (0, JobMapper_1.mapBullJob)(job) });
            });
        }
    }
}
exports.QueueMonitor = QueueMonitor;
//# sourceMappingURL=QueueMonitor.js.map