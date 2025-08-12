import { Request, Response } from 'express';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';
import { ConfigService } from '../services/ConfigService';
import { FileProcessingService } from '../services/FileProcessingService';
import { EventProcessingService } from '../services/EventProcessingService';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

export class GoogleDriveWebhookHandler {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Google Drive webhook handler implementation
  // TODO: Implementation Plan - 05-API-Implementation.md - Webhook security and validation
  // TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Webhook validation and security
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend webhook handler tests
  private postgresService: PostgresService;
  private queueService: QueueService;
  private configService: ConfigService;
  private fileProcessingService: FileProcessingService;
  private eventProcessingService: EventProcessingService;

  constructor(queueService: QueueService) {
    this.postgresService = new PostgresService();
    this.queueService = queueService;
    this.configService = new ConfigService();
    // Create services with proper dependencies to break circular dependency
    const eventProcessingService = new EventProcessingService(null as any, queueService);
    this.fileProcessingService = new FileProcessingService(eventProcessingService);
    // Set the fileProcessingService dependency in eventProcessingService
    (eventProcessingService as any).fileProcessingService = this.fileProcessingService;
    this.eventProcessingService = eventProcessingService;
  }

  /**
   * Handle Google Drive webhook notifications
   * 
   * // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Event-driven file processing pipeline
   * // TODO: Implementation Plan - 05-API-Implementation.md - Webhook processing and event parsing
   * // TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Webhook processing implementation
   * // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend integration tests for webhook handlers
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Validate webhook headers
      const channelId = req.headers['x-goog-channel-id'] as string;
      const resourceId = req.headers['x-goog-resource-id'] as string;
      const resourceState = req.headers['x-goog-resource-state'] as string;
      
      if (!channelId || !resourceId) {
        res.status(400).json({ error: 'Missing required headers' });
        return;
      }
      
      // Process the notification based on resource state
      if (resourceState === 'sync') {
        // Initial sync notification - acknowledge
        res.status(200).json({ message: 'Sync acknowledged' });
        return;
      }
      
      if (resourceState === 'update') {
        // File change notification - process changes
        await this.processGoogleDriveChanges(channelId, resourceId);
        res.status(200).json({ message: 'Changes processed' });
        return;
      }
      
      res.status(200).json({ message: 'Notification received' });
    } catch (error) {
      console.error('Error handling Google Drive webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Process Google Drive file changes
   */
  private async processGoogleDriveChanges(channelId: string, resourceId: string): Promise<void> {
    try {
      // Get the source information from the channel
      const source = await this.getSourceFromChannel(channelId);
      if (!source) {
        console.error('Source not found for channel:', channelId);
        return;
      }

      // Get Google Drive service with stored credentials
      const drive = await this.getGoogleDriveService(source.id);
      if (!drive) {
        console.error('Could not initialize Google Drive service for source:', source.id);
        return;
      }

      // Get changes using the stored page token
      const startPageToken = await this.getStoredPageToken(source.id);
      const changesResponse = await drive.changes.list({
        pageToken: startPageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });

      const changes = changesResponse.data.changes || [];
      
      // Process each change
      for (const change of changes) {
        if (change.file) {
          await this.processFileChange(change, source);
        }
      }

      // Update stored page token
      if (changesResponse.data.nextPageToken) {
        await this.updateStoredPageToken(source.id, changesResponse.data.nextPageToken);
      }

    } catch (error) {
      console.error('Error processing Google Drive changes:', error);
      throw error;
    }
  }

  /**
   * Process individual file change
   */
  private async processFileChange(change: any, source: any): Promise<void> {
    try {
      const file = change.file;
      const changeType = change.removed ? 'file_deleted' : 
                        (change.file.createdTime === change.file.modifiedTime ? 'file_created' : 'file_updated');

      // Create event record
      const eventData = {
        id: uuidv4(),
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

      // Store event in database
      await this.storeGoogleDriveEvent(eventData);

      // Queue for processing
      await this.queueService.addJob('file-sync', 'sync-event', {
        orgId: source.org_id,
        sourceId: source.id,
        eventType: changeType,
        resourcePath: eventData.file_path,
        eventData: eventData
      });

    } catch (error) {
      console.error('Error processing file change:', error);
      throw error;
    }
  }

  /**
   * Get Google Drive service instance
   */
  private async getGoogleDriveService(sourceId: string): Promise<any> {
    try {
      // Get stored credentials for the source
      const credentials = await this.getStoredCredentials(sourceId);
      if (!credentials) {
        return null;
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        process.env.GOOGLE_DRIVE_REDIRECT_URI
      );

      oauth2Client.setCredentials(credentials);
      
      return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (error) {
      console.error('Error creating Google Drive service:', error);
      return null;
    }
  }

  /**
   * Get file path in Google Drive
   */
  private async getFilePath(fileId: string, source: any): Promise<string> {
    try {
      const drive = await this.getGoogleDriveService(source.id);
      if (!drive) {
        return '/';
      }

      const pathParts: string[] = [];
      let currentFileId = fileId;

      // Traverse up the folder hierarchy
      while (currentFileId) {
        const file = await drive.files.get({
          fileId: currentFileId,
          fields: 'name,parents'
        });

        pathParts.unshift(file.data.name);

        // Get parent folder
        if (file.data.parents && file.data.parents.length > 0) {
          currentFileId = file.data.parents[0];
        } else {
          break;
        }
      }

      return '/' + pathParts.join('/');
    } catch (error) {
      console.error('Error getting file path:', error);
      return '/';
    }
  }

  /**
   * Store Google Drive event in database
   */
  private async storeGoogleDriveEvent(eventData: any): Promise<void> {
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

  /**
   * Get source from webhook channel ID
   */
  private async getSourceFromChannel(channelId: string): Promise<any> {
    const query = `
      SELECT * FROM sources 
      WHERE provider = 'google_drive' 
      AND settings->>'webhook_channel_id' = $1
    `;

    const result = await this.postgresService.executeQuery(query, [channelId]);
    return result.rows[0] || null;
  }

  /**
   * Get stored credentials for source
   */
  private async getStoredCredentials(sourceId: string): Promise<any> {
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

  /**
   * Get stored page token for changes API
   */
  private async getStoredPageToken(sourceId: string): Promise<string> {
    const query = `
      SELECT settings FROM sources WHERE id = $1
    `;

    const result = await this.postgresService.executeQuery(query, [sourceId]);
    const source = result.rows[0];
    
    return source?.settings?.page_token || '1';
  }

  /**
   * Update stored page token
   */
  private async updateStoredPageToken(sourceId: string, pageToken: string): Promise<void> {
    const query = `
      UPDATE sources 
      SET settings = jsonb_set(settings, '{page_token}', $2::jsonb)
      WHERE id = $1
    `;

    await this.postgresService.executeQuery(query, [sourceId, JSON.stringify(pageToken)]);
  }

  /**
   * Setup Google Drive push notifications for a source
   */
  async setupPushNotifications(sourceId: string, orgId: string): Promise<void> {
    try {
      const drive = await this.getGoogleDriveService(sourceId);
      if (!drive) {
        throw new Error('Could not initialize Google Drive service');
      }

      // Get initial page token
      const startPageTokenResponse = await drive.changes.getStartPageToken();
      const startPageToken = startPageTokenResponse.data.startPageToken;

      // Create webhook channel
      const channelId = uuidv4();
      const webhook = await drive.changes.watch({
        pageToken: startPageToken,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: `${process.env.WEBHOOK_BASE_URL}/webhooks/google-drive`,
          token: orgId // Use org_id as verification token
        }
      });

      // Update source with webhook information
      await this.updateSourceWebhookInfo(sourceId, channelId, webhook.data.resourceId, startPageToken);

    } catch (error) {
      console.error('Error setting up Google Drive push notifications:', error);
      throw error;
    }
  }

  /**
   * Update source with webhook information
   */
  private async updateSourceWebhookInfo(
    sourceId: string, 
    channelId: string, 
    resourceId: string, 
    pageToken: string
  ): Promise<void> {
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
