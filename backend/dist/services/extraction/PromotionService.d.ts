import { BaseService } from '../BaseService';
import { PostgresService } from '../PostgresService';
import { Neo4jService } from '../Neo4jService';
import { QueueService } from '../queues/QueueService';
export interface PromotionJobData {
    jobId: string;
    orgId: string;
    actor: string;
    autoPromoted?: boolean;
    reviewNotes?: string;
}
export interface RollbackJobData {
    auditId: string;
    orgId: string;
    actor: string;
    reason: string;
}
export interface PromotionResult {
    nodesCreated: number;
    relationshipsCreated: number;
    commitId: string;
    auditId: string;
}
export interface RollbackResult {
    nodesRemoved: number;
    relationshipsRemoved: number;
    commitId: string;
}
export declare class PromotionService extends BaseService {
    private postgresService;
    private neo4jService;
    private queueService;
    constructor(postgresService: PostgresService, neo4jService: Neo4jService, queueService: QueueService);
    processPromotionJob(jobData: PromotionJobData): Promise<PromotionResult>;
    processRollbackJob(jobData: RollbackJobData): Promise<RollbackResult>;
    private getExtractionJobDetails;
    private getStagedEntities;
    private getStagedLinks;
    private validatePromotionRules;
    private validateCrossLayerLink;
    private promoteEntities;
    private promoteLinks;
    private updateContentClusterStats;
    private createCommitRecord;
    private createPromotionAudit;
    private updateExtractionJobStatus;
    private getPromotionAuditDetails;
    private getRollbackOperations;
    private removeNode;
    private removeRelationship;
    private cleanupStagingData;
}
//# sourceMappingURL=PromotionService.d.ts.map