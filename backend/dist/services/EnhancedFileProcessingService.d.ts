import { FileProcessingService } from './FileProcessingService';
import { EventProcessingService } from './EventProcessingService';
interface FileProcessingRequest {
    fileId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    size: number;
    orgId: string;
    sourceId: string;
    userId: string;
    extractedText?: string;
    metadata?: Record<string, any>;
}
interface FileProcessingResult {
    fileId: string;
    success: boolean;
    classification?: {
        slot: string;
        confidence: number;
        method: string;
    };
    contentAnalysis?: {
        scenes?: number;
        characters?: number;
        props?: number;
    };
    noveltyDetection?: {
        isNovel: boolean;
        noveltyScore: number;
        alertLevel: string;
    };
    error?: string;
    processingTime: number;
}
export declare class EnhancedFileProcessingService extends FileProcessingService {
    private taxonomyService;
    private orchestrator;
    private provenance;
    private neo4j;
    private queueService;
    constructor(eventProcessingService: EventProcessingService);
    processFileWithAI(request: FileProcessingRequest): Promise<FileProcessingResult>;
    batchProcessFiles(requests: FileProcessingRequest[]): Promise<FileProcessingResult[]>;
    processFilesByCriteria(criteria: {
        orgId: string;
        sourceId?: string;
        mimeTypes?: string[];
        minSize?: number;
        maxSize?: number;
        unclassifiedOnly?: boolean;
    }, userId: string): Promise<FileProcessingResult[]>;
    reprocessFilesWithUpdatedRules(orgId: string, userId: string): Promise<FileProcessingResult[]>;
    getProcessingStatistics(orgId: string): Promise<any>;
    private ensureFileNodeExists;
    private determineWorkflow;
    private isScriptFile;
    private waitForWorkflowCompletion;
    private updateFileProcessingStatus;
    schedulePeriodicReprocessing(orgId: string, intervalHours?: number): Promise<void>;
    handleFileDeleted(fileId: string, orgId: string, userId: string): Promise<void>;
    private sleep;
}
export {};
//# sourceMappingURL=EnhancedFileProcessingService.d.ts.map