export interface Job {
    id: string;
    data: unknown;
    priority: number;
    createdAt: string;
    status: string;
}
export declare class QueueService {
    private redis;
    private subscriber;
    constructor();
    addJob(queueName: string, jobData: unknown, priority?: number): Promise<string>;
    processQueue(queueName: string, processor: (job: unknown) => Promise<void>, concurrency?: number): Promise<void>;
    private createWorker;
    private updateJob;
    getQueueStats(queueName: string): Promise<Record<string, unknown>>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
    private generateJobId;
}
//# sourceMappingURL=QueueService.d.ts.map