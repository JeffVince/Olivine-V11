export declare class QueueService {
    private redis;
    private subscriber;
    constructor();
    addJob(queueName: string, jobData: any, priority?: number): Promise<string>;
    processQueue(queueName: string, processor: (job: any) => Promise<void>, concurrency?: number): Promise<void>;
    private createWorker;
    private updateJob;
    getQueueStats(queueName: string): Promise<any>;
    healthCheck(): Promise<boolean>;
    close(): Promise<void>;
    private generateJobId;
}
//# sourceMappingURL=QueueService.d.ts.map