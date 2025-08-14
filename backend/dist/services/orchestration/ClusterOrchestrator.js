"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterOrchestrator = void 0;
const BaseService_1 = require("../BaseService");
const uuid_1 = require("uuid");
const events_1 = require("events");
class ClusterOrchestrator extends BaseService_1.BaseService {
    constructor(queueService, postgresService, neo4jService, contentExtractionService, promotionService) {
        super('ClusterOrchestrator');
        this.activeWorkflows = new Map();
        this.queueService = queueService;
        this.postgresService = postgresService;
        this.neo4jService = neo4jService;
        this.contentExtractionService = contentExtractionService;
        this.promotionService = promotionService;
        this.eventBus = new events_1.EventEmitter();
        this.initializeWorkflowHandlers();
    }
    initializeWorkflowHandlers() {
        this.eventBus.on('file.processed', this.handleFileProcessed.bind(this));
        this.eventBus.on('extraction.completed', this.handleExtractionCompleted.bind(this));
        this.eventBus.on('promotion.completed', this.handlePromotionCompleted.bind(this));
        this.queueService.registerWorker('cluster-orchestration', async (job) => {
            await this.processOrchestrationJob(job.data);
        });
        this.queueService.registerWorker('content-extraction', async (job) => {
            await this.contentExtractionService.processExtractionJob(job.data);
        });
        this.queueService.registerWorker('content-promotion', async (job) => {
            await this.promotionService.processPromotionJob(job.data);
        });
        this.queueService.registerWorker('content-rollback', async (job) => {
            await this.promotionService.processRollbackJob(job.data);
        });
    }
    async startWorkflow(workflowName, context) {
        const workflowId = (0, uuid_1.v4)();
        this.logger.info(`Starting cluster workflow: ${workflowName}`, {
            workflowId,
            orgId: context.organizationId,
            fileId: context.fileId
        });
        const workflowDef = this.getWorkflowDefinition(workflowName);
        if (!workflowDef) {
            throw new Error(`Unknown workflow: ${workflowName}`);
        }
        const workflow = {
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
        await this.executeWorkflow(workflow);
        return workflowId;
    }
    async processOrchestrationJob(jobData) {
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
        }
        catch (error) {
            this.logger.error(`Orchestration job failed: ${workflowId}`, { error: error instanceof Error ? error.message : String(error) });
            await this.failWorkflow(workflow, error instanceof Error ? error.message : 'unknown error');
        }
    }
    async executeWorkflow(workflow) {
        workflow.status = 'running';
        while (workflow.status === 'running') {
            const nextSteps = this.getNextExecutableSteps(workflow);
            if (nextSteps.length === 0) {
                const allCompleted = workflow.steps.every(step => step.status === 'completed' || step.status === 'skipped');
                if (allCompleted) {
                    await this.completeWorkflow(workflow);
                }
                else {
                    const failedSteps = workflow.steps.filter(step => step.status === 'failed');
                    if (failedSteps.length > 0) {
                        await this.failWorkflow(workflow, `Steps failed: ${failedSteps.map(s => s.name).join(', ')}`);
                    }
                }
                break;
            }
            const stepPromises = nextSteps.map(step => this.executeWorkflowStep(workflow, step));
            await Promise.allSettled(stepPromises);
        }
    }
    async executeWorkflowStep(workflow, step) {
        this.logger.info(`Executing workflow step: ${step.name}`, {
            workflowId: workflow.id,
            stepId: step.id
        });
        step.status = 'running';
        try {
            let result;
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
        }
        catch (error) {
            step.error = error instanceof Error ? error.message : 'unknown error';
            step.status = 'failed';
            this.logger.error(`Workflow step failed: ${step.name}`, {
                workflowId: workflow.id,
                stepId: step.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async executeExtractionStep(workflow, step) {
        const { fileId, organizationId } = workflow.context;
        const parsers = await this.getApplicableParsers(organizationId, fileId);
        const extractionJobs = [];
        for (const parser of parsers) {
            const jobId = (0, uuid_1.v4)();
            await this.postgresService.query(`
        INSERT INTO extraction_job (id, org_id, file_id, parser_name, parser_version, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
      `, [jobId, organizationId, fileId, parser.parser_name, parser.parser_version]);
            await this.queueService.addJob('content-extraction', 'extract-content', {
                jobId,
                organizationId,
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
    async executePromotionStep(workflow, step) {
        const extractionStep = workflow.steps.find(s => s.name === 'extract-content');
        if (!extractionStep?.result?.extractionJobs) {
            throw new Error('No extraction jobs found for promotion');
        }
        const promotionResults = [];
        for (const jobId of extractionStep.result.extractionJobs) {
            const jobStatus = await this.getExtractionJobStatus(jobId);
            if (jobStatus.status === 'completed') {
                await this.queueService.addJob('content-promotion', 'promote-extraction', {
                    jobId,
                    orgId: workflow.context.organizationId,
                    actor: 'cluster-orchestrator',
                    autoPromoted: true
                });
                promotionResults.push(jobId);
            }
        }
        return { promotedJobs: promotionResults };
    }
    async executeCrossLinkStep(workflow, step) {
        const { fileId, organizationId, clusterId } = workflow.context;
        const crossLinks = await this.findPotentialCrossLayerLinks(organizationId, fileId);
        let linksCreated = 0;
        for (const link of crossLinks) {
            await this.createCrossLayerLink(link.fromId, link.toId, link.relType, organizationId);
            linksCreated++;
        }
        await this.updateClusterCrossLayerStats(clusterId, linksCreated);
        return { crossLinksCreated: linksCreated };
    }
    async executeOntologyCurationStep(workflow, step) {
        const { organizationId, clusterId } = workflow.context;
        const violations = await this.validateClusterOntology(organizationId, clusterId);
        if (violations.length > 0) {
            this.logger.warn(`Ontology violations detected in cluster: ${clusterId}`, { violations });
            await this.queueService.addJob('ontology-review', 'review-violations', {
                clusterId,
                organizationId,
                violations
            });
        }
        return { ontologyViolations: violations.length };
    }
    getWorkflowDefinition(workflowName) {
        const workflows = {
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
    getNextExecutableSteps(workflow) {
        return workflow.steps.filter(step => {
            if (step.status !== 'pending')
                return false;
            return step.dependencies.every(depId => {
                const depStep = workflow.steps.find(s => s.id === depId);
                return depStep && depStep.status === 'completed';
            });
        });
    }
    async completeWorkflow(workflow) {
        workflow.status = 'completed';
        workflow.completedAt = new Date();
        this.logger.info(`Cluster workflow completed: ${workflow.name}`, {
            workflowId: workflow.id,
            duration: workflow.completedAt.getTime() - workflow.startedAt.getTime()
        });
        this.eventBus.emit('workflow.completed', {
            workflowId: workflow.id,
            context: workflow.context,
            results: workflow.steps.map(s => ({ stepId: s.id, result: s.result }))
        });
        this.activeWorkflows.delete(workflow.id);
    }
    async failWorkflow(workflow, reason) {
        workflow.status = 'failed';
        workflow.completedAt = new Date();
        this.logger.error(`Cluster workflow failed: ${workflow.name}`, {
            workflowId: workflow.id,
            reason
        });
        this.eventBus.emit('workflow.failed', {
            workflowId: workflow.id,
            context: workflow.context,
            reason,
            failedSteps: workflow.steps.filter(s => s.status === 'failed')
        });
        this.activeWorkflows.delete(workflow.id);
    }
    async handleFileProcessed(event) {
        const { organizationId, fileId, clusterId, slots, extractionTriggered } = event;
        if (extractionTriggered) {
            await this.startWorkflow('cluster-full-processing', {
                organizationId,
                fileId,
                clusterId,
                sessionId: (0, uuid_1.v4)(),
                metadata: { slots, trigger: 'file-processed' }
            });
        }
    }
    async handleExtractionCompleted(event) {
        const { jobId } = event;
        for (const workflow of this.activeWorkflows.values()) {
            const extractionStep = workflow.steps.find(s => s.agent === 'content-extractor' &&
                s.result?.extractionJobs?.includes(jobId));
            if (extractionStep) {
                await this.queueService.addJob('cluster-orchestration', 'continue', {
                    workflowId: workflow.id
                });
            }
        }
    }
    async handlePromotionCompleted(event) {
        const { jobId } = event;
        for (const workflow of this.activeWorkflows.values()) {
            const promotionStep = workflow.steps.find(s => s.agent === 'content-promoter' &&
                s.result?.promotedJobs?.includes(jobId));
            if (promotionStep) {
                await this.queueService.addJob('cluster-orchestration', 'continue', {
                    workflowId: workflow.id
                });
            }
        }
    }
    async getApplicableParsers(organizationId, fileId) {
        const result = await this.postgresService.query(`
      SELECT pr.* FROM parser_registry pr
      JOIN files f ON f.mime_type = pr.mime_type OR pr.mime_type = '*/*'
      WHERE f.id = $1 AND pr.org_id = $2 AND pr.enabled = true
    `, [fileId, organizationId]);
        return result.rows;
    }
    async getExtractionJobStatus(jobId) {
        const result = await this.postgresService.query(`
      SELECT * FROM extraction_job WHERE id = $1
    `, [jobId]);
        return result.rows[0];
    }
    async findPotentialCrossLayerLinks(organizationId, fileId) {
        return [];
    }
    async createCrossLayerLink(fromId, toId, relType, organizationId) {
        const query = `
      MATCH (from {id: $fromId}), (to {id: $toId})
      CREATE (from)-[r:${relType} {
        org_id: $organizationId,
        created_at: datetime(),
        created_by: 'cluster-orchestrator'
      }]->(to)
    `;
        await this.neo4jService.run(query, { fromId, toId, organizationId });
    }
    async updateClusterCrossLayerStats(clusterId, linksCreated) {
        const query = `
      MATCH (cc:ContentCluster {id: $clusterId})
      SET cc.crossLayerLinksCount = coalesce(cc.crossLayerLinksCount, 0) + $linksCreated
    `;
        await this.neo4jService.run(query, { clusterId, linksCreated });
    }
    async validateClusterOntology(organizationId, clusterId) {
        return [];
    }
    getEventBus() {
        return this.eventBus;
    }
    getWorkflowStatus(workflowId) {
        return this.activeWorkflows.get(workflowId);
    }
    async continueWorkflow(workflow) {
        await this.executeWorkflow(workflow);
    }
    async retryWorkflowStep(workflow, stepId) {
        const step = workflow.steps.find(s => s.id === stepId);
        if (!step) {
            throw new Error(`Step not found: ${stepId}`);
        }
        step.status = 'pending';
        step.error = undefined;
        await this.executeWorkflow(workflow);
    }
}
exports.ClusterOrchestrator = ClusterOrchestrator;
//# sourceMappingURL=ClusterOrchestrator.js.map