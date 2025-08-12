"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapBullJob = mapBullJob;
function mapBullJob(job) {
    return {
        id: job.id,
        orgId: job.data?.orgId,
        type: job.name,
        target: job.data?.target,
        status: job.finishedOn ? 'completed' : job.failedReason ? 'failed' : job.processedOn ? 'active' : 'queued',
        priority: job.opts?.priority,
        attemptsMade: job.attemptsMade,
        retries: job.opts?.attempts ?? 0,
        worker: job?.processedOn ? String(job?.processedOn) : null,
        startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
        params: job.data?.params ?? null,
    };
}
//# sourceMappingURL=JobMapper.js.map