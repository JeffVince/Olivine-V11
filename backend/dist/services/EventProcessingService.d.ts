import { Job } from 'bullmq';
interface SyncJobData {
    fileId: string;
    sourceId: string;
    orgId: string;
    action: 'create' | 'update' | 'delete';
    filePath: string;
    metadata: any;
}
interface ClassificationJobData {
    fileId: string;
    orgId: string;
    fileContent: string;
    mimeType: string;
}
interface ExtractionJobData {
    fileId: string;
    orgId: string;
    fileContent: string;
    mimeType: string;
}
export declare class EventProcessingService {
    private queueService;
    private neo4jService;
    private postgresService;
    private fileModel;
    private sourceModel;
    private taxonomyService;
    private fileProcessingService;
    private agentStatus;
    private retryAttempts;
    private maxRetryAttempts;
    private fileSyncQueue;
    private fileClassificationQueue;
    private contentExtractionQueue;
    constructor();
    addSyncJob(jobData: SyncJobData, priority?: number): Promise<string>;
    addClassificationJob(jobData: ClassificationJobData, priority?: number): Promise<string>;
    addExtractionJob(jobData: ExtractionJobData, priority?: number): Promise<string>;
    handleSyncEvent(job: Job<SyncJobData>): Promise<void>;
    classifyFile(job: Job<ClassificationJobData>): Promise<void>;
    extractContent(job: Job<ExtractionJobData>): Promise<void>;
    private syncFileToGraph;
    private removeFileFromGraph;
    private updateFileClassificationInPostgres;
    private updateFileClassificationInNeo4j;
    private updateFileContentInPostgres;
    private updateFileContentInNeo4j;
    private determineFileType;
    private extractTextContent;
    startWorkers(): Promise<void>;
    close(): Promise<void>;
    private createCommit;
    private createAction;
    private createEntityVersion;
    private updateAgentStatus;
    private executeWithRetry;
    private handleSyncError;
    private extractFileName;
    private extractFileExtension;
    private extractTags;
    private createFileRelationships;
    private createClassificationRelationships;
    private createContentExtractionRelationships;
    private ensureFolderHierarchy;
    private upsertFolderNode;
    private createFolderRelationship;
    private cleanupOrphanedRelationships;
    private reportWorkerError;
    private updateWorkerStats;
    private handleJobFailure;
    private performHealthCheck;
}
export {};
//# sourceMappingURL=EventProcessingService.d.ts.map