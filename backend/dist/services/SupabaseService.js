"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const PostgresService_1 = require("./PostgresService");
const ConfigService_1 = require("./ConfigService");
class SupabaseService {
    constructor() {
        this.postgresService = new PostgresService_1.PostgresService();
        this.configService = new ConfigService_1.ConfigService();
        this.supabaseUrl = process.env.SUPABASE_URL || '';
        this.supabaseKey = process.env.SUPABASE_KEY || '';
    }
    async getClient(orgId, sourceId) {
        try {
            const tokenData = await this.getStoredTokens(orgId, sourceId);
            if (!tokenData) {
                return null;
            }
            const supabase = (0, supabase_js_1.createClient)(this.supabaseUrl, this.supabaseKey, {
                global: {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`
                    }
                }
            });
            return supabase;
        }
        catch (error) {
            console.error('Error getting Supabase client:', error);
            return null;
        }
    }
    async getStoredTokens(orgId, sourceId) {
        try {
            const query = `
        SELECT metadata->>'supabase_access_token' as access_token,
               metadata->>'supabase_refresh_token' as refresh_token,
               metadata->>'supabase_expires_at' as expires_at,
               metadata->>'supabase_token_type' as token_type
        FROM sources 
        WHERE org_id = $1 AND id = $2 AND type = 'supabase'
      `;
            const sources = await this.postgresService.executeQuery(query, [orgId, sourceId]);
            if (sources.rows.length === 0) {
                return null;
            }
            const row = sources.rows[0];
            return {
                access_token: row.access_token,
                refresh_token: row.refresh_token,
                expires_at: parseInt(row.expires_at),
                token_type: row.token_type
            };
        }
        catch (error) {
            console.error('Error getting stored Supabase tokens:', error);
            throw error;
        }
    }
    async storeTokens(orgId, sourceId, tokenData) {
        try {
            const query = `
        UPDATE sources 
        SET metadata = metadata || $1::jsonb,
            updated_at = NOW()
        WHERE org_id = $2 AND id = $3
      `;
            const metadata = {
                supabase_access_token: tokenData.access_token,
                supabase_refresh_token: tokenData.refresh_token,
                supabase_expires_at: tokenData.expires_at.toString(),
                supabase_token_type: tokenData.token_type
            };
            await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
        }
        catch (error) {
            console.error('Error storing Supabase tokens:', error);
            throw error;
        }
    }
    async uploadFile(orgId, sourceId, filePath, fileBuffer, contentType) {
        try {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Supabase client');
            }
            const { data, error } = await client.storage
                .from('files')
                .upload(filePath, fileBuffer, {
                contentType: contentType,
                upsert: true
            });
            if (error) {
                throw new Error(`Error uploading file to Supabase: ${error.message}`);
            }
            return data;
        }
        catch (error) {
            console.error('Error uploading file to Supabase:', error);
            throw error;
        }
    }
    async downloadFile(orgId, sourceId, filePath) {
        try {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Supabase client');
            }
            const { data, error } = await client.storage
                .from('files')
                .download(filePath);
            if (error) {
                throw new Error(`Error downloading file from Supabase: ${error.message}`);
            }
            return data;
        }
        catch (error) {
            console.error('Error downloading file from Supabase:', error);
            throw error;
        }
    }
    async listFiles(orgId, sourceId, pageToken) {
        try {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Supabase client');
            }
            const { data, error } = await client.storage
                .from('files')
                .list('');
            if (error) {
                throw error;
            }
            return data || [];
        }
        catch (error) {
            console.error('Error listing Supabase files:', error);
            throw error;
        }
    }
    async deleteFile(orgId, sourceId, filePath) {
        try {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Supabase client');
            }
            const { data, error } = await client.storage
                .from('files')
                .remove([filePath]);
            if (error) {
                throw new Error(`Error deleting file from Supabase: ${error.message}`);
            }
            return data;
        }
        catch (error) {
            console.error('Error deleting file from Supabase:', error);
            throw error;
        }
    }
    async subscribeToChanges(orgId, sourceId, callback) {
        try {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Supabase client');
            }
            const tableName = 'files';
            const subscription = client
                .channel(`storage-changes-${orgId}-${sourceId}`)
                .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: tableName
            }, (payload) => {
                callback(payload);
            })
                .subscribe();
            return subscription;
        }
        catch (error) {
            console.error('Error subscribing to Supabase changes:', error);
            throw error;
        }
    }
    async getFileMetadata(orgId, sourceId, fileId) {
        try {
            const client = await this.getClient(orgId, sourceId);
            if (!client) {
                throw new Error('Could not initialize Supabase client');
            }
            const { data, error } = await client.storage
                .from('files')
                .list(undefined, {
                limit: 1,
                offset: 0,
                search: fileId
            });
            if (error) {
                throw new Error(`Error getting file metadata from Supabase: ${error.message}`);
            }
            if (data && data.length > 0) {
                return data[0];
            }
            else {
                throw new Error('File not found');
            }
        }
        catch (error) {
            console.error('Error getting file metadata from Supabase:', error);
            throw error;
        }
    }
}
exports.SupabaseService = SupabaseService;
//# sourceMappingURL=SupabaseService.js.map