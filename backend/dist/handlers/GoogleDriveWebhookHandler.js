"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveWebhookHandler = void 0;
const PostgresService_1 = require("../services/PostgresService");
const ConfigService_1 = require("../services/ConfigService");
const FileProcessingService_1 = require("../services/FileProcessingService");
const EventProcessingService_1 = require("../services/EventProcessingService");
const googleapis_1 = require("googleapis");
const uuid_1 = require("uuid");
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
                res.status(200).json({ message: 'Sync acknowledged' });
                return;
            }
            if (resourceState === 'update') {
                await this.processGoogleDriveChanges(channelId, resourceId);
                res.status(200).json({ message: 'Changes processed' });
                return;
            }
            res.status(200).json({ message: 'Notification received' });
        }
        catch (error) {
            console.error('Error handling Google Drive webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async processGoogleDriveChanges(channelId, resourceId) {
        try {
            const source = await this.getSourceFromChannel(channelId);
            if (!source) {
                console.error('Source not found for channel:', channelId);
                return;
            }
            const drive = await this.getGoogleDriveService(source.id);
            if (!drive) {
                console.error('Could not initialize Google Drive service for source:', source.id);
                return;
            }
            const startPageToken = await this.getStoredPageToken(source.id);
            const changesResponse = await drive.changes.list({
                pageToken: startPageToken,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true
            });
            const changes = changesResponse.data.changes || [];
            for (const change of changes) {
                if (change.file) {
                    await this.processFileChange(change, source);
                }
            }
            if (changesResponse.data.nextPageToken) {
                await this.updateStoredPageToken(source.id, changesResponse.data.nextPageToken);
            }
        }
        catch (error) {
            console.error('Error processing Google Drive changes:', error);
            throw error;
        }
    }
    async processFileChange(change, source) {
        try {
            const file = change.file;
            const changeType = change.removed ? 'file_deleted' :
                (change.file.createdTime === change.file.modifiedTime ? 'file_created' : 'file_updated');
            const eventData = {
                id: (0, uuid_1.v4)(),
                org_id: source.org_id,
                source_id: source.id,
                event_type: changeType,
                file_id: file.id,
                file_name: file.name,
                file_path: await this.getFilePath(file.id, source),
                file_size: parseInt(file.size) || 0,
                mime_type: file.mimeType,
                modified_at: new Date(file.modifiedTime),
                metadata: {
                    parents: file.parents || [],
                    webViewLink: file.webViewLink,
                    webContentLink: file.webContentLink,
                    kind: file.kind,
                    driveId: file.driveId
                },
                processed: false,
                created_at: new Date()
            };
            await this.storeGoogleDriveEvent(eventData);
            await this.queueService.addJob('file-sync', 'sync-event', {
                orgId: source.org_id,
                sourceId: source.id,
                eventType: changeType,
                resourcePath: eventData.file_path,
                eventData: eventData
            });
        }
        catch (error) {
            console.error('Error processing file change:', error);
            throw error;
        }
    }
    async getGoogleDriveService(sourceId) {
        try {
            const credentials = await this.getStoredCredentials(sourceId);
            if (!credentials) {
                return null;
            }
            const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_DRIVE_CLIENT_ID, process.env.GOOGLE_DRIVE_CLIENT_SECRET, process.env.GOOGLE_DRIVE_REDIRECT_URI);
            oauth2Client.setCredentials(credentials);
            return googleapis_1.google.drive({ version: 'v3', auth: oauth2Client });
        }
        catch (error) {
            console.error('Error creating Google Drive service:', error);
            return null;
        }
    }
    async getFilePath(fileId, source) {
        try {
            const drive = await this.getGoogleDriveService(source.id);
            if (!drive) {
                return '/';
            }
            const pathParts = [];
            let currentFileId = fileId;
            while (currentFileId) {
                const file = await drive.files.get({
                    fileId: currentFileId,
                    fields: 'name,parents'
                });
                pathParts.unshift(file.data.name);
                if (file.data.parents && file.data.parents.length > 0) {
                    currentFileId = file.data.parents[0];
                }
                else {
                    break;
                }
            }
            return '/' + pathParts.join('/');
        }
        catch (error) {
            console.error('Error getting file path:', error);
            return '/';
        }
    }
    async storeGoogleDriveEvent(eventData) {
        const query = `
      INSERT INTO gdrive_events (
        id, org_id, source_id, event_type, file_id, file_name, file_path,
        file_size, mime_type, modified_at, metadata, processed, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        file_size = EXCLUDED.file_size,
        modified_at = EXCLUDED.modified_at,
        metadata = EXCLUDED.metadata
    `;
        await this.postgresService.executeQuery(query, [
            eventData.id,
            eventData.org_id,
            eventData.source_id,
            eventData.event_type,
            eventData.file_id,
            eventData.file_name,
            eventData.file_path,
            eventData.file_size,
            eventData.mime_type,
            eventData.modified_at,
            JSON.stringify(eventData.metadata),
            eventData.processed,
            eventData.created_at
        ]);
    }
    async getSourceFromChannel(channelId) {
        const query = `
      SELECT * FROM sources 
      WHERE provider = 'google_drive' 
      AND settings->>'webhook_channel_id' = $1
    `;
        const result = await this.postgresService.executeQuery(query, [channelId]);
        return result.rows[0] || null;
    }
    async getStoredCredentials(sourceId) {
        const query = `
      SELECT settings FROM sources WHERE id = $1
    `;
        const result = await this.postgresService.executeQuery(query, [sourceId]);
        const source = result.rows[0];
        if (!source || !source.settings || !source.settings.credentials) {
            return null;
        }
        return source.settings.credentials;
    }
    async getStoredPageToken(sourceId) {
        const query = `
      SELECT settings FROM sources WHERE id = $1
    `;
        const result = await this.postgresService.executeQuery(query, [sourceId]);
        const source = result.rows[0];
        return source?.settings?.page_token || '1';
    }
    async updateStoredPageToken(sourceId, pageToken) {
        const query = `
      UPDATE sources 
      SET settings = jsonb_set(settings, '{page_token}', $2::jsonb)
      WHERE id = $1
    `;
        await this.postgresService.executeQuery(query, [sourceId, JSON.stringify(pageToken)]);
    }
    async setupPushNotifications(sourceId, orgId) {
        try {
            const drive = await this.getGoogleDriveService(sourceId);
            if (!drive) {
                throw new Error('Could not initialize Google Drive service');
            }
            const startPageTokenResponse = await drive.changes.getStartPageToken();
            const startPageToken = startPageTokenResponse.data.startPageToken;
            const channelId = (0, uuid_1.v4)();
            const webhook = await drive.changes.watch({
                pageToken: startPageToken,
                requestBody: {
                    id: channelId,
                    type: 'web_hook',
                    address: `${process.env.WEBHOOK_BASE_URL}/webhooks/google-drive`,
                    token: orgId
                }
            });
            await this.updateSourceWebhookInfo(sourceId, channelId, webhook.data.resourceId, startPageToken);
        }
        catch (error) {
            console.error('Error setting up Google Drive push notifications:', error);
            throw error;
        }
    }
    async updateSourceWebhookInfo(sourceId, channelId, resourceId, pageToken) {
        const query = `
      UPDATE sources 
      SET settings = jsonb_set(
        jsonb_set(
          jsonb_set(settings, '{webhook_channel_id}', $2::jsonb),
          '{webhook_resource_id}', $3::jsonb
        ),
        '{page_token}', $4::jsonb
      )
      WHERE id = $1
    `;
        await this.postgresService.executeQuery(query, [
            sourceId,
            JSON.stringify(channelId),
            JSON.stringify(resourceId),
            JSON.stringify(pageToken)
        ]);
    }
}
exports.GoogleDriveWebhookHandler = GoogleDriveWebhookHandler;
//# sourceMappingURL=GoogleDriveWebhookHandler.js.map