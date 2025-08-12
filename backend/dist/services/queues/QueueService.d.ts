import { Queue, Worker, JobsOptions, Processor, WorkerOptions, Job, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';
export type SupportedQueueName = 'file-sync' | 'file-classification' | 'content-extraction' | 'provenance' | 'agent-jobs' | 'create-commit' | 'create-action' | 'create-version' | 'webhook-events' | 'source-sync' | 'delta-sync';
export interface QueueServiceConfig {
    redisUrl: string;
    prefix?: string;
}
export declare class QueueService {
    private static instance;
    readonly connection: Redis;
    private readonly queues;
    private readonly queueEvents;
    private readonly prefix;
    constructor(config?: QueueServiceConfig);
    getQueue(name: SupportedQueueName): Queue;
    ping(): Promise<string>;
    addJob<T = any>(name: SupportedQueueName, jobName: string, data: T, options?: JobsOptions): Promise<Job<T, any>>;
    registerWorker<T = any, R = any>(name: SupportedQueueName, processor: Processor<T, R>, options?: WorkerOptions): Worker<T, R>;
    getQueueEvents(name: SupportedQueueName): QueueEvents;
    static getInstance(config?: QueueServiceConfig): QueueService;
    connect(): Promise<void>;
    close(): Promise<void>;
    subscribeToJobUpdates(orgId: string): AsyncIterableIterator<any>;
    private ensureQueue;
    private fullQueueName;
}
//# sourceMappingURL=QueueService.d.ts.map