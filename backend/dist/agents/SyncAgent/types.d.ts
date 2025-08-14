export interface SyncJobData {
    orgId: string;
    sourceId: string;
    eventType: 'file_added' | 'file_modified' | 'file_deleted' | 'folder_added' | 'folder_deleted';
    resourcePath: string;
    eventData: any;
    webhookId?: string;
    timestamp: Date;
}
export interface SyncStatus {
    sourceId: string;
    status: 'idle' | 'syncing' | 'error' | 'paused';
    lastSync: Date | null;
    filesProcessed: number;
    totalFiles: number;
    progress: number;
    errors: string[];
}
//# sourceMappingURL=types.d.ts.map