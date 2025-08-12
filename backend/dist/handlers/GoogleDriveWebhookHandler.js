"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveWebhookHandler = void 0;
const PostgresService_1 = require("../services/PostgresService");
const ConfigService_1 = require("../services/ConfigService");
const FileProcessingService_1 = require("../services/FileProcessingService");
const EventProcessingService_1 = require("../services/EventProcessingService");
const googleapis_1 = require("googleapis");
class GoogleDriveWebhookHandler {
    constructor(queueService) {
        this.postgresService = new PostgresService_1.PostgresService();
        this.queueService = queueService;
        this.configService = new ConfigService_1.ConfigService();
        this.fileProcessingService = new FileProcessingService_1.FileProcessingService();
        this.eventProcessingService = new EventProcessingService_1.EventProcessingService();
    }
    async handleWebhook(req, res) {
        try {
            const channelId = req.headers['x-goog-channel-id'];
            const resourceId = req.headers['x-goog-resource-id'];
            const resourceState = req.headers['x-goog-resource-state'];
            if (!channelId || !resourceId) {
                res.status(400).json({ error: 'Missing required headers' });
                return;
            }
            if (resourceState === 'sync') {
                res.status(200).json({ status: 'sync acknowledged' });
                return;
            }
            const source = await this.findSourceByChannelId(channelId);
            if (!source) {
                console.warn(`No source found for channel ID: ${channelId}`);
                res.status(200).json({ status: 'no source found' });
                return;
            }
            await this.processGoogleDriveChanges(source.organization_id, source.id);
            res.status(200).json({ status: 'processed' });
        }
        catch (error) {
            console.error('Error handling Google Drive webhook:', error instanceof Error ? error.message : String(error));
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async findSourceByChannelId(channelId) {
        try {
            const query = `
        SELECT id, organization_id, metadata
        FROM sources 
        WHERE type = 'google_drive' 
        AND metadata->>'gdrive_channel_id' = $1
      `;
            const result = await this.postgresService.executeQuery(query, [channelId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        }
        catch (error) {
            console.error('Error finding source by channel ID:', error);
            return null;
        }
    }
    async getStoredPageToken(orgId, sourceId) {
        try {
            const query = `
        SELECT metadata->>'gdrive_page_token' as page_token
        FROM sources 
        WHERE organization_id = $1 AND id = $2 AND type = 'google_drive'
      `;
            const result = await this.postgresService.executeQuery(query, [orgId, sourceId]);
            if (result.rows.length === 0) {
                return null;
            }
            return result.rows[0].page_token;
        }
        catch (error) {
            console.error('Error getting stored page token:', error);
            throw error;
        }
    }
    async processGoogleDriveChanges(orgId, sourceId) {
        try {
            const pageToken = await this.getStoredPageToken(orgId, sourceId);
            if (pageToken) {
                await this.processChanges(orgId, sourceId, pageToken);
            }
            else {
                await this.initializePageToken(orgId, sourceId);
            }
        }
        catch (error) {
            console.error(`Error processing Google Drive changes for source ${sourceId}:`, error);
            throw error;
        }
    }
    async processChanges(orgId, sourceId, pageToken) {
        try {
            const auth = await this.getGoogleDriveClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const response = await drive.changes.list({
                pageToken: pageToken,
                fields: 'nextPageToken, newStartPageToken, changes(file(id, name, mimeType, modifiedTime, size, parents, trashed))'
            });
            const changes = response.data.changes || [];
            let nextPageToken = response.data.nextPageToken;
            const newStartPageToken = response.data.newStartPageToken;
            for (const change of changes) {
                if (change.file) {
                    await this.processGoogleDriveFileChange(orgId, sourceId, change.file);
                    await this.queueService.addJob('file-sync', 'sync-event', {
                        orgId,
                        sourceId,
                        eventType: change.file.trashed ? 'file_deleted' : 'file_updated',
                        resourcePath: change.file.name || change.file.id,
                        eventData: change.file,
                    });
                }
            }
            while (nextPageToken) {
                const nextPageResponse = await drive.changes.list({
                    pageToken: nextPageToken,
                    fields: 'nextPageToken, changes(file(id, name, mimeType, modifiedTime, size, parents, trashed))'
                });
                const nextPageChanges = nextPageResponse.data.changes || [];
                nextPageToken = nextPageResponse.data.nextPageToken;
                for (const change of nextPageChanges) {
                    if (change.file) {
                        await this.processGoogleDriveFileChange(orgId, sourceId, change.file);
                    }
                }
            }
            if (newStartPageToken) {
                await this.storePageToken(orgId, sourceId, newStartPageToken);
            }
        }
        catch (error) {
            console.error('Error processing Google Drive changes:', error);
            throw error;
        }
    }
    async initializePageToken(orgId, sourceId) {
        try {
            const auth = await this.getGoogleDriveClient(orgId, sourceId);
            if (!auth) {
                throw new Error('Could not initialize Google Drive client');
            }
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
            const response = await drive.changes.getStartPageToken();
            const startPageToken = response.data.startPageToken;
            if (startPageToken) {
                await this.storePageToken(orgId, sourceId, startPageToken);
                console.log(`Initialized page token for Google Drive source ${sourceId}: ${startPageToken}`);
            }
        }
        catch (error) {
            console.error(`Error initializing page token for source ${sourceId}:`, error);
            throw error;
        }
    }
    async processGoogleDriveFileChange(orgId, sourceId, file) {
        try {
            if (file.trashed) {
                await this.handleGoogleDriveFileDelete(orgId, sourceId, file);
            }
            else {
                await this.handleGoogleDriveFileCreateOrUpdate(orgId, sourceId, file);
            }
        }
        catch (error) {
            console.error(`Error processing Google Drive file change for ${file.id}:`, error);
            throw error;
        }
    }
    async handleGoogleDriveFileCreateOrUpdate(orgId, sourceId, file) {
        try {
            const filePath = await this.buildFilePath(orgId, sourceId, file);
            const normalizedMetadata = {
                gdrive_file_id: file.id,
                name: file.name,
                mime_type: file.mimeType,
                size: file.size ? parseInt(file.size) : undefined,
                modified_time: file.modifiedTime,
                parents: file.parents || [],
                web_view_link: file.webViewLink,
                web_content_link: file.webContentLink
            };
            await this.fileProcessingService.processFileChange({
                fileId: file.id,
                organizationId: orgId,
                sourceId,
                filePath,
                action: 'update',
                metadata: normalizedMetadata
            });
            console.log(`Processed Google Drive file: ${file.name} (${file.id})`);
        }
        catch (error) {
            console.error(`Error handling Google Drive file create/update for ${file.id}:`, error);
            throw error;
        }
    }
    async handleGoogleDriveFileDelete(orgId, sourceId, file) {
        try {
            await this.fileProcessingService.processFileChange({
                fileId: file.id,
                organizationId: orgId,
                sourceId,
                filePath: file.name || file.id,
                action: 'delete'
            });
            console.log(`Processed Google Drive file deletion: ${file.name || file.id}`);
        }
        catch (error) {
            console.error(`Error handling Google Drive file deletion for ${file.id}:`, error);
            throw error;
        }
    }
    async buildFilePath(orgId, sourceId, file) {
        return file.name || file.id;
    }
    async handleDeletedFile(orgId, sourceId, file) {
        const deleteQuery = `
      DELETE FROM files 
      WHERE organization_id = $1 AND source_id = $2 AND path = $3
    `;
        await this.postgresService.executeQuery(deleteQuery, [
            orgId,
            sourceId,
            file.id
        ]);
    }
    async storePageToken(orgId, sourceId, pageToken) {
        const query = `
      UPDATE sources 
      SET metadata = metadata || $1::jsonb,
          updated_at = NOW()
      WHERE organization_id = $2 AND id = $3
    `;
        const metadata = { gdrive_page_token: pageToken };
        await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
    }
    async getGoogleDriveClient(orgId, sourceId) {
        try {
            const query = `
        SELECT metadata->>'gdrive_access_token' as access_token,
               metadata->>'gdrive_refresh_token' as refresh_token
        FROM sources 
        WHERE organization_id = $1 AND id = $2 AND type = 'google_drive'
      `;
            const result = await this.postgresService.executeQuery(query, [orgId, sourceId]);
            if (result.rows.length === 0 || !result.rows[0].access_token) {
                return null;
            }
            const metadata = result.rows[0];
            const clientId = process.env.GOOGLE_CLIENT_ID || '';
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
            const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_DRIVE_REDIRECT_URI || '');
            oauth2Client.setCredentials({
                access_token: metadata.access_token,
                refresh_token: metadata.refresh_token
            });
            return oauth2Client;
        }
        catch (error) {
            console.error('Error getting Google Drive client:', error);
            return null;
        }
    }
    async processFileChange(orgId, sourceId, file) {
        try {
            if (file.trashed) {
                await this.handleDeletedFile(orgId, sourceId, file);
            }
            else {
                await this.handleModifiedFile(orgId, sourceId, file);
            }
        }
        catch (error) {
            console.error(`Error processing file change for ${file.name}:`, error);
            throw error;
        }
    }
    async handleModifiedFile(orgId, sourceId, file) {
        const normalizedMetadata = {
            name: file.name,
            path: file.name,
            size: file.size,
            modified: file.modifiedTime,
            is_folder: file.mimeType === 'application/vnd.google-apps.folder',
            mime_type: file.mimeType,
            id: file.id,
            parents: file.parents
        };
        const upsertQuery = `
      INSERT INTO files (organization_id, source_id, path, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (organization_id, source_id, path) 
      DO UPDATE SET 
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
        await this.postgresService.executeQuery(upsertQuery, [
            orgId,
            sourceId,
            file.id,
            JSON.stringify(normalizedMetadata)
        ]);
        if (file.mimeType !== 'application/vnd.google-apps.folder') {
            await this.queueService.addJob('file-classification', 'process-file', {
                orgId,
                sourceId,
                resourcePath: file.name,
                action: 'process'
            });
        }
    }
}
exports.GoogleDriveWebhookHandler = GoogleDriveWebhookHandler;
//# sourceMappingURL=GoogleDriveWebhookHandler.js.map