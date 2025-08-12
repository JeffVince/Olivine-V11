import { Dropbox, DropboxAuth } from 'dropbox';
import { PostgresService } from './PostgresService';
import { ConfigService } from './ConfigService';

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

export class DropboxService {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Dropbox service implementation
  // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Dropbox API integration and OAuth
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend storage service tests
  private dropboxClient: Dropbox;
  private dropboxAuth: DropboxAuth;
  private postgresService: PostgresService;
  private configService: ConfigService;
  private appKey: string;
  private appSecret: string;
  private redirectUri: string;

  constructor() {
    this.configService = new ConfigService();
    this.postgresService = new PostgresService();
    this.appKey = process.env.DROPBOX_APP_KEY || '';
    this.appSecret = process.env.DROPBOX_APP_SECRET || '';
    this.redirectUri = process.env.DROPBOX_REDIRECT_URI || '';
    
    // Initialize with empty client, will be updated with tokens
    this.dropboxClient = new Dropbox({
      clientId: this.appKey,
      clientSecret: this.appSecret
    });
    
    // Initialize auth client for OAuth operations
    this.dropboxAuth = new DropboxAuth({
      clientId: this.appKey,
      clientSecret: this.appSecret
    });
  }

  /**
   * Generate Dropbox authorization URL with required scopes
   * 
   * // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Dropbox OAuth flow implementation
   * // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Dropbox OAuth scope configuration
   */
  async generateAuthUrl(): Promise<string> {
    const scopes = [
      'files.metadata.read',
      'files.content.read',
      'team_data.member',
      'team_info.read',
      'files.team_metadata.read'
    ];

    const authUrl = await this.dropboxAuth.getAuthenticationUrl(
      this.redirectUri,
      undefined,
      'code',
      'offline',
      scopes
    );
    
    return authUrl.toString();
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<DropboxTokenData> {
    try {
      const tokenResponse = await this.dropboxAuth.getAccessTokenFromCode(
        this.redirectUri,
        code
      );

      const tokenData: DropboxTokenData = {
        access_token: (tokenResponse.result as any).access_token,
        refresh_token: (tokenResponse.result as any).refresh_token,
        expires_at: Date.now() + ((tokenResponse.result as any).expires_in * 1000),
        account_id: (tokenResponse.result as any).account_id
      };

      // Check if this is a team account
      const clientWithToken = new Dropbox({
        accessToken: tokenData.access_token,
        clientId: this.appKey,
        clientSecret: this.appSecret
      });

      try {
        const accountInfo = await clientWithToken.usersGetCurrentAccount();
        if ((accountInfo.result as any).team) {
          tokenData.is_team_account = true;
          tokenData.home_namespace_id = (accountInfo.result as any).account_id;
          tokenData.root_namespace_id = (accountInfo.result as any).team.id;
          
          // Get team member info
          try {
            const teamInfo = await clientWithToken.teamTokenGetAuthenticatedAdmin();
            tokenData.team_member_id = (teamInfo.result as any).admin_profile.team_member_id;
          } catch (teamError) {
            console.warn('Could not get team member info:', teamError);
          }
        } else {
          tokenData.is_team_account = false;
        }
      } catch (error) {
        console.error('Error getting account info:', error);
      }

      return tokenData;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<DropboxTokenData> {
    try {
      // Create a new auth client with the refresh token
      const authClient = new DropboxAuth({
        clientId: this.appKey,
        clientSecret: this.appSecret,
        refreshToken: refreshToken
      });
      
      this.dropboxAuth.setRefreshToken(refreshToken);
      await this.dropboxAuth.refreshAccessToken();
      
      return {
        access_token: this.dropboxAuth.getAccessToken(),
        refresh_token: refreshToken,
        expires_at: (this.dropboxAuth.getAccessTokenExpiresAt() as Date).getTime(),
        account_id: '' // This will be updated when we fetch account info
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  /**
   * Get stored tokens for an organization and source
   */
  async getStoredTokens(orgId: string, sourceId: string): Promise<DropboxTokenData | null> {
    try {
      const query = `
        SELECT metadata->>'dropbox_access_token' as access_token,
               metadata->>'dropbox_refresh_token' as refresh_token,
               metadata->>'dropbox_expires_at' as expires_at,
               metadata->>'dropbox_account_id' as account_id,
               metadata->>'dropbox_team_member_id' as team_member_id,
               metadata->>'dropbox_is_team_account' as is_team_account,
               metadata->>'dropbox_home_namespace_id' as home_namespace_id,
               metadata->>'dropbox_root_namespace_id' as root_namespace_id
        FROM sources 
        WHERE organization_id = $1 AND id = $2 AND type = 'dropbox'
      `;
      
      const result = await this.postgresService.executeQuery(query, [orgId, sourceId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      return {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: parseInt(row.expires_at),
        account_id: row.account_id,
        team_member_id: row.team_member_id,
        is_team_account: row.is_team_account === 'true',
        home_namespace_id: row.home_namespace_id,
        root_namespace_id: row.root_namespace_id
      };
    } catch (error) {
      console.error('Error getting stored tokens:', error);
      throw error;
    }
  }

  /**
   * Store tokens for an organization and source
   */
  async storeTokens(orgId: string, sourceId: string, tokenData: DropboxTokenData): Promise<void> {
    try {
      const query = `
        UPDATE sources 
        SET metadata = metadata || $1::jsonb,
            updated_at = NOW()
        WHERE organization_id = $2 AND id = $3
      `;
      
      const metadata = {
        dropbox_access_token: tokenData.access_token,
        dropbox_refresh_token: tokenData.refresh_token,
        dropbox_expires_at: tokenData.expires_at.toString(),
        dropbox_account_id: tokenData.account_id,
        dropbox_team_member_id: tokenData.team_member_id,
        dropbox_is_team_account: tokenData.is_team_account?.toString() || 'false',
        dropbox_home_namespace_id: tokenData.home_namespace_id,
        dropbox_root_namespace_id: tokenData.root_namespace_id
      };
      
      await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  }

  /**
   * Initialize Dropbox client with access token
   */
  private initializeClient(accessToken: string, selectUser?: string, pathRoot?: string): Dropbox {
    const options: any = {
      accessToken: accessToken,
      clientId: this.appKey,
      clientSecret: this.appSecret
    };
    
    if (selectUser) {
      options.selectUser = selectUser;
    }
    
    if (pathRoot) {
      options.pathRoot = pathRoot;
    }
    
    return new Dropbox(options);
  }

  /**
   * Get Dropbox client with proper authentication and headers
   */
  async getClient(orgId: string, sourceId: string): Promise<Dropbox | null> {
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
      
      const client = this.initializeClient(
        tokenData.access_token, 
        tokenData.team_member_id
      );
      
      return client;
    } catch (error) {
      console.error('Error getting Dropbox client:', error);
      return null;
    }
  }

  /**
   * List folder contents with proper namespace handling
   */
  async listFolder(orgId: string, sourceId: string, path: string = '', namespace: string = 'home'): Promise<any> {
    try {
      const tokenData = await this.getStoredTokens(orgId, sourceId);
      
      if (!tokenData) {
        throw new Error('Could not initialize Dropbox client');
      }
      
      // Check if token is expired
      if (Date.now() >= tokenData.expires_at) {
        // Refresh token
        const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
        await this.storeTokens(orgId, sourceId, refreshedTokenData);
        tokenData.access_token = refreshedTokenData.access_token;
      }
      
      let pathRoot: string | undefined;
      // Set path root header based on namespace
      if (tokenData.is_team_account && namespace === 'team') {
        if (tokenData.root_namespace_id) {
          pathRoot = JSON.stringify({ '.tag': 'root', 'root': tokenData.root_namespace_id });
        }
      } else if (namespace === 'home') {
        pathRoot = JSON.stringify({ '.tag': 'home' });
      }
      
      const client = this.initializeClient(tokenData.access_token, tokenData.team_member_id, pathRoot);
      
      const response = await client.filesListFolder({
        path: path,
        recursive: false
      });
      
      return response;
    } catch (error) {
      console.error('Error listing Dropbox folder:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(orgId: string, sourceId: string, path: string): Promise<any> {
    const client = await this.getClient(orgId, sourceId);
    if (!client) {
      throw new Error('Could not initialize Dropbox client');
    }

    try {
      const response = await client.filesGetMetadata({ path });
      return response.result;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(orgId: string, sourceId: string, path: string): Promise<any> {
    const client = await this.getClient(orgId, sourceId);
    if (!client) {
      throw new Error('Could not initialize Dropbox client');
    }

    try {
      const response = await client.filesDownload({ path });
      return response.result;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }
}
