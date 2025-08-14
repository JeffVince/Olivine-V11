import { BaseAgent, AgentConfig } from '../BaseAgent';
import { QueueService } from '../../services/queues/QueueService';
import { EventEmitter } from 'events';
import { SyncStatus } from './types';
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
export * from './types';
//# sourceMappingURL=index.d.ts.map