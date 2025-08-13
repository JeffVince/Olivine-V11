import { BaseAgent } from '../agents/BaseAgent';
import { CrossLayerEnforcementService } from './CrossLayerEnforcementService';
import { QueueService } from './queues/QueueService';
import { Neo4jService } from './Neo4jService';
import { PostgresService } from './PostgresService';
export declare class AgentRegistry {
    private static instance;
    private agents;
    private crossLayerService;
    private logger;
    private queueService;
    private neo4jService;
    private postgresService;
    private clusterMode;
    constructor(queueService?: QueueService, crossLayerService?: CrossLayerEnforcementService);
    static getInstance(): AgentRegistry;
    setServices(neo4jService: Neo4jService, postgresService: PostgresService, queueService: QueueService): void;
    initializeAgents(): Promise<void>;
    registerAgent(name: string, agent: BaseAgent): void;
    startAllAgents(): Promise<void>;
    stopAllAgents(): Promise<void>;
    startAgent(name: string): Promise<void>;
    stopAgent(name: string): Promise<void>;
    pauseAgent(name: string): Promise<void>;
    resumeAgent(name: string): Promise<void>;
    getAllAgents(): BaseAgent[];
    getActiveAgents(): BaseAgent[];
    getAgent(name: string): BaseAgent | undefined;
    getRegisteredAgents(): string[];
    getHealthStatus(): {
        healthy: boolean;
        agents: Record<string, boolean>;
    };
    validateCrossLayerLinks(orgId: string): Promise<void>;
    performHealthCheck(): Promise<{
        healthy: boolean;
        agents: Record<string, {
            healthy: boolean;
            error?: string;
        }>;
    }>;
    shutdown(): Promise<void>;
    disableClusterMode(): void;
}
//# sourceMappingURL=AgentRegistry.d.ts.map