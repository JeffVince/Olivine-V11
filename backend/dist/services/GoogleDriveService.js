"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveService = void 0;
const googleapis_1 = require("googleapis");
const PostgresService_1 = require("./PostgresService");
const ConfigService_1 = require("./ConfigService");
class GoogleDriveService {
    constructor() {
        this.postgresService = new PostgresService_1.PostgresService();
        this.configService = new ConfigService_1.ConfigService();
        this.clientId = process.env.GOOGLE_CLIENT_ID || '';
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        this.redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
    }
    generateAuthUrl() {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
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
    async exchangeCodeForTokens(code) {
        try {
            const oauth2Client = new googleapis_1.google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
            const tokenResponse = await oauth2Client.getToken(code);
            const tokens = tokenResponse.tokens;
            return {
                access_token: tokens.access_token || '',
                refresh_token: tokens.refresh_token || '',
                expires_at: Date.now() + (tokens.expiry_date ? (tokens.expiry_date - Date.now()) : 3600000),
                token_type: tokens.token_type || ''
            };
        }
        catch (error) {
            console.error('Error exchanging code for Google Drive tokens:', error);
            throw error;
        }
    }
    async refreshAccessToken(refreshToken) {
        try {
            const oauth2Client = new googleapis_1.google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const tokenResponse = await oauth2Client.refreshAccessToken();
            const tokens = tokenResponse.credentials;
            return {
                access_token: tokens.access_token || '',
                refresh_token: refreshToken || '',
                expires_at: Date.now() + (tokens.expiry_date ? (tokens.expiry_date - Date.now()) : 3600000),
                token_type: tokens.token_type || ''
            };
        }
        catch (error) {
            console.error('Error refreshing Google Drive access token:', error);
            throw error;
        }
    }
    async getStoredTokens(orgId, sourceId) {
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
        }
        catch (error) {
            console.error('Error getting stored Google Drive tokens:', error);
            throw error;
        }
    }
    async storeTokens(orgId, sourceId, tokenData) {
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
        }
        catch (error) {
            console.error('Error storing Google Drive tokens:', error);
            throw error;
        }
    }
    async getClient(orgId, sourceId) {
        try {
            const tokenData = await this.getStoredTokens(orgId, sourceId);
            if (!tokenData) {
                return null;
            }
            if (Date.now() >= tokenData.expires_at) {
                const refreshedTokenData = await this.refreshAccessToken(tokenData.refresh_token);
                await this.storeTokens(orgId, sourceId, refreshedTokenData);
                tokenData.access_token = refreshedTokenData.access_token;
            }
            const oauth2Client = new googleapis_1.google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
            oauth2Client.setCredentials({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token
            });
            return oauth2Client;
        }
        catch (error) {
            console.error('Error getting Google Drive client:', error);
            return null;
        }
    }
    async listFiles(orgId, sourceId, pageToken) {
        try {
            const auth = await this.getClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const response = await drive.files.list({
                q: "'root' in parents",
                fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents)',
                pageToken: pageToken,
                pageSize: 100
            });
            return {
                files: (response.data.files || []).map(file => ({
                    id: file.id || undefined,
                    name: file.name || undefined,
                    mimeType: file.mimeType || undefined,
                    size: file.size || undefined,
                    createdTime: file.createdTime || undefined,
                    modifiedTime: file.modifiedTime || undefined,
                    webViewLink: file.webViewLink || undefined,
                    parents: file.parents || undefined
                })),
                nextPageToken: response.data.nextPageToken || undefined
            };
        }
        catch (error) {
            console.error('Error listing Google Drive files:', error);
            throw error;
        }
    }
    async downloadFile(orgId, sourceId, fileId) {
        try {
            const auth = await this.getClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const response = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'stream' });
            return response.data;
        }
        catch (error) {
            console.error('Error downloading Google Drive file:', error);
            throw error;
        }
    }
    async getFileMetadata(orgId, sourceId, fileId) {
        try {
            const auth = await this.getClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const response = await drive.files.get({
                fileId: fileId,
                fields: 'id, name, mimeType, modifiedTime, size, parents, webViewLink, webContentLink'
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting Google Drive file metadata:', error);
            throw error;
        }
    }
    async uploadFile(orgId, sourceId, filePath, fileBuffer, contentType) {
        try {
            const auth = await this.getClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const response = await drive.files.create({
                requestBody: {
                    name: filePath.split('/').pop(),
                    parents: [filePath.substring(0, filePath.lastIndexOf('/')) || 'root']
                },
                media: {
                    mimeType: contentType,
                    body: fileBuffer
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error uploading file to Google Drive:', error);
            throw error;
        }
    }
    async deleteFile(orgId, sourceId, filePath) {
        try {
            const auth = await this.getClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const fileName = filePath.split('/').pop();
            const response = await drive.files.list({
                q: `name = '${fileName}'`,
                fields: 'files(id)'
            });
            if (response.data.files && response.data.files.length > 0) {
                const fileId = response.data.files[0].id;
                if (fileId) {
                    await drive.files.delete({ fileId });
                    return { success: true };
                }
                else {
                    throw new Error('File ID is null');
                }
            }
            else {
                throw new Error('File not found');
            }
        }
        catch (error) {
            console.error('Error deleting file from Google Drive:', error);
            throw error;
        }
    }
}
exports.GoogleDriveService = GoogleDriveService;
//# sourceMappingURL=GoogleDriveService.js.map