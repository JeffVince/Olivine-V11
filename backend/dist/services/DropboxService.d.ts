import { Dropbox } from 'dropbox';
export interface DropboxTokenData {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    account_id: string;
    team_member_id?: string;
    is_team_account?: boolean;
    home_namespace_id?: string;
    root_namespace_id?: string;
}
export declare class DropboxService {
    private dropboxClient;
    private dropboxAuth;
    private postgresService;
    private configService;
    private appKey;
    private appSecret;
    private redirectUri;
    constructor();
    generateAuthUrl(): Promise<string>;
    exchangeCodeForTokens(code: string): Promise<DropboxTokenData>;
    refreshAccessToken(refreshToken: string): Promise<DropboxTokenData>;
    getStoredTokens(orgId: string, sourceId: string): Promise<DropboxTokenData | null>;
    storeTokens(orgId: string, sourceId: string, tokenData: DropboxTokenData): Promise<void>;
    private initializeClient;
    getClient(orgId: string, sourceId: string): Promise<Dropbox | null>;
    listFolder(orgId: string, sourceId: string, path?: string, namespace?: string): Promise<any>;
    getFileMetadata(orgId: string, sourceId: string, path: string): Promise<any>;
    downloadFile(orgId: string, sourceId: string, path: string): Promise<any>;
}
//# sourceMappingURL=DropboxService.d.ts.map