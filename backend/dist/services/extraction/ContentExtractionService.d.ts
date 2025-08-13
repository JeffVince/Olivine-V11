import { BaseService } from '../BaseService';
import { PostgresService } from '../PostgresService';
import { Neo4jService } from '../Neo4jService';
import { QueueService } from '../queues/QueueService';
export interface ExtractionJobData {
    jobId: string;
    orgId: string;
    fileId: string;
    slot: string;
    parser: string;
    parserVersion: string;
    metadata: any;
}
export interface ExtractedEntity {
    kind: string;
    data: any;
    confidence: number;
    sourceOffset?: string;
}
export interface ExtractedLink {
    fromHash: string;
    toHash: string;
    relType: string;
    data: any;
    confidence: number;
}
export interface ExtractionResult {
    entities: ExtractedEntity[];
    links: ExtractedLink[];
    metadata: any;
}
export declare class ContentExtractionService extends BaseService {
    private postgresService;
    private neo4jService;
    private queueService;
    private parsers;
    private agentRegistry;
    constructor(postgresService: PostgresService, neo4jService: Neo4jService, queueService: QueueService);
    private initializeParsers;
    processExtractionJob(jobData: ExtractionJobData): Promise<void>;
    private storeExtractedEntities;
    private storeExtractedLinks;
    private updateJobStatus;
    private calculateEntityHash;
    private normalizeEntityData;
    private calculateOverallConfidence;
    private getExtractionAgent;
    private convertAgentResult;
    private shouldAutoPromote;
    private getFileContent;
    private extractScriptContent;
    private extractBudgetContent;
    private extractCallSheetContent;
    private extractLocation;
    private extractTimeOfDay;
    private getDepartmentForRole;
}
//# sourceMappingURL=ContentExtractionService.d.ts.map