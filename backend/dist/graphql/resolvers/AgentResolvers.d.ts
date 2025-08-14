interface AgentJob {
    id: string;
    orgId: string;
    type: string;
    target: string;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
    priority: number;
    attemptsMade: number;
    retries: number;
    worker?: string;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
    params: any;
}
interface AgentHealthStatus {
    status: 'ok' | 'degraded' | 'unknown';
    agents: string[];
}
interface QueueStats {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}
export declare const agentResolvers: {
    Query: {
        agentJobs: (_: any, args: {
            orgId: string;
            status?: string;
            type?: string;
            limit?: number;
            offset?: number;
        }, context: any) => Promise<AgentJob[]>;
        agentHealth: (_: any, args: {
            orgId: string;
        }, context: any) => Promise<AgentHealthStatus>;
        queues: (_: any, args: {
            orgId: string;
        }, context: any) => Promise<QueueStats[]>;
    };
    Mutation: {
        enqueueAgentJob: (_: any, args: {
            input: {
                orgId: string;
                type: string;
                target: string;
                params: any;
                priority?: number;
            };
        }, context: any) => Promise<{
            id: any;
            success: boolean;
        }>;
        cancelAgentJob: (_: any, args: {
            orgId: string;
            id: string;
        }, context: any) => Promise<boolean>;
    };
    Subscription: {
        jobUpdated: {
            subscribe: (_: any, args: {
                orgId: string;
            }, context: any) => Promise<AsyncIterableIterator<any>>;
        };
    };
};
export {};
//# sourceMappingURL=AgentResolvers.d.ts.map