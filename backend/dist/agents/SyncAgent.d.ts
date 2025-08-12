import { BaseAgent, AgentConfig } from './BaseAgent';
import { QueueService } from '../services/queues/QueueService';
import { EventEmitter } from 'events';
interface SyncStatus {
    sourceId: string;
    status: 'idle' | 'syncing' | 'error' | 'paused';
    lastSync: Date | null;
    filesProcessed: number;
    totalFiles: number;
    progress: number;
    errors: string[];
}
export declare class SyncAgent extends BaseAgent {
    private neo4jService;
    private postgresService;
    private dropboxService;
    private googleDriveService;
    private supabaseService;
    private syncStatuses;
    private eventEmitter;
    constructor(queueService: QueueService, config?: Partial<AgentConfig>);
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
    private processWebhookEvent;
    private updateSyncStatus;
    private getSource;
    private handleFileChange;
    private handleFolderChange;
    private markFileAsDeleted;
    private markFolderAsDeleted;
    private processBulkSync;
    private processDeltaSync;
    private startPeriodicHealthCheck;
    getSyncStatus(sourceId: string): SyncStatus | null;
    getAllSyncStatuses(): Map<string, SyncStatus>;
    getEventEmitter(): EventEmitter;
}
export {};
//# sourceMappingURL=SyncAgent.d.ts.map