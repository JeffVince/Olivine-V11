import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSourceMetadata, updateSourceMetadata } from './storage';

export interface SupabaseTokenData extends Record<string, unknown> {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

export class SupabaseService {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Supabase service implementation
  // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Supabase API integration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend storage service tests
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
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
      const row = await getSourceMetadata(orgId, sourceId, 'supabase', [
        'supabase_access_token',
        'supabase_refresh_token',
        'supabase_expires_at',
        'supabase_token_type'
      ]);

      if (!row) return null;

      return {
        access_token: row.supabase_access_token,
        refresh_token: row.supabase_refresh_token,
        expires_at: parseInt(row.supabase_expires_at),
        token_type: row.supabase_token_type
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
      const metadata = {
        supabase_access_token: tokenData.access_token,
        supabase_refresh_token: tokenData.refresh_token,
        supabase_expires_at: tokenData.expires_at.toString(),
        supabase_token_type: tokenData.token_type
      };
      await updateSourceMetadata(orgId, sourceId, metadata);
    } catch (error) {
      console.error('Error storing Supabase tokens:', error);
      throw error;
    }
  }

  /**
   * Upload file to Supabase storage
   */
  async uploadFile(orgId: string, sourceId: string, filePath: string, fileBuffer: Buffer, contentType: string): Promise<unknown> {
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
  async downloadFile(orgId: string, sourceId: string, filePath: string): Promise<unknown> {
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
  async listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<unknown[]> {
    try {
      const client = await this.getClient(orgId, sourceId);
      
      if (!client) {
        throw new Error('Could not initialize Supabase client');
      }
      
      // Supabase doesn't use pageToken, so we ignore it
      const { data, error } = await client.storage
        .from('files')
        .list('');
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error listing Supabase files:', error);
      throw error;
    }
  }

  /**
   * Delete file from Supabase storage
   */
  async deleteFile(orgId: string, sourceId: string, filePath: string): Promise<unknown> {
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
  async subscribeToChanges(orgId: string, sourceId: string, callback: (payload: unknown) => void): Promise<unknown> {
    try {
      const client = await this.getClient(orgId, sourceId);
      
      if (!client) {
        throw new Error('Could not initialize Supabase client');
      }
      
      // For Supabase, we'll use a default table name for file changes
      // In a real implementation, this might need to be configurable
      const tableName = 'files';
      
      const subscription = client
        .channel(`storage-changes-${orgId}-${sourceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName
          },
          (payload: unknown) => {
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

  /**
   * Get file metadata from Supabase
   */
  async getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<unknown> {
    try {
      const client = await this.getClient(orgId, sourceId);
      
      if (!client) {
        throw new Error('Could not initialize Supabase client');
      }
      
      // In Supabase, we can get file metadata by listing files with a specific path
      // This assumes fileId is actually the file path in Supabase storage
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
        // Return the first matching file's metadata
        return data[0];
      } else {
        throw new Error('File not found');
      }
    } catch (error) {
      console.error('Error getting file metadata from Supabase:', error);
      throw error;
    }
  }
}
