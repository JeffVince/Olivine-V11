import { QueueService } from './queues/QueueService';
import { Neo4jService } from './Neo4jService';
import { PostgresService } from './PostgresService';
interface AgentTask {
    id: string;
    type: string;
    agent: string;
    priority: number;
    payload: Record<string, unknown>;
    orgId: string;
    userId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    result?: unknown;
    dependencies?: string[];
    retryCount: number;
    maxRetries: number;
}
interface AgentWorkflow {
    id: string;
    name: string;
    description: string;
    steps: Array<{
        agent: string;
        type: string;
        condition?: (context: Record<string, unknown>) => boolean;
        timeout?: number;
        retries?: number;
    }>;
    trigger: {
        event: string;
        conditions?: Record<string, unknown>;
    };
    enabled: boolean;
}
export declare class AgentOrchestrator {
    private agents;
    private workflows;
    private tasks;
    private queueService;
    private provenance;
    private neo4j;
    private postgres;
    private isRunning;
    constructor(queueService: QueueService, neo4jService: Neo4jService, postgresService: PostgresService);
    private initializeAgents;
    private initializeWorkflows;
    start(): Promise<void>;
    stop(): Promise<void>;
    executeWorkflow(workflowId: string, context: Record<string, unknown>, orgId: string, userId: string): Promise<string>;
    createTask(params: {
        type: string;
        agent: string;
        priority: number;
        payload: Record<string, unknown>;
        orgId: string;
        userId: string;
        dependencies?: string[];
        maxRetries?: number;
    }): Promise<string>;
    private processQueue;
    private executeTask;
    private areDependenciesComplete;
    private queueDependentTasks;
    private setupEventListeners;
    private handleEvent;
    private matchesConditions;
    getTaskStatus(taskId: string): AgentTask | undefined;
    getWorkflowStatus(workflowExecutionId: string): {
        results: Map<string, unknown>;
        errors: Map<string, string>;
    } | undefined;
    getStatistics(): {
        tasksByStatus: Record<string, number>;
        tasksByAgent: Record<string, number>;
        totalTasks: number;
        activeWorkflows: number;
        available_agents: string[];
        available_workflows: string[];
        is_running: boolean;
    };
    private generateId;
    startWorkflow(workflow: AgentWorkflow, eventData: Record<string, unknown>): Promise<string>;
    getRegisteredWorkflows(): AgentWorkflow[];
    private sleep;
}
export {};
//# sourceMappingURL=AgentOrchestrator.d.ts.map