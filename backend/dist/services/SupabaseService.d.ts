import { SupabaseClient } from '@supabase/supabase-js';
export interface SupabaseTokenData {
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
    uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<any>;
    downloadFile(orgId: string, sourceId: string, filePath: string): Promise<any>;
    listFiles(orgId: string, sourceId: string, path?: string): Promise<any>;
    deleteFile(orgId: string, sourceId: string, filePath: string): Promise<any>;
    subscribeToChanges(orgId: string, sourceId: string, tableName: string, callback: (payload: any) => void): Promise<any>;
}
//# sourceMappingURL=SupabaseService.d.ts.map