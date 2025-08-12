import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PostgresService } from './PostgresService';
import { ConfigService } from './ConfigService';

export interface SupabaseTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

export class SupabaseService {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Supabase service implementation
  // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Supabase API integration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend storage service tests
  private postgresService: PostgresService;
  private configService: ConfigService;
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    this.postgresService = new PostgresService();
    this.configService = new ConfigService();
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_KEY || '';
  }

  /**
   * Get authenticated Supabase client
   */
  async getClient(orgId: string, sourceId: string): Promise<SupabaseClient | null> {
    try {
      const tokenData = await this.getStoredTokens(orgId, sourceId);
      
      if (!tokenData) {
        return null;
      }
      
      // Initialize Supabase client with access token
      const supabase = createClient(this.supabaseUrl, this.supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        }
      });
      
      return supabase;
    } catch (error) {
      console.error('Error getting Supabase client:', error);
      return null;
    }
  }

  /**
   * Get stored tokens for an organization and source
   */
  async getStoredTokens(orgId: string, sourceId: string): Promise<SupabaseTokenData | null> {
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
    } catch (error) {
      console.error('Error getting stored Supabase tokens:', error);
      throw error;
    }
  }

  /**
   * Store tokens for an organization and source
   */
  async storeTokens(orgId: string, sourceId: string, tokenData: SupabaseTokenData): Promise<void> {
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
    } catch (error) {
      console.error('Error storing Supabase tokens:', error);
      throw error;
    }
  }

  /**
   * Upload file to Supabase storage
   */
  async uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<any> {
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
    } catch (error) {
      console.error('Error uploading file to Supabase:', error);
      throw error;
    }
  }

  /**
   * Download file from Supabase storage
   */
  async downloadFile(orgId: string, sourceId: string, filePath: string): Promise<any> {
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
    } catch (error) {
      console.error('Error downloading file from Supabase:', error);
      throw error;
    }
  }

  /**
   * List files in Supabase storage
   */
  async listFiles(orgId: string, sourceId: string, path?: string): Promise<any> {
    try {
      const client = await this.getClient(orgId, sourceId);
      
      if (!client) {
        throw new Error('Could not initialize Supabase client');
      }
      
      const { data, error } = await client.storage
        .from('files')
        .list(path);
      
      if (error) {
        throw new Error(`Error listing files in Supabase: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error listing files in Supabase:', error);
      throw error;
    }
  }

  /**
   * Delete file from Supabase storage
   */
  async deleteFile(orgId: string, sourceId: string, filePath: string): Promise<any> {
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
    } catch (error) {
      console.error('Error deleting file from Supabase:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time changes
   */
  async subscribeToChanges(orgId: string, sourceId: string, tableName: string, callback: (payload: any) => void): Promise<any> {
    try {
      const client = await this.getClient(orgId, sourceId);
      
      if (!client) {
        throw new Error('Could not initialize Supabase client');
      }
      
      const subscription = client
        .channel(`storage-changes-${orgId}-${sourceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName
          },
          (payload: any) => {
            callback(payload);
          }
        )
        .subscribe();
      
      return subscription;
    } catch (error) {
      console.error('Error subscribing to Supabase changes:', error);
      throw error;
    }
  }
}
