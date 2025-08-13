export interface StorageProvider {
    getClient(orgId: string, sourceId: string): Promise<unknown | null>;
    listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<{
        files: unknown[];
        nextPageToken?: string;
    } | unknown[]>;
    downloadFile(orgId: string, sourceId: string, fileId: string): Promise<unknown>;
    getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<unknown>;
    uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<unknown>;
    deleteFile(orgId: string, sourceId: string, filePath: string): Promise<unknown>;
    subscribeToChanges?(orgId: string, sourceId: string, callback: (payload: unknown) => void): Promise<unknown>;
    getStoredTokens(orgId: string, sourceId: string): Promise<Record<string, unknown> | null>;
    storeTokens(orgId: string, sourceId: string, tokenData: Record<string, unknown>): Promise<void>;
}
export type StorageProviderType = 'dropbox' | 'gdrive' | 'supabase';
export declare class StorageProviderFactory {
    static createProvider(type: StorageProviderType): Promise<StorageProvider>;
}
export interface SyncOrchestrator {
    syncProviders(orgId: string, sourceIds: string[]): Promise<void>;
    resolveConflicts(orgId: string, conflicts: unknown[]): Promise<void>;
    optimizeOperations(orgId: string, operations: unknown[]): Promise<void>;
}
export declare class MultiProviderSyncOrchestrator implements SyncOrchestrator {
    syncProviders(orgId: string, sourceIds: string[]): Promise<void>;
    resolveConflicts(orgId: string, conflicts: unknown[]): Promise<void>;
    optimizeOperations(orgId: string, operations: unknown[]): Promise<void>;
}
//# sourceMappingURL=StorageProvider.d.ts.map