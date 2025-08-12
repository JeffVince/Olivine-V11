interface AgentTask {
    id: string;
    type: string;
    agent: string;
    priority: number;
    payload: Record<string, any>;
    orgId: string;
    userId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    result?: any;
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
        condition?: (context: any) => boolean;
        timeout?: number;
        retries?: number;
    }>;
    trigger: {
        event: string;
        conditions?: Record<string, any>;
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
    private isRunning;
    constructor();
    private initializeAgents;
    private initializeWorkflows;
    start(): Promise<void>;
    stop(): Promise<void>;
    executeWorkflow(workflowId: string, context: Record<string, any>, orgId: string, userId: string): Promise<string>;
    createTask(params: {
        type: string;
        agent: string;
        priority: number;
        payload: Record<string, any>;
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
    getWorkflowStatus(workflowId: string): AgentWorkflow | undefined;
    getStatistics(): any;
    private generateId;
    private sleep;
}
export {};
//# sourceMappingURL=AgentOrchestrator.d.ts.map