import { QueueService } from '../../../services/queues/QueueService';
export declare function buildHealthResolvers(queueService: QueueService): {
    Query: {
        agentHealth: () => Promise<{
            status: string;
            agents: string[];
        }>;
    };
};
//# sourceMappingURL=health.d.ts.map