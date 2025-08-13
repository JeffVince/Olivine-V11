import { SupabaseClient } from '@supabase/supabase-js';
export interface SupabaseTokenData extends Record<string, unknown> {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: string;
}
export declare class SupabaseService {
    private postgresService;
    private configService;
    private supabaseUrl;
    private supabaseKey;
    constructor();
    getClient(orgId: string, sourceId: string): Promise<SupabaseClient | null>;
    getStoredTokens(orgId: string, sourceId: string): Promise<SupabaseTokenData | null>;
    storeTokens(orgId: string, sourceId: string, tokenData: SupabaseTokenData): Promise<void>;
    uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<unknown>;
    downloadFile(orgId: string, sourceId: string, filePath: string): Promise<unknown>;
    listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<unknown[]>;
    deleteFile(orgId: string, sourceId: string, filePath: string): Promise<unknown>;
    subscribeToChanges(orgId: string, sourceId: string, callback: (payload: unknown) => void): Promise<unknown>;
    getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<unknown>;
}
//# sourceMappingURL=SupabaseService.d.ts.map