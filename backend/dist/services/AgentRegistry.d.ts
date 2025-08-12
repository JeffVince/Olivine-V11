import { BaseAgent } from '../agents/BaseAgent';
export declare class AgentRegistry {
    private static instance;
    private agents;
    private logger;
    private queueService;
    private constructor();
    static getInstance(): AgentRegistry;
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
    getAgentStatus(): {
        [key: string]: boolean;
    };
    performHealthCheck(): Promise<{
        healthy: boolean;
        agents: {
            [key: string]: {
                running: boolean;
                error?: string;
            };
        };
    }>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=AgentRegistry.d.ts.map