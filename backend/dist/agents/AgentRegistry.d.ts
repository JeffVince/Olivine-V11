import { BaseAgent, AgentConfig } from './BaseAgent';
import { QueueService } from '../services/queues/QueueService';
import { EventEmitter } from 'events';
export interface AgentMetadata {
    id: string;
    name: string;
    type: string;
    status: 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
    instance: BaseAgent;
    config: Partial<AgentConfig>;
    startedAt?: Date;
    lastHeartbeat?: Date;
    errorCount: number;
    processingStats: {
        jobsProcessed: number;
        jobsSucceeded: number;
        jobsFailed: number;
        avgProcessingTime: number;
    };
}
export interface AgentDiscovery {
    registeredAgents: string[];
    activeAgents: string[];
    availableAgents: string[];
    systemHealth: 'healthy' | 'degraded' | 'critical';
}
export declare class AgentRegistry extends EventEmitter {
    private agents;
    private queueService;
    private neo4jService;
    private postgresService;
    private logger;
    private heartbeatInterval?;
    private healthCheckInterval?;
    private scalingCheckInterval?;
    constructor();
    initialize(): Promise<void>;
    private registerCoreAgents;
    registerAgent(agentType: string, AgentClass: new (queueService: QueueService, config?: Partial<AgentConfig>) => BaseAgent, config?: Partial<AgentConfig>): Promise<string>;
    startAgent(agentId: string): Promise<void>;
    stopAgent(agentId: string): Promise<void>;
    pauseAgent(agentId: string): Promise<void>;
    resumeAgent(agentId: string): Promise<void>;
    restartAgent(agentId: string): Promise<void>;
    removeAgent(agentId: string): Promise<void>;
    getAgentDiscovery(): AgentDiscovery;
    getAgent(agentId: string): AgentMetadata | null;
    getAllAgents(): AgentMetadata[];
    getAgentsByType(agentType: string): AgentMetadata[];
    getSystemStats(): any;
    private setupAgentListeners;
    private startHeartbeatMonitoring;
    private startHealthChecking;
    private startScalingMonitoring;
    shutdown(): Promise<void>;
}
export declare const agentRegistry: AgentRegistry;
//# sourceMappingURL=AgentRegistry.d.ts.map