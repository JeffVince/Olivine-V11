export interface GoogleDriveTokenData {
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
    getClient(orgId: string, sourceId: string): Promise<any | null>;
    listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<any>;
    downloadFile(orgId: string, sourceId: string, fileId: string): Promise<any>;
    getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<any>;
}
//# sourceMappingURL=GoogleDriveService.d.ts.map