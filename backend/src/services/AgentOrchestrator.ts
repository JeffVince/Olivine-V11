import { BaseAgent } from '../agents/BaseAgent';
import { ScriptBreakdownAgent } from '../agents/ScriptBreakdownAgent';
import { TaxonomyClassificationAgent } from '../agents/TaxonomyClassificationAgent';
import { NoveltyDetectionAgent } from '../agents/NoveltyDetectionAgent';
import { QueueService } from './queues/QueueService';
import { ProvenanceService } from './provenance/ProvenanceService';
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

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private workflows: Map<string, AgentWorkflow> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private workflowStatus: Map<string, { results: Map<string, unknown>; errors: Map<string, string> }> = new Map();
  private queueService: QueueService;
  private provenance: ProvenanceService;
  private neo4j: Neo4jService;
  private postgres: PostgresService;
  private isRunning = false;

  constructor(queueService: QueueService, neo4jService: Neo4jService, postgresService: PostgresService) {
    this.queueService = queueService;
    this.neo4j = neo4jService;
    this.postgres = postgresService;
    this.provenance = new ProvenanceService();
    this.initializeAgents();
    this.initializeWorkflows();
  }

  /**
   * Initialize available agents
   */
  private initializeAgents(): void {
    const scriptBreakdownAgent = new ScriptBreakdownAgent(this.queueService);
    const taxonomyClassificationAgent = new TaxonomyClassificationAgent(this.queueService);
    const noveltyAgent = new NoveltyDetectionAgent(this.queueService);

    this.agents.set('script_breakdown_agent', scriptBreakdownAgent);
    this.agents.set('taxonomy_classification_agent', taxonomyClassificationAgent);
    // Alias expected by tests
    this.agents.set('enhanced_classification_agent', taxonomyClassificationAgent);
    this.agents.set('novelty_detection_agent', noveltyAgent);
  }

  /**
   * Initialize predefined workflows
   */
  private initializeWorkflows(): void {
    // File Processing Workflow
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
          condition: (context) => {
            const value = (context as any).classification_confidence as number | undefined;
            return typeof value === 'number' && value < 0.8;
          },
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

    // Script Analysis Workflow
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
          condition: (context) => {
            const cls: any = (context as any).classification;
            return !!cls && cls.slot === 'SCRIPT_PRIMARY';
          },
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

    // Data Quality Monitoring Workflow
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

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('Agent Orchestrator started');

    // Start processing tasks
    this.processQueue();

    // Set up event listeners
    await this.setupEventListeners();
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Agent Orchestrator stopped');
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string, 
    context: Record<string, unknown>,
    orgId: string,
    userId: string
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow disabled: ${workflowId}`);
    }

    const workflowExecutionId = this.generateId();
    console.log(`Starting workflow execution: ${workflowId} (${workflowExecutionId})`);
    // Initialize status bucket
    this.workflowStatus.set(workflowExecutionId, { results: new Map(), errors: new Map() });

    // Create tasks for each step
    const taskIds: string[] = [];
    let previousTaskId: string | undefined;

    for (const step of workflow.steps) {
      // Check condition if present
      if (step.condition && !step.condition(context)) {
        console.log(`Skipping step ${step.agent}:${step.type} - condition not met`);
        const status = this.workflowStatus.get(workflowExecutionId);
        status?.errors.set(`${step.agent}:${step.type}`, 'skipped');
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
      const status = this.workflowStatus.get(workflowExecutionId);
      status?.results.set(taskId, { queued: true, agent: step.agent, type: step.type });
      previousTaskId = taskId;
    }

    return workflowExecutionId;
  }

  /**
   * Create a new agent task
   */
  async createTask(params: {
    type: string;
    agent: string;
    priority: number;
    payload: Record<string, unknown>;
    orgId: string;
    userId: string;
    dependencies?: string[];
    maxRetries?: number;
  }): Promise<string> {
    const taskId = this.generateId();
    
    const task: AgentTask = {
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
    
    // Queue the task if no dependencies or all dependencies are complete
    if (await this.areDependenciesComplete(task)) {
      await this.queueService.addJob('agent-jobs', task.type, task);
    }

    return taskId;
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    // Register a worker to process agent jobs
    {
      const opts: any = { concurrency: 5 };
      if (this.queueService.connection) opts.connection = this.queueService.connection;
      this.queueService.registerWorker('agent-jobs', async (job) => {
        await this.executeTask(job.data.taskId);
      }, opts);
    }
  }

  /**
   * Execute a specific task
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return;
    }

    if (task.status !== 'pending') {
      console.log(`Task ${taskId} already processed (status: ${task.status})`);
      return;
    }

    // Check dependencies again
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
      // Record error into any workflow execution this task is associated with
      const execId = (task.payload as any).execution_id as string | undefined;
      if (execId && this.workflowStatus.has(execId)) {
        const status = this.workflowStatus.get(execId)!;
        status.errors.set(task.id, task.error!);
      }
      return;
    }

    try {
      task.status = 'running';
      task.startedAt = new Date();

      console.log(`Executing task ${taskId}: ${task.agent}.${task.type}`);

      // Execute the task based on type
      let result;
      switch (task.type) {
        case 'classify_file':
          if (task.agent === 'taxonomy_classification_agent') {
            result = await (agent as unknown as TaxonomyClassificationAgent).classifyFile(
              task.payload
            );
          }
          break;

        case 'process_script':
          if (task.agent === 'script_breakdown_agent') {
            result = await (agent as unknown as ScriptBreakdownAgent).processScript(
               (task.payload as any).scriptText,
               (task.payload as any).projectId,
              task.orgId,
              task.userId
            );
          }
          break;

        case 'detect_novelty':
          if (task.agent === 'novelty_detection_agent') {
            result = await (agent as unknown as NoveltyDetectionAgent).detectNovelty({
              entityId: (task.payload as any).entityId,
              entityType: (task.payload as any).entityType,
              newProperties: (task.payload as any).newProperties,
              orgId: task.orgId,
              userId: task.userId,
              context: (task.payload as any).context
            });
          }
          break;

        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();
      const execId = (task.payload as any).execution_id as string | undefined;
      if (execId && this.workflowStatus.has(execId)) {
        const status = this.workflowStatus.get(execId)!;
        status.results.set(task.id, { completed: true, result });
      }

      console.log(`Task ${taskId} completed successfully`);

      // Queue dependent tasks
      await this.queueDependentTasks(taskId);

    } catch (error) {
      console.error(`Task ${taskId} failed:`, error);
      
      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        // Retry the task
        task.status = 'pending';
        await this.queueService.addJob('agent-jobs', task.type, task);
        console.log(`Retrying task ${taskId} (attempt ${task.retryCount + 1}/${task.maxRetries})`);
      } else {
        // Max retries reached
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();
        const execId = (task.payload as any).execution_id as string | undefined;
        if (execId && this.workflowStatus.has(execId)) {
          const status = this.workflowStatus.get(execId)!;
          status.errors.set(task.id, task.error!);
        }
      }
    }
  }

  /**
   * Check if all dependencies for a task are complete
   */
  private async areDependenciesComplete(task: AgentTask): Promise<boolean> {
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

  /**
   * Queue tasks that depend on the completed task
   */
  private async queueDependentTasks(completedTaskId: string): Promise<void> {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'pending' && 
          task.dependencies?.includes(completedTaskId) &&
          await this.areDependenciesComplete(task)) {
        
        await this.queueService.addJob('agent-jobs', task.type, task);
      }
    }
  }

  /**
   * Set up event listeners for workflow triggers
   */
  private async setupEventListeners(): Promise<void> {
    // TODO: Integrate with a real event bus or message system.
    // QueueService does not expose an 'on' method; use QueueEvents or a separate event emitter.
    return;
  }

  /**
   * Handle incoming events and trigger workflows
   */
  private async handleEvent(eventType: string, eventData: Record<string, unknown>): Promise<void> {
    console.log(`Received event: ${eventType}`);

    for (const [workflowId, workflow] of this.workflows.entries()) {
      if (workflow.trigger.event === eventType && workflow.enabled) {
        // Check trigger conditions
        if (this.matchesConditions(eventData, workflow.trigger.conditions)) {
          try {
            await this.executeWorkflow(workflowId, eventData, eventData.orgId as string, eventData.userId as string);
            console.log(`Triggered workflow: ${workflowId}`);
          } catch (error) {
            console.error(`Failed to trigger workflow ${workflowId}:`, error);
          }
        }
      }
    }
  }

  /**
   * Check if event data matches workflow trigger conditions
   */
  private matchesConditions(eventData: Record<string, unknown>, conditions?: Record<string, unknown>): boolean {
    if (!conditions) {
      return true;
    }

    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = eventData[key];
      
      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) {
          return false;
        }
      } else if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowExecutionId: string): { results: Map<string, unknown>; errors: Map<string, string> } | undefined {
    return this.workflowStatus.get(workflowExecutionId);
  }

  /**
   * Get orchestrator statistics
   */
  getStatistics(): { tasksByStatus: Record<string, number>; tasksByAgent: Record<string, number>; totalTasks: number; activeWorkflows: number; available_agents: string[]; available_workflows: string[]; is_running: boolean } {
    const tasksByStatus = new Map();
    const tasksByAgent = new Map();

    for (const task of this.tasks.values()) {
      // Count by status
      tasksByStatus.set(task.status, (tasksByStatus.get(task.status) || 0) + 1);
      
      // Count by agent
      tasksByAgent.set(task.agent, (tasksByAgent.get(task.agent) || 0) + 1);
    }

    return {
      tasksByStatus: Object.fromEntries(tasksByStatus) as Record<string, number>,
      tasksByAgent: Object.fromEntries(tasksByAgent) as Record<string, number>,
      totalTasks: this.tasks.size,
      activeWorkflows: Array.from(this.workflows.values()).filter(w => w.enabled).length,
      available_agents: Array.from(this.agents.keys()),
      available_workflows: Array.from(this.workflows.keys()),
      is_running: this.isRunning
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a workflow execution
   */
  async startWorkflow(workflow: AgentWorkflow, eventData: Record<string, unknown>): Promise<string> {
    const workflowExecutionId = this.generateId();
    if (!workflow || !Array.isArray(workflow.steps)) {
      console.warn('startWorkflow called without a valid workflow or steps; nothing to execute');
      return workflowExecutionId;
    }
    console.log(`Starting workflow execution: ${(workflow && workflow.id) || 'unknown'} (${workflowExecutionId})`);
    
    // Create tasks for each step
    const taskIds: string[] = [];
    let previousTaskId: string | undefined;
    
    for (const step of workflow.steps) {
      // Check condition if present
      if (step.condition && !step.condition(eventData)) {
        console.log(`Skipping step ${step.agent}:${step.type} - condition not met`);
        continue;
      }
      
      const taskId = await this.createTask({
        type: step.type,
        agent: step.agent,
        priority: 5,
        payload: { ...eventData, workflow_id: workflow.id, execution_id: workflowExecutionId },
        orgId: eventData.orgId as string,
        userId: eventData.userId as string,
        dependencies: previousTaskId ? [previousTaskId] : [],
        maxRetries: step.retries || 1
      });
      
      taskIds.push(taskId);
      previousTaskId = taskId;
    }
    
    return workflowExecutionId;
  }
  
  /**
   * Get all registered workflows
   */
  getRegisteredWorkflows(): AgentWorkflow[] {
    return Array.from(this.workflows.values());
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
