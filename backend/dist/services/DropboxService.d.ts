import { Dropbox } from 'dropbox';
import { StorageProvider } from './StorageProvider';
import { EventEmitter } from 'events';
export interface DropboxMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    retryCount: number;
    rateLimitHits: number;
    averageResponseTime: number;
    bytesTransferred: number;
    operationCounts: {
        [operation: string]: number;
    };
    errorCounts: {
        [errorType: string]: number;
    };
}
export interface DropboxLogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    operation: string;
    orgId?: string;
    sourceId?: string;
    message: string;
    metadata?: Record<string, unknown>;
    duration?: number;
    error?: Error | string | Record<string, unknown>;
}
export interface DropboxTokenData extends Record<string, unknown> {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    account_id: string;
    team_member_id?: string;
    is_team_account?: boolean;
    home_namespace_id?: string;
    root_namespace_id?: string;
}
export interface DropboxApiError {
    error_summary: string;
    error: {
        '.tag': string;
        [key: string]: unknown;
    };
}
export interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    retryCondition?: (error: unknown) => boolean;
}
export declare class DropboxService extends EventEmitter implements StorageProvider {
    private dropboxClient;
    private dropboxAuth;
    private postgresService;
    private configService;
    private appKey;
    private appSecret;
    private redirectUri;
    private defaultRetryOptions;
    private rateLimitTracker;
    private metrics;
    private logs;
    private maxLogEntries;
    constructor();
    private log;
    private updateMetrics;
    getMetrics(): DropboxMetrics;
    getLogs(limit?: number, level?: 'info' | 'warn' | 'error' | 'debug'): DropboxLogEntry[];
    clearLogs(): void;
    resetMetrics(): void;
    getHealthStatus(): {
        status: 'healthy' | 'warning' | 'error';
        metrics: DropboxMetrics;
        recentErrors: DropboxLogEntry[];
        rateLimitStatus: {
            [operation: string]: number;
        };
    };
    exportDiagnostics(): {
        timestamp: Date;
        metrics: DropboxMetrics;
        logs: DropboxLogEntry[];
        healthStatus: {
            status: string;
            details?: Record<string, unknown>;
        };
        configuration: {
            maxRetries: number;
            baseDelay: number;
            maxDelay: number;
            maxLogEntries: number;
        };
    };
    private isRetryableError;
    private calculateBackoffDelay;
    private executeWithRetry;
    private checkRateLimit;
    private extractRetryAfter;
    private sleep;
    private sanitizeError;
    private enhanceError;
    generateAuthUrl(state?: string): Promise<string>;
    exchangeCodeForTokens(code: string): Promise<DropboxTokenData>;
    refreshAccessToken(refreshToken: string): Promise<DropboxTokenData>;
    getStoredTokens(orgId: string, sourceId: string): Promise<DropboxTokenData | null>;
    storeTokens(orgId: string, sourceId: string, tokenData: DropboxTokenData): Promise<void>;
    private initializeClient;
    getClient(orgId: string, sourceId: string): Promise<Dropbox | null>;
    listFolder(orgId: string, sourceId: string, path?: string, namespace?: string): Promise<any>;
    getFileMetadata(orgId: string, sourceId: string, path: string): Promise<any>;
    downloadFile(orgId: string, sourceId: string, path: string): Promise<any>;
    uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<any>;
    private uploadLargeFile;
    deleteFile(orgId: string, sourceId: string, filePath: string): Promise<any>;
    listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<any>;
    moveFile(orgId: string, sourceId: string, fromPath: string, toPath: string): Promise<any>;
    copyFile(orgId: string, sourceId: string, fromPath: string, toPath: string): Promise<any>;
    createFolder(orgId: string, sourceId: string, path: string): Promise<any>;
    createSharedLink(orgId: string, sourceId: string, path: string, settings?: Record<string, unknown>): Promise<any>;
    getSharedLinks(orgId: string, sourceId: string, path: string): Promise<any>;
    revokeSharedLink(orgId: string, sourceId: string, url: string): Promise<any>;
    shareFolder(orgId: string, sourceId: string, path: string, members: Array<{
        email: string;
        access_level: string;
    }>): Promise<any>;
    getFolderSharingInfo(orgId: string, sourceId: string, sharedFolderId: string): Promise<any>;
    listFolderMembers(orgId: string, sourceId: string, sharedFolderId: string): Promise<any>;
    removeFolderMember(orgId: string, sourceId: string, sharedFolderId: string, memberEmail: string): Promise<any>;
    updateFolderMemberPermissions(orgId: string, sourceId: string, sharedFolderId: string, memberEmail: string, accessLevel: string): Promise<any>;
    batchDownloadFiles(orgId: string, sourceId: string, filePaths: string[]): Promise<any[]>;
    batchUploadFiles(orgId: string, sourceId: string, files: Array<{
        path: string;
        buffer: Buffer;
        contentType: string;
    }>): Promise<any[]>;
    batchDeleteFiles(orgId: string, sourceId: string, filePaths: string[]): Promise<any[]>;
    batchCopyFiles(orgId: string, sourceId: string, operations: Array<{
        from_path: string;
        to_path: string;
    }>): Promise<any>;
    batchMoveFiles(orgId: string, sourceId: string, operations: Array<{
        from_path: string;
        to_path: string;
    }>): Promise<any>;
    private pollBatchJobStatus;
    listFolderWithPagination(orgId: string, sourceId: string, path?: string, options?: {
        recursive?: boolean;
        limit?: number;
        cursor?: string;
        include_media_info?: boolean;
        include_deleted?: boolean;
    }): Promise<{
        entries: Array<Record<string, unknown>>;
        cursor: string;
        has_more: boolean;
    }>;
    getAllFilesInFolder(orgId: string, sourceId: string, path?: string, options?: {
        recursive?: boolean;
        maxFiles?: number;
        include_media_info?: boolean;
    }): Promise<any[]>;
    subscribeToChanges(orgId: string, sourceId: string, callback: (payload: Record<string, unknown>) => void): Promise<any>;
}
//# sourceMappingURL=DropboxService.d.ts.map