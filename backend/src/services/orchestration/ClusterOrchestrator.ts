import { BaseService } from '../BaseService';
import { QueueService } from '../queues/QueueService';
import { PostgresService } from '../PostgresService';
import { Neo4jService } from '../Neo4jService';
import { ContentExtractionService } from '../extraction/ContentExtractionService';
import { PromotionService } from '../extraction/PromotionService';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface WorkflowContext {
  orgId: string;
  fileId: string;
  clusterId: string;
  sessionId: string;
  metadata: any;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agent: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

export interface ClusterWorkflow {
  id: string;
  name: string;
  context: WorkflowContext;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * ClusterOrchestrator manages multi-step, cross-layer workflows for cluster processing.
 * It coordinates between different agents to ensure proper cluster lifecycle management.
 */
export class ClusterOrchestrator extends BaseService {
  private queueService: QueueService;
  private postgresService: PostgresService;
  private neo4jService: Neo4jService;
  private contentExtractionService: ContentExtractionService;
  private promotionService: PromotionService;
  private eventBus: EventEmitter;
  private activeWorkflows: Map<string, ClusterWorkflow> = new Map();

  constructor(
    queueService: QueueService,
    postgresService: PostgresService,
    neo4jService: Neo4jService,
    contentExtractionService: ContentExtractionService,
    promotionService: PromotionService
  ) {
    super('ClusterOrchestrator');
    this.queueService = queueService;
    this.postgresService = postgresService;
    this.neo4jService = neo4jService;
    this.contentExtractionService = contentExtractionService;
    this.promotionService = promotionService;
    this.eventBus = new EventEmitter();
    
    this.initializeWorkflowHandlers();
  }

  /**
   * Initialize workflow event handlers
   */
  private initializeWorkflowHandlers(): void {
    // Listen for file processing events from FileStewardAgent
    this.eventBus.on('file.processed', this.handleFileProcessed.bind(this));
    
    // Listen for extraction completion events
    this.eventBus.on('extraction.completed', this.handleExtractionCompleted.bind(this));
    
    // Listen for promotion events
    this.eventBus.on('promotion.completed', this.handlePromotionCompleted.bind(this));

    // Register queue workers for orchestration
    this.queueService.registerWorker('cluster-orchestration', async (job: any) => {
      await this.processOrchestrationJob(job.data as any);
    });

    this.queueService.registerWorker('content-extraction', async (job: any) => {
      await this.contentExtractionService.processExtractionJob(job.data as any);
    });

    this.queueService.registerWorker('content-promotion', async (job: any) => {
      await this.promotionService.processPromotionJob(job.data as any);
    });

    this.queueService.registerWorker('content-rollback', async (job: any) => {
      await this.promotionService.processRollbackJob(job.data as any);
    });
  }

  /**
   * Start a cluster processing workflow
   */
  async startWorkflow(workflowName: string, context: WorkflowContext): Promise<string> {
    const workflowId = uuidv4();
    
    this.logger.info(`Starting cluster workflow: ${workflowName}`, { 
      workflowId, 
      orgId: context.orgId, 
      fileId: context.fileId 
    });

    // Get workflow definition
    const workflowDef = this.getWorkflowDefinition(workflowName);
    if (!workflowDef) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }

    // Create workflow instance
    const workflow: ClusterWorkflow = {
      id: workflowId,
      name: workflowName,
      context,
      steps: workflowDef.steps.map(step => ({
        ...step,
        status: 'pending'
      })),
      status: 'pending',
      startedAt: new Date()
    };

    this.activeWorkflows.set(workflowId, workflow);

    // Kick off execution immediately in-process for test determinism
    await this.executeWorkflow(workflow);

    return workflowId;
  }

  /**
   * Process orchestration job from queue
   */
  private async processOrchestrationJob(jobData: any): Promise<void> {
    const { workflowId, action } = jobData;
    
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      this.logger.error(`Workflow not found: ${workflowId}`);
      return;
    }

    try {
      switch (action) {
        case 'start':
          await this.executeWorkflow(workflow);
          break;
        case 'continue':
          await this.continueWorkflow(workflow);
          break;
        case 'retry_step':
          await this.retryWorkflowStep(workflow, jobData.stepId);
          break;
        default:
          this.logger.error(`Unknown orchestration action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Orchestration job failed: ${workflowId}`, { error: error instanceof Error ? error.message : String(error) });
      await this.failWorkflow(workflow, error instanceof Error ? error.message : 'unknown error');
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(workflow: ClusterWorkflow): Promise<void> {
    workflow.status = 'running';
    
    while (workflow.status === 'running') {
      const nextSteps = this.getNextExecutableSteps(workflow);
      
      if (nextSteps.length === 0) {
        // Check if all steps are completed
        const allCompleted = workflow.steps.every(step => 
          step.status === 'completed' || step.status === 'skipped'
        );
        
        if (allCompleted) {
          await this.completeWorkflow(workflow);
        } else {
          // Workflow is blocked - check for failures
          const failedSteps = workflow.steps.filter(step => step.status === 'failed');
          if (failedSteps.length > 0) {
            await this.failWorkflow(workflow, `Steps failed: ${failedSteps.map(s => s.name).join(', ')}`);
          }
        }
        break;
      }

      // Execute next steps in parallel
      const stepPromises = nextSteps.map(step => this.executeWorkflowStep(workflow, step));
      await Promise.allSettled(stepPromises);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeWorkflowStep(workflow: ClusterWorkflow, step: WorkflowStep): Promise<void> {
    this.logger.info(`Executing workflow step: ${step.name}`, { 
      workflowId: workflow.id, 
      stepId: step.id 
    });

    step.status = 'running';

    try {
      let result: any;

      switch (step.agent) {
        case 'content-extractor':
          result = await this.executeExtractionStep(workflow, step);
          break;
        case 'content-promoter':
          result = await this.executePromotionStep(workflow, step);
          break;
        case 'cross-link-curator':
          result = await this.executeCrossLinkStep(workflow, step);
          break;
        case 'ontology-curator':
          result = await this.executeOntologyCurationStep(workflow, step);
          break;
        default:
          throw new Error(`Unknown agent: ${step.agent}`);
      }

      step.result = result;
      step.status = 'completed';
      
      this.logger.info(`Workflow step completed: ${step.name}`, { 
        workflowId: workflow.id, 
        stepId: step.id,
        result 
      });

    } catch (error) {
      step.error = error instanceof Error ? error.message : 'unknown error';
      step.status = 'failed';
      
      this.logger.error(`Workflow step failed: ${step.name}`, { 
        workflowId: workflow.id, 
        stepId: step.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute content extraction step
   */
  private async executeExtractionStep(workflow: ClusterWorkflow, step: WorkflowStep): Promise<any> {
    const { fileId, orgId } = workflow.context;
    
    // Get applicable parsers for this file
    const parsers = await this.getApplicableParsers(orgId, fileId);
    
    const extractionJobs = [];
    for (const parser of parsers) {
      const jobId = uuidv4();
      
      // Create extraction job
      await this.postgresService.query(`
        INSERT INTO extraction_job (id, org_id, file_id, parser_name, parser_version, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
      `, [jobId, orgId, fileId, parser.parser_name, parser.parser_version]);

      // Queue extraction
      await this.queueService.addJob('content-extraction', 'extract-content', {
        jobId,
        orgId,
        fileId,
        slot: parser.slot,
        parser: parser.parser_name,
        parserVersion: parser.parser_version,
        metadata: workflow.context.metadata
      });

      extractionJobs.push(jobId);
    }

    return { extractionJobs };
  }

  /**
   * Execute promotion step
   */
  private async executePromotionStep(workflow: ClusterWorkflow, step: WorkflowStep): Promise<any> {
    const extractionStep = workflow.steps.find(s => s.name === 'extract-content');
    if (!extractionStep?.result?.extractionJobs) {
      throw new Error('No extraction jobs found for promotion');
    }

    const promotionResults = [];
    for (const jobId of extractionStep.result.extractionJobs) {
      // Check if job is ready for promotion
      const jobStatus = await this.getExtractionJobStatus(jobId);
      if (jobStatus.status === 'completed') {
        // Queue promotion
        await this.queueService.addJob('content-promotion', 'promote-extraction', {
          jobId,
          orgId: workflow.context.orgId,
          actor: 'cluster-orchestrator',
          autoPromoted: true
        });

        promotionResults.push(jobId);
      }
    }

    return { promotedJobs: promotionResults };
  }

  /**
   * Execute cross-layer link curation step
   */
  private async executeCrossLinkStep(workflow: ClusterWorkflow, step: WorkflowStep): Promise<any> {
    const { fileId, orgId, clusterId } = workflow.context;
    
    // Find potential cross-layer links
    const crossLinks = await this.findPotentialCrossLayerLinks(orgId, fileId);
    
    let linksCreated = 0;
    for (const link of crossLinks) {
      await this.createCrossLayerLink(link.fromId, link.toId, link.relType, orgId);
      linksCreated++;
    }

    // Update cluster statistics
    await this.updateClusterCrossLayerStats(clusterId, linksCreated);

    return { crossLinksCreated: linksCreated };
  }

  /**
   * Execute ontology curation step
   */
  private async executeOntologyCurationStep(workflow: ClusterWorkflow, step: WorkflowStep): Promise<any> {
    const { orgId, clusterId } = workflow.context;
    
    // Validate ontology constraints for the cluster
    const violations = await this.validateClusterOntology(orgId, clusterId);
    
    if (violations.length > 0) {
      this.logger.warn(`Ontology violations detected in cluster: ${clusterId}`, { violations });
      
      // Queue for manual review
      await this.queueService.addJob('ontology-review', 'review-violations', {
        clusterId,
        orgId,
        violations
      });
    }

    return { ontologyViolations: violations.length };
  }

  /**
   * Get workflow definition by name
   */
  private getWorkflowDefinition(workflowName: string): { steps: { id: string; name: string; agent: string; dependencies: string[] }[] } | undefined {
    const workflows: Record<string, { steps: { id: string; name: string; agent: string; dependencies: string[] }[] }> = {
      'cluster-full-processing': {
        steps: [
          {
            id: 'extract-content',
            name: 'Extract Content',
            agent: 'content-extractor',
            dependencies: []
          },
          {
            id: 'promote-content',
            name: 'Promote to Graph',
            agent: 'content-promoter',
            dependencies: ['extract-content']
          },
          {
            id: 'create-cross-links',
            name: 'Create Cross-Layer Links',
            agent: 'cross-link-curator',
            dependencies: ['promote-content']
          },
          {
            id: 'validate-ontology',
            name: 'Validate Ontology',
            agent: 'ontology-curator',
            dependencies: ['create-cross-links']
          }
        ]
      },
      'cluster-extraction-only': {
        steps: [
          {
            id: 'extract-content',
            name: 'Extract Content',
            agent: 'content-extractor',
            dependencies: []
          }
        ]
      }
    };

    return workflows[workflowName];
  }

  /**
   * Get next executable steps (dependencies satisfied)
   */
  private getNextExecutableSteps(workflow: ClusterWorkflow): WorkflowStep[] {
    return workflow.steps.filter(step => {
      if (step.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      return step.dependencies.every(depId => {
        const depStep = workflow.steps.find(s => s.id === depId);
        return depStep && depStep.status === 'completed';
      });
    });
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(workflow: ClusterWorkflow): Promise<void> {
    workflow.status = 'completed';
    workflow.completedAt = new Date();
    
    this.logger.info(`Cluster workflow completed: ${workflow.name}`, { 
      workflowId: workflow.id,
      duration: workflow.completedAt.getTime() - workflow.startedAt!.getTime()
    });

    // Emit completion event
    this.eventBus.emit('workflow.completed', {
      workflowId: workflow.id,
      context: workflow.context,
      results: workflow.steps.map(s => ({ stepId: s.id, result: s.result }))
    });

    // Clean up from active workflows
    this.activeWorkflows.delete(workflow.id);
  }

  /**
   * Fail workflow
   */
  private async failWorkflow(workflow: ClusterWorkflow, reason: string): Promise<void> {
    workflow.status = 'failed';
    workflow.completedAt = new Date();
    
    this.logger.error(`Cluster workflow failed: ${workflow.name}`, { 
      workflowId: workflow.id,
      reason
    });

    // Emit failure event
    this.eventBus.emit('workflow.failed', {
      workflowId: workflow.id,
      context: workflow.context,
      reason,
      failedSteps: workflow.steps.filter(s => s.status === 'failed')
    });

    // Clean up from active workflows
    this.activeWorkflows.delete(workflow.id);
  }

  // ========================================
  // EVENT HANDLERS
  // ========================================

  /**
   * Handle file processed event from FileStewardAgent
   */
  private async handleFileProcessed(event: any): Promise<void> {
    const { orgId, fileId, clusterId, slots, extractionTriggered } = event;
    
    if (extractionTriggered) {
      // Start full cluster processing workflow
      await this.startWorkflow('cluster-full-processing', {
        orgId,
        fileId,
        clusterId,
        sessionId: uuidv4(),
        metadata: { slots, trigger: 'file-processed' }
      });
    }
  }

  /**
   * Handle extraction completed event
   */
  private async handleExtractionCompleted(event: any): Promise<void> {
    // Continue workflow if this was part of an orchestrated process
    const { jobId } = event;
    
    // Find workflows waiting for this extraction
    for (const workflow of this.activeWorkflows.values()) {
      const extractionStep = workflow.steps.find(s => 
        s.agent === 'content-extractor' && 
        s.result?.extractionJobs?.includes(jobId)
      );
      
      if (extractionStep) {
        await this.queueService.addJob('cluster-orchestration', 'continue', {
          workflowId: workflow.id
        });
      }
    }
  }

  /**
   * Handle promotion completed event
   */
  private async handlePromotionCompleted(event: any): Promise<void> {
    // Continue workflow if this was part of an orchestrated process
    const { jobId } = event;
    
    // Find workflows waiting for this promotion
    for (const workflow of this.activeWorkflows.values()) {
      const promotionStep = workflow.steps.find(s => 
        s.agent === 'content-promoter' && 
        s.result?.promotedJobs?.includes(jobId)
      );
      
      if (promotionStep) {
        await this.queueService.addJob('cluster-orchestration', 'continue', {
          workflowId: workflow.id
        });
      }
    }
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private async getApplicableParsers(orgId: string, fileId: string): Promise<any[]> {
    const result = await this.postgresService.query(`
      SELECT pr.* FROM parser_registry pr
      JOIN files f ON f.mime_type = pr.mime_type OR pr.mime_type = '*/*'
      WHERE f.id = $1 AND pr.org_id = $2 AND pr.enabled = true
    `, [fileId, orgId]);

    return result.rows;
  }

  private async getExtractionJobStatus(jobId: string): Promise<any> {
    const result = await this.postgresService.query(`
      SELECT * FROM extraction_job WHERE id = $1
    `, [jobId]);

    return result.rows[0];
  }

  private async findPotentialCrossLayerLinks(orgId: string, fileId: string): Promise<any[]> {
    // Mock implementation - in production this would use graph analysis
    return [];
  }

  private async createCrossLayerLink(fromId: string, toId: string, relType: string, orgId: string): Promise<void> {
    const query = `
      MATCH (from {id: $fromId}), (to {id: $toId})
      CREATE (from)-[r:${relType} {
        org_id: $orgId,
        created_at: datetime(),
        created_by: 'cluster-orchestrator'
      }]->(to)
    `;

    await this.neo4jService.run(query, { fromId, toId, orgId });
  }

  private async updateClusterCrossLayerStats(clusterId: string, linksCreated: number): Promise<void> {
    const query = `
      MATCH (cc:ContentCluster {id: $clusterId})
      SET cc.crossLayerLinksCount = coalesce(cc.crossLayerLinksCount, 0) + $linksCreated
    `;

    await this.neo4jService.run(query, { clusterId, linksCreated });
  }

  private async validateClusterOntology(orgId: string, clusterId: string): Promise<any[]> {
    // Mock implementation - would validate ontology rules
    return [];
  }

  /**
   * Get event bus for external listeners
   */
  getEventBus(): EventEmitter {
    return this.eventBus;
  }

  /**
   * Get active workflow status
   */
  getWorkflowStatus(workflowId: string): ClusterWorkflow | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Continue workflow execution
   */
  private async continueWorkflow(workflow: ClusterWorkflow): Promise<void> {
    await this.executeWorkflow(workflow);
  }

  /**
   * Retry a failed workflow step
   */
  private async retryWorkflowStep(workflow: ClusterWorkflow, stepId: string): Promise<void> {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    step.status = 'pending';
    step.error = undefined;
    
    await this.executeWorkflow(workflow);
  }
}
