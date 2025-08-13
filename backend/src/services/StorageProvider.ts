export interface StorageProvider {
  /**
   * Get authenticated client for the storage provider
   * 
   * // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Storage provider interface implementation
   * // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Storage provider client authentication
   */
  getClient(orgId: string, sourceId: string): Promise<unknown | null>;

  /**
   * List files in the storage provider
   */
  listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<{ files: unknown[]; nextPageToken?: string } | unknown[]>;

  /**
   * Download file content from the storage provider
   */
  downloadFile(orgId: string, sourceId: string, fileId: string): Promise<unknown>;

  /**
   * Get file metadata from the storage provider
   */
  getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<unknown>;

  /**
   * Upload file to the storage provider
   */
  uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<unknown>;

  /**
   * Delete file from the storage provider
   */
  deleteFile(orgId: string, sourceId: string, filePath: string): Promise<unknown>;

  /**
   * Subscribe to real-time changes (if supported)
   */
  subscribeToChanges?(orgId: string, sourceId: string, callback: (payload: unknown) => void): Promise<unknown>;

  /**
   * Get stored tokens for authentication
   */
  getStoredTokens(orgId: string, sourceId: string): Promise<Record<string, unknown> | null>;

  /**
   * Store tokens for authentication
   */
  storeTokens(orgId: string, sourceId: string, tokenData: Record<string, unknown>): Promise<void>;
}

export type StorageProviderType = 'dropbox' | 'gdrive' | 'supabase';

export class StorageProviderFactory {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Storage provider factory implementation
  // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Storage provider factory pattern
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend storage provider factory tests
  static async createProvider(type: StorageProviderType): Promise<StorageProvider> {
    // Use static imports so instanceof works with jest mocks
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DropboxService } = require('./DropboxService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleDriveService } = require('./GoogleDriveService');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SupabaseService } = require('./SupabaseService');

    switch (type) {
      case 'dropbox':
        return new DropboxService();
      case 'gdrive':
        return new GoogleDriveService();
      case 'supabase':
        return new SupabaseService();
      default:
        throw new Error(`Unsupported storage provider type: ${type}`);
    }
  }
}

export interface SyncOrchestrator {
  /**
   * Coordinate synchronization across multiple providers
   */
  syncProviders(orgId: string, sourceIds: string[]): Promise<void>;

  /**
   * Handle conflicts between providers
   */
  resolveConflicts(orgId: string, conflicts: unknown[]): Promise<void>;

  /**
   * Optimize multi-provider operations
   */
  optimizeOperations(orgId: string, operations: unknown[]): Promise<void>;
}

export class MultiProviderSyncOrchestrator implements SyncOrchestrator {
  async syncProviders(orgId: string, sourceIds: string[]): Promise<void> {
    // Implementation for coordinating sync across providers
    console.log(`Syncing providers for org ${orgId}: ${sourceIds.join(', ')}`);
    // TODO: Implement actual sync coordination logic
  }

  async resolveConflicts(orgId: string, conflicts: unknown[]): Promise<void> {
    // Implementation for resolving conflicts between providers
    console.log(`Resolving ${conflicts.length} conflicts for org ${orgId}`);
    // TODO: Implement actual conflict resolution logic
  }

  async optimizeOperations(orgId: string, operations: unknown[]): Promise<void> {
    // Implementation for optimizing multi-provider operations
    console.log(`Optimizing ${operations.length} operations for org ${orgId}`);
    // TODO: Implement actual optimization logic
  }
}
