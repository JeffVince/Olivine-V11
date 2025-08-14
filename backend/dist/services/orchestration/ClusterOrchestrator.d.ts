import { BaseService } from '../BaseService';
import { QueueService } from '../queues/QueueService';
import { PostgresService } from '../PostgresService';
import { Neo4jService } from '../Neo4jService';
import { ContentExtractionService } from '../extraction/ContentExtractionService';
import { PromotionService } from '../extraction/PromotionService';
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
export declare class ClusterOrchestrator extends BaseService {
    private queueService;
    private postgresService;
    private neo4jService;
    private contentExtractionService;
    private promotionService;
    private eventBus;
    private activeWorkflows;
    constructor(queueService: QueueService, postgresService: PostgresService, neo4jService: Neo4jService, contentExtractionService: ContentExtractionService, promotionService: PromotionService);
    private initializeWorkflowHandlers;
    startWorkflow(workflowName: string, context: WorkflowContext): Promise<string>;
    private processOrchestrationJob;
    private executeWorkflow;
    private executeWorkflowStep;
    private executeExtractionStep;
    private executePromotionStep;
    private executeCrossLinkStep;
    private executeOntologyCurationStep;
    private getWorkflowDefinition;
    private getNextExecutableSteps;
    private completeWorkflow;
    private failWorkflow;
    private handleFileProcessed;
    private handleExtractionCompleted;
    private handlePromotionCompleted;
    private getApplicableParsers;
    private getExtractionJobStatus;
    private findPotentialCrossLayerLinks;
    private createCrossLayerLink;
    private updateClusterCrossLayerStats;
    private validateClusterOntology;
    getEventBus(): EventEmitter;
    getWorkflowStatus(workflowId: string): ClusterWorkflow | undefined;
    private continueWorkflow;
    private retryWorkflowStep;
}
//# sourceMappingURL=ClusterOrchestrator.d.ts.map