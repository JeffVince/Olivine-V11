import { OAuth2Client } from 'google-auth-library';
export interface GoogleDriveFile {
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
    webViewLink?: string;
    parents?: string[];
}
export interface GoogleDriveListResponse {
    files: GoogleDriveFile[];
    nextPageToken?: string;
}
export interface GoogleDriveTokenData extends Record<string, unknown> {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: string;
}
export declare class GoogleDriveService {
    private postgresService;
    private configService;
    private clientId;
    private clientSecret;
    private redirectUri;
    constructor();
    generateAuthUrl(): string;
    exchangeCodeForTokens(code: string): Promise<GoogleDriveTokenData>;
    refreshAccessToken(refreshToken: string): Promise<GoogleDriveTokenData>;
    getStoredTokens(orgId: string, sourceId: string): Promise<GoogleDriveTokenData | null>;
    storeTokens(orgId: string, sourceId: string, tokenData: GoogleDriveTokenData): Promise<void>;
    getClient(orgId: string, sourceId: string): Promise<OAuth2Client | null>;
    listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<GoogleDriveListResponse>;
    downloadFile(orgId: string, sourceId: string, fileId: string): Promise<unknown>;
    getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<unknown>;
    uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<unknown>;
    deleteFile(orgId: string, sourceId: string, filePath: string): Promise<unknown>;
}
//# sourceMappingURL=GoogleDriveService.d.ts.map