import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { PostgresService } from './PostgresService';
import { ConfigService } from './ConfigService';

export interface GoogleDriveTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

export class GoogleDriveService {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Google Drive service implementation
  // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Google Drive API integration and OAuth
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend storage service tests
  private postgresService: PostgresService;
  private configService: ConfigService;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.postgresService = new PostgresService();
    this.configService = new ConfigService();
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  }

  /**
   * Generate Google Drive authorization URL with required scopes
   */
  generateAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleDriveTokenData> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      const tokenResponse = await oauth2Client.getToken(code);
      const tokens = tokenResponse.tokens;

      return {
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token || '',
        expires_at: Date.now() + (tokens.expiry_date ? (tokens.expiry_date - Date.now()) : 3600000),
        token_type: tokens.token_type || ''
      };
    } catch (error) {
      console.error('Error exchanging code for Google Drive tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleDriveTokenData> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const tokenResponse = await oauth2Client.refreshAccessToken();
      const tokens = tokenResponse.credentials;

      return {
        access_token: tokens.access_token || '',
        refresh_token: refreshToken || '',
        expires_at: Date.now() + (tokens.expiry_date ? (tokens.expiry_date - Date.now()) : 3600000),
        token_type: tokens.token_type || ''
      };
    } catch (error) {
      console.error('Error refreshing Google Drive access token:', error);
      throw error;
    }
  }

  /**
   * Get stored tokens for an organization and source
   */
  async getStoredTokens(orgId: string, sourceId: string): Promise<GoogleDriveTokenData | null> {
    try {
      const query = `
        SELECT metadata->>'gdrive_access_token' as access_token,
               metadata->>'gdrive_refresh_token' as refresh_token,
               metadata->>'gdrive_expires_at' as expires_at,
               metadata->>'gdrive_token_type' as token_type
        FROM sources 
        WHERE organization_id = $1 AND id = $2 AND type = 'google_drive'
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
      console.error('Error getting stored Google Drive tokens:', error);
      throw error;
    }
  }

  /**
   * Store tokens for an organization and source
   */
  async storeTokens(orgId: string, sourceId: string, tokenData: GoogleDriveTokenData): Promise<void> {
    try {
      const query = `
        UPDATE sources 
        SET metadata = metadata || $1::jsonb,
            updated_at = NOW()
        WHERE organization_id = $2 AND id = $3
      `;
      
      const metadata = {
        gdrive_access_token: tokenData.access_token,
        gdrive_refresh_token: tokenData.refresh_token,
        gdrive_expires_at: tokenData.expires_at.toString(),
        gdrive_token_type: tokenData.token_type
      };
      
      await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
    } catch (error) {
      console.error('Error storing Google Drive tokens:', error);
      throw error;
    }
  }

  /**
   * Get authenticated Google Drive client
   */
  async getClient(orgId: string, sourceId: string): Promise<any | null> {
    try {
      const tokenData = await this.getStoredTokens(orgId, sourceId);
      
      if (!tokenData) {
        return null;
      }
      
      // Check if token is expired
      if (Date.now() >= tokenData.expires_at) {
        // Refresh token
        const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
        await this.storeTokens(orgId, sourceId, refreshedTokenData);
        tokenData.access_token = refreshedTokenData.access_token;
      }
      
      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      
      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token
      });
      
      return oauth2Client;
    } catch (error) {
      console.error('Error getting Google Drive client:', error);
      return null;
    }
  }

  /**
   * List files in Google Drive
   */
  async listFiles(orgId: string, sourceId: string, pageToken?: string): Promise<any> {
    try {
      const auth = await this.getClient(orgId, sourceId);
      
      if (!auth) {
        throw new Error('Could not initialize Google Drive client');
      }
      
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.list({
        pageSize: 100,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
        pageToken: pageToken
      });
      
      return response.data;
    } catch (error) {
      console.error('Error listing Google Drive files:', error);
      throw error;
    }
  }

  /**
   * Download file content from Google Drive
   */
  async downloadFile(orgId: string, sourceId: string, fileId: string): Promise<any> {
    try {
      const auth = await this.getClient(orgId, sourceId);
      
      if (!auth) {
        throw new Error('Could not initialize Google Drive client');
      }
      
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });
      
      return response.data;
    } catch (error) {
      console.error('Error downloading Google Drive file:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  async getFileMetadata(orgId: string, sourceId: string, fileId: string): Promise<any> {
    try {
      const auth = await this.getClient(orgId, sourceId);
      
      if (!auth) {
        throw new Error('Could not initialize Google Drive client');
      }
      
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, modifiedTime, size, parents, webViewLink, webContentLink'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting Google Drive file metadata:', error);
      throw error;
    }
  }
}
