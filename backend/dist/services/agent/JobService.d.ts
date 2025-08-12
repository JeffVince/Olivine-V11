import { QueueService } from '../queues/QueueService';
export type ListFilter = {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
};
export declare class JobService {
    private readonly queueService;
    constructor(queueService: QueueService);
    listAgentJobs(filter?: ListFilter): Promise<{
        id: any;
        orgId: any;
        type: any;
        target: any;
        status: string;
        priority: any;
        attemptsMade: any;
        retries: any;
        worker: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        durationMs: number | null;
        params: any;
    }[]>;
    getAgentJob(id: string): Promise<{
        id: any;
        orgId: any;
        type: any;
        target: any;
        status: string;
        priority: any;
        attemptsMade: any;
        retries: any;
        worker: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        durationMs: number | null;
        params: any;
    } | null>;
    enqueueAgentJob(input: {
        orgId: string;
        type: string;
        target?: string;
        priority?: number;
        params?: any;
    }): Promise<{
        id: any;
        orgId: any;
        type: any;
        target: any;
        status: string;
        priority: any;
        attemptsMade: any;
        retries: any;
        worker: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        durationMs: number | null;
        params: any;
    }>;
    cancelAgentJob(id: string): Promise<boolean>;
    getQueueStats(): Promise<{
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }[]>;
}
//# sourceMappingURL=JobService.d.ts.map