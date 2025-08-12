"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const ScriptBreakdownAgent_1 = require("../agents/ScriptBreakdownAgent");
const EnhancedClassificationAgent_1 = require("../agents/EnhancedClassificationAgent");
const NoveltyDetectionAgent_1 = require("../agents/NoveltyDetectionAgent");
const QueueService_1 = require("./queues/QueueService");
const ProvenanceService_1 = require("./provenance/ProvenanceService");
const Neo4jService_1 = require("./Neo4jService");
class AgentOrchestrator {
    constructor() {
        this.agents = new Map();
        this.workflows = new Map();
        this.tasks = new Map();
        this.isRunning = false;
        this.queueService = new QueueService_1.QueueService();
        this.provenance = new ProvenanceService_1.ProvenanceService();
        this.neo4j = new Neo4jService_1.Neo4jService();
        this.initializeAgents();
        this.initializeWorkflows();
    }
    initializeAgents() {
        const scriptBreakdownAgent = new ScriptBreakdownAgent_1.ScriptBreakdownAgent(this.queueService);
        const classificationAgent = new EnhancedClassificationAgent_1.EnhancedClassificationAgent(this.queueService);
        const noveltyAgent = new NoveltyDetectionAgent_1.NoveltyDetectionAgent(this.queueService);
        this.agents.set('script_breakdown_agent', scriptBreakdownAgent);
        this.agents.set('enhanced_classification_agent', classificationAgent);
        this.agents.set('novelty_detection_agent', noveltyAgent);
    }
    initializeWorkflows() {
        this.workflows.set('file_processing', {
            id: 'file_processing',
            name: 'File Processing Workflow',
            description: 'Complete file processing pipeline with classification and novelty detection',
            steps: [
                {
                    agent: 'enhanced_classification_agent',
                    type: 'classify_file',
                    timeout: 30000,
                    retries: 2
                },
                {
                    agent: 'novelty_detection_agent',
                    type: 'detect_novelty',
                    condition: (context) => context.classification_confidence < 0.8,
                    timeout: 15000,
                    retries: 1
                }
            ],
            trigger: {
                event: 'file_uploaded',
                conditions: {
                    file_type: ['document', 'script', 'spreadsheet']
                }
            },
            enabled: true
        });
        this.workflows.set('script_analysis', {
            id: 'script_analysis',
            name: 'Script Analysis Workflow',
            description: 'Comprehensive script breakdown and content extraction',
            steps: [
                {
                    agent: 'enhanced_classification_agent',
                    type: 'classify_file',
                    timeout: 30000,
                    retries: 2
                },
                {
                    agent: 'script_breakdown_agent',
                    type: 'process_script',
                    condition: (context) => context.classification?.slot === 'SCRIPT_PRIMARY',
                    timeout: 120000,
                    retries: 1
                },
                {
                    agent: 'novelty_detection_agent',
                    type: 'detect_novelty',
                    timeout: 15000,
                    retries: 1
                }
            ],
            trigger: {
                event: 'script_uploaded',
                conditions: {
                    mime_type: ['application/pdf', 'text/plain']
                }
            },
            enabled: true
        });
        this.workflows.set('data_quality_monitoring', {
            id: 'data_quality_monitoring',
            name: 'Data Quality Monitoring',
            description: 'Continuous monitoring for data anomalies and quality issues',
            steps: [
                {
                    agent: 'novelty_detection_agent',
                    type: 'detect_novelty',
                    timeout: 30000,
                    retries: 2
                }
            ],
            trigger: {
                event: 'entity_updated',
                conditions: {}
            },
            enabled: true
        });
    }
    async start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        console.log('Agent Orchestrator started');
        this.processQueue();
        await this.setupEventListeners();
    }
    async stop() {
        this.isRunning = false;
        console.log('Agent Orchestrator stopped');
    }
    async executeWorkflow(workflowId, context, orgId, userId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        if (!workflow.enabled) {
            throw new Error(`Workflow disabled: ${workflowId}`);
        }
        const workflowExecutionId = this.generateId();
        console.log(`Starting workflow execution: ${workflowId} (${workflowExecutionId})`);
        const taskIds = [];
        let previousTaskId;
        for (const step of workflow.steps) {
            if (step.condition && !step.condition(context)) {
                console.log(`Skipping step ${step.agent}:${step.type} - condition not met`);
                continue;
            }
            const taskId = await this.createTask({
                type: step.type,
                agent: step.agent,
                priority: 5,
                payload: { ...context, workflow_id: workflowId, execution_id: workflowExecutionId },
                orgId,
                userId,
                dependencies: previousTaskId ? [previousTaskId] : [],
                maxRetries: step.retries || 1
            });
            taskIds.push(taskId);
            previousTaskId = taskId;
        }
        return workflowExecutionId;
    }
    async createTask(params) {
        const taskId = this.generateId();
        const task = {
            id: taskId,
            type: params.type,
            agent: params.agent,
            priority: params.priority,
            payload: params.payload,
            orgId: params.orgId,
            userId: params.userId,
            status: 'pending',
            createdAt: new Date(),
            dependencies: params.dependencies || [],
            retryCount: 0,
            maxRetries: params.maxRetries || 1
        };
        this.tasks.set(taskId, task);
        if (await this.areDependenciesComplete(task)) {
            await this.queueService.addJob('agent-jobs', task.type, task);
        }
        return taskId;
    }
    async processQueue() {
        this.queueService.registerWorker('agent-jobs', async (job) => {
            await this.executeTask(job.data.taskId);
        }, {
            concurrency: 5,
            connection: this.queueService.connection
        });
    }
    async executeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            console.error(`Task not found: ${taskId}`);
            return;
        }
        if (task.status !== 'pending') {
            console.log(`Task ${taskId} already processed (status: ${task.status})`);
            return;
        }
        if (!(await this.areDependenciesComplete(task))) {
            console.log(`Task ${taskId} dependencies not yet complete, requeueing`);
            await this.queueService.addJob('agent-jobs', task.type, task);
            return;
        }
        const agent = this.agents.get(task.agent);
        if (!agent) {
            task.status = 'failed';
            task.error = `Agent not found: ${task.agent}`;
            task.completedAt = new Date();
            return;
        }
        try {
            task.status = 'running';
            task.startedAt = new Date();
            console.log(`Executing task ${taskId}: ${task.agent}.${task.type}`);
            let result;
            switch (task.type) {
                case 'classify_file':
                    if (task.agent === 'enhanced_classification_agent') {
                        result = await agent.classifyFile(task.payload);
                    }
                    break;
                case 'process_script':
                    if (task.agent === 'script_breakdown_agent') {
                        result = await agent.processScript(task.payload.scriptText, task.payload.projectId, task.orgId, task.userId);
                    }
                    break;
                case 'detect_novelty':
                    if (task.agent === 'novelty_detection_agent') {
                        result = await agent.detectNovelty({
                            entityId: task.payload.entityId,
                            entityType: task.payload.entityType,
                            newProperties: task.payload.newProperties,
                            orgId: task.orgId,
                            userId: task.userId,
                            context: task.payload.context
                        });
                    }
                    break;
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }
            task.status = 'completed';
            task.result = result;
            task.completedAt = new Date();
            console.log(`Task ${taskId} completed successfully`);
            await this.queueDependentTasks(taskId);
        }
        catch (error) {
            console.error(`Task ${taskId} failed:`, error);
            task.retryCount++;
            if (task.retryCount < task.maxRetries) {
                task.status = 'pending';
                await this.queueService.addJob('agent-jobs', task.type, task);
                console.log(`Retrying task ${taskId} (attempt ${task.retryCount + 1}/${task.maxRetries})`);
            }
            else {
                task.status = 'failed';
                task.error = error instanceof Error ? error.message : String(error);
                task.completedAt = new Date();
            }
        }
    }
    async areDependenciesComplete(task) {
        if (!task.dependencies || task.dependencies.length === 0) {
            return true;
        }
        for (const depId of task.dependencies) {
            const depTask = this.tasks.get(depId);
            if (!depTask || depTask.status !== 'completed') {
                return false;
            }
        }
        return true;
    }
    async queueDependentTasks(completedTaskId) {
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.status === 'pending' &&
                task.dependencies?.includes(completedTaskId) &&
                await this.areDependenciesComplete(task)) {
                await this.queueService.addJob('agent-jobs', task.type, task);
            }
        }
    }
    async setupEventListeners() {
        return;
    }
    async handleEvent(eventType, eventData) {
        console.log(`Received event: ${eventType}`);
        for (const [workflowId, workflow] of this.workflows.entries()) {
            if (workflow.trigger.event === eventType && workflow.enabled) {
                if (this.matchesConditions(eventData, workflow.trigger.conditions)) {
                    try {
                        await this.executeWorkflow(workflowId, eventData, eventData.orgId, eventData.userId);
                        console.log(`Triggered workflow: ${workflowId}`);
                    }
                    catch (error) {
                        console.error(`Failed to trigger workflow ${workflowId}:`, error);
                    }
                }
            }
        }
    }
    matchesConditions(eventData, conditions) {
        if (!conditions) {
            return true;
        }
        for (const [key, expectedValue] of Object.entries(conditions)) {
            const actualValue = eventData[key];
            if (Array.isArray(expectedValue)) {
                if (!expectedValue.includes(actualValue)) {
                    return false;
                }
            }
            else if (actualValue !== expectedValue) {
                return false;
            }
        }
        return true;
    }
    getTaskStatus(taskId) {
        return this.tasks.get(taskId);
    }
    getWorkflowStatus(workflowId) {
        return this.workflows.get(workflowId);
    }
    getStatistics() {
        const tasksByStatus = new Map();
        const tasksByAgent = new Map();
        for (const task of this.tasks.values()) {
            tasksByStatus.set(task.status, (tasksByStatus.get(task.status) || 0) + 1);
            tasksByAgent.set(task.agent, (tasksByAgent.get(task.agent) || 0) + 1);
        }
        return {
            total_tasks: this.tasks.size,
            tasks_by_status: Object.fromEntries(tasksByStatus),
            tasks_by_agent: Object.fromEntries(tasksByAgent),
            available_agents: Array.from(this.agents.keys()),
            available_workflows: Array.from(this.workflows.keys()),
            is_running: this.isRunning
        };
    }
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
//# sourceMappingURL=AgentOrchestrator.js.map