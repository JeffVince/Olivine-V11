import { QueueService } from '../../../services/queues/QueueService';
export declare function buildAgentJobResolvers(queueService: QueueService): {
    Query: {
        agentJobs: (_: any, args: any) => Promise<{
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
        agentJob: (_: any, args: any) => Promise<{
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
        runbooks: (_: any, args: any) => Promise<import("../../../services/agent/RunbookService").Runbook[]>;
        queues: () => Promise<{
            name: string;
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
        }[]>;
        agentHealth: () => Promise<{
            status: string;
            agents: string[];
        }>;
    };
    Mutation: {
        enqueueAgentJob: (_: any, { input }: any) => Promise<{
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
        cancelAgentJob: (_: any, { id }: any) => Promise<boolean>;
        saveRunbook: (_: any, { input }: any) => Promise<import("../../../services/agent/RunbookService").Runbook>;
        executeRunbook: (_: any, { orgId, id, params }: any) => Promise<{
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
    };
    Subscription: {
        jobUpdated: {
            subscribe: () => AsyncIterator<unknown, any, any>;
        };
        jobLogAppended: {
            subscribe: () => AsyncIterator<unknown, any, any>;
        };
    };
};
//# sourceMappingURL=jobs.d.ts.map