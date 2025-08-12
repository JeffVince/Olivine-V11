export interface StorageProvider {
    getClient(orgId: string, sourceId: string): Promise<any | null>;
    listFiles(orgId: string, sourceId: string, options?: any): Promise<any>;
    downloadFile(orgId: string, sourceId: string, fileId: string): Promise<any>;
    getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<any>;
    uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<any>;
    deleteFile(orgId: string, sourceId: string, filePath: string): Promise<any>;
    subscribeToChanges?(orgId: string, sourceId: string, callback: (payload: any) => void): Promise<any>;
    getStoredTokens(orgId: string, sourceId: string): Promise<any | null>;
    storeTokens(orgId: string, sourceId: string, tokenData: any): Promise<void>;
}
export type StorageProviderType = 'dropbox' | 'gdrive' | 'supabase';
export declare class StorageProviderFactory {
    static createProvider(type: StorageProviderType): StorageProvider;
}
export interface SyncOrchestrator {
    syncProviders(orgId: string, sourceIds: string[]): Promise<void>;
    resolveConflicts(orgId: string, conflicts: any[]): Promise<void>;
    optimizeOperations(orgId: string, operations: any[]): Promise<void>;
}
export declare class MultiProviderSyncOrchestrator implements SyncOrchestrator {
    syncProviders(orgId: string, sourceIds: string[]): Promise<void>;
    resolveConflicts(orgId: string, conflicts: any[]): Promise<void>;
    optimizeOperations(orgId: string, operations: any[]): Promise<void>;
}
//# sourceMappingURL=StorageProvider.d.ts.map