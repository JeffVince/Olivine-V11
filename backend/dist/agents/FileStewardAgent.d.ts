import { BaseAgent, AgentConfig } from './BaseAgent';
import { QueueService } from '../services/queues/QueueService';
export interface SyncJobData {
    orgId: string;
    sourceId: string;
    eventType: 'file_created' | 'file_updated' | 'file_deleted' | 'folder_created' | 'folder_updated' | 'folder_deleted';
    resourcePath: string;
    eventData: any;
}
export interface ClusterProcessingResult {
    fileId: string;
    clusterId: string;
    slots: string[];
    extractionTriggered: boolean;
    crossLayerLinksCreated: number;
}
export interface FileMetadata {
    name: string;
    size: number;
    mimeType: string;
    checksum?: string;
    modified: string;
    dbId: string;
    provider: 'dropbox' | 'gdrive' | 'supabase';
    extra: any;
}
export declare class FileStewardAgent extends BaseAgent {
    private neo4jService;
    private postgresService;
    private dropboxService;
    private gdriveService;
    private fileProcessingService;
    private classificationService;
    private taxonomyService;
    private clusterMode;
    private eventBus;
    constructor(queueService: QueueService, config?: Partial<AgentConfig>);
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
    processSyncEvent(eventData: SyncJobData): Promise<void>;
    private handleFileCreated;
    private handleFileUpdated;
    private handleFileDeleted;
    private handleFolderCreated;
    private handleFolderUpdated;
    private handleFolderDeleted;
    private extractFileMetadata;
    private upsertFileNode;
    private ensureFolderHierarchy;
    private upsertFolderNode;
    private getFileNode;
    private createEntityVersion;
    private updateFileNode;
    private softDeleteFileNode;
    private cleanupOrphanedFolders;
    private shouldClassifyFile;
    private shouldExtractContent;
    private hasSignificantChanges;
    private inferMimeType;
    private classifyFile;
    private updateFileClassification;
    private extractContent;
    private updateFileContent;
    private processFileWithCluster;
    private createContentCluster;
    private performMultiSlotClassification;
    private getApplicableTaxonomyRules;
    private calculateRuleConfidence;
    private createSlotEdgeFact;
    private getFallbackSlot;
    private queueExtractionJobs;
    private getApplicableParsers;
    private createInitialCrossLayerLinks;
    private getProjectScenes;
    private getProjectPurchaseOrders;
    private createCrossLayerLink;
    enableClusterMode(): void;
    disableClusterMode(): void;
    processSyncEventWithCluster(eventData: any): Promise<ClusterProcessingResult>;
    getEventBus(): any;
}
//# sourceMappingURL=FileStewardAgent.d.ts.map