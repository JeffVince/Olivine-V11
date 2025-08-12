import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { Dropbox } from 'dropbox';
import { PostgresService } from '../services/PostgresService';
import { QueueService } from '../services/queues/QueueService';
import { ConfigService } from '../services/ConfigService';
import { FileProcessingService } from '../services/FileProcessingService';
import { EventProcessingService } from '../services/EventProcessingService';
import { v4 as uuidv4 } from 'uuid';

export class DropboxWebhookHandler {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Dropbox webhook handler implementation
  // TODO: Implementation Plan - 05-API-Implementation.md - Webhook security and validation
  // TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Webhook validation and security
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend webhook handler tests
  private postgresService: PostgresService;
  private queueService: QueueService;
  private configService: ConfigService;
  private fileProcessingService: FileProcessingService;
  private eventProcessingService: EventProcessingService;
  private webhookSecret: string;

  constructor(queueService: QueueService) {
    this.postgresService = new PostgresService();
    this.queueService = queueService;
    this.configService = new ConfigService();
    // Create services with proper dependencies to break circular dependency
    const eventProcessingService = new EventProcessingService(null as any);
    this.fileProcessingService = new FileProcessingService(eventProcessingService);
    // Set the fileProcessingService dependency in eventProcessingService
    (eventProcessingService as any).fileProcessingService = this.fileProcessingService;
    this.eventProcessingService = eventProcessingService;
    this.webhookSecret = process.env.DROPBOX_WEBHOOK_SECRET || '';
  }

  /**
   * Validates Dropbox webhook signature for security
   * 
   * // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Dropbox webhook signature validation
   * // TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Webhook security implementation
   */
  private validateSignature(body: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Processes incoming Dropbox webhook notifications
   * 
   * // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Event-driven file processing pipeline
   * // TODO: Implementation Plan - 05-API-Implementation.md - Webhook processing and event parsing
   * // TODO: Implementation Checklist - 05-API-GraphQL-Checklist.md - Webhook processing implementation
   * // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend integration tests for webhook handlers
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-dropbox-signature'] as string;
      const body = JSON.stringify(req.body);

      // Handle challenge for webhook verification
      if (req.query.challenge) {
        res.status(200).send(req.query.challenge);
        return;
      }

      // Validate signature for security
      if (!this.validateSignature(body, signature)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const { list_folder } = req.body;
      
      if (list_folder && list_folder.accounts) {
        for (const account of list_folder.accounts) {
          await this.processDeltaChanges(account);
        }
      }

      res.status(200).json({ status: 'processed' });
    } catch (error) {
      console.error('Error handling Dropbox webhook:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Fetches and processes delta changes using Dropbox cursor API
   * 
   * // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Dropbox delta changes processing
   * // TODO: Implementation Plan - 04-Versioning-Branching-Implementation.md - File versioning and temporal validity
   * // TODO: Implementation Checklist - 03-Storage-Integration-Checklist.md - Dropbox API integration and error handling
   * // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend integration tests for Dropbox API
   */
  private async processDeltaChanges(account: string): Promise<void> {
    try {
      // Get all sources for this account
      const sourcesQuery = `
        SELECT id, organization_id, metadata
        FROM sources 
        WHERE metadata->>'dropbox_account_id' = $1 OR metadata->>'dropbox_team_member_id' = $1
      `;
      
      const sourcesResult = await this.postgresService.executeQuery(sourcesQuery, [account]);
      
      for (const source of sourcesResult.rows) {
        const sourceId = source.id;
        const orgId = source.organization_id;
        const metadata = source.metadata;
        
        // Get stored cursor for this source
        let cursor = metadata.dropbox_cursor;
        
        // If no cursor, try to get from metadata.cursor (fallback for existing data)
        if (!cursor && metadata.cursor) {
          cursor = metadata.cursor;
        }
        
        // If still no cursor, do a full listing
        if (!cursor) {
          await this.handleFullListing(orgId, sourceId, account);
          continue;
        }
        
        // Initialize Dropbox client with proper headers for team accounts
        const dropboxOptions: any = {
          accessToken: metadata.dropbox_access_token,
          clientId: process.env.DROPBOX_APP_KEY || '',
          clientSecret: process.env.DROPBOX_APP_SECRET || ''
        };
        
        // Set select user header for team accounts
        if (metadata.dropbox_team_member_id) {
          dropboxOptions.selectUser = metadata.dropbox_team_member_id;
        }
        
        const dropboxClient = new Dropbox(dropboxOptions);
        
        let hasMore = true;
        let currentCursor = cursor;

        while (hasMore) {
          try {
            const response = await dropboxClient.filesListFolderContinue({
              cursor: currentCursor
            });

            // Process each entry in the delta
            for (const entry of response.result.entries) {
              await this.processFileEntry(orgId, sourceId, account, entry);
            }

            hasMore = response.result.has_more;
            currentCursor = response.result.cursor;
          } catch (error: any) {
            if (error.error_summary && error.error_summary.includes('reset')) {
              // Cursor reset - need to do full re-sync
              console.log(`Cursor reset for source ${sourceId}, performing full listing`);
              await this.handleCursorReset(orgId, sourceId, account);
              hasMore = false;
            } else {
              throw error;
            }
          }
        }

        // Store the new cursor
        await this.storeCursor(orgId, sourceId, currentCursor);
      }
    } catch (error) {
      console.error(`Error processing delta changes for account ${account}:`, error);
      throw error;
    }
  }

  /**
   * Processes individual file/folder entries from Dropbox delta
   */
  private async processFileEntry(orgId: string, sourceId: string, account: string, entry: any): Promise<void> {
    try {
      if (entry['.tag'] === 'deleted') {
        // Handle file deletion
        await this.handleDeletedFile(orgId, sourceId, entry);
      } else {
        // Handle file addition/modification
        await this.handleModifiedFile(orgId, sourceId, entry);
      }
    } catch (error) {
      console.error(`Error processing file entry for ${entry.path_display}:`, error);
      throw error;
    }
  }

  /**
   * Handles modified or new files
   */
  private async handleModifiedFile(orgId: string, sourceId: string, entry: any): Promise<void> {
    // Normalize Dropbox metadata to our format
    const normalizedMetadata = {
      name: entry.name,
      path: entry.path_display,
      size: entry.size,
      modified: entry.client_modified || entry.server_modified,
      is_folder: entry['.tag'] === 'folder',
      mime_type: entry['.tag'] === 'file' ? entry.content_hash : null,
      revision: entry.rev,
      id: entry.id
    };

    // Upsert file metadata in PostgreSQL
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
      entry.path_display,
      JSON.stringify(normalizedMetadata)
    ]);

    // Queue file for processing using the event-driven architecture if it's a file (not folder)
    if (entry['.tag'] === 'file') {
      const fileId = uuidv4();
      await this.fileProcessingService.processFileChange({
        fileId,
        organizationId: orgId,
        sourceId,
        filePath: entry.path_display,
        action: 'create',
        metadata: normalizedMetadata
      });

      // Enqueue file-sync job for agent processing
      await this.queueService.addJob('file-sync', 'sync-event', {
        orgId,
        sourceId,
        eventType: 'file_updated',
        resourcePath: entry.path_display,
        eventData: normalizedMetadata,
      });
    }
  }

  /**
   * Handles deleted files
   */
  private async handleDeletedFile(orgId: string, sourceId: string, entry: any): Promise<void> {
    // Mark file as deleted in PostgreSQL
    const deleteQuery = `
      UPDATE files 
      SET deleted_at = NOW()
      WHERE organization_id = $1 AND source_id = $2 AND path = $3
    `;
    
    await this.postgresService.executeQuery(deleteQuery, [
      orgId,
      sourceId,
      entry.path_display
    ]);

    // Queue file for deletion using the event-driven architecture
    const fileId = uuidv4();
    await this.fileProcessingService.processFileChange({
      fileId,
      organizationId: orgId,
      sourceId,
      filePath: entry.path_display,
      action: 'delete'
    });

    // Enqueue file-sync deletion event for agent processing
    await this.queueService.addJob('file-sync', 'sync-event', {
      orgId,
      sourceId,
      eventType: 'file_deleted',
      resourcePath: entry.path_display,
      eventData: { id: entry.id },
    });
  }

  /**
   * Handles cursor reset scenarios
   */
  private async handleCursorReset(orgId: string, sourceId: string, account: string): Promise<void> {
    // Clear cursor and do full listing
    await this.storeCursor(orgId, sourceId, null);
    await this.handleFullListing(orgId, sourceId, account);
  }

  /**
   * Handles full folder listing (initial sync or cursor reset)
   */
  private async handleFullListing(orgId: string, sourceId: string, account: string): Promise<void> {
    try {
      // Get source metadata to determine if it's a team account
      const sourceQuery = `
        SELECT metadata
        FROM sources 
        WHERE id = $1 AND organization_id = $2
      `;
      
      const sources = await this.postgresService.executeQuery(sourceQuery, [sourceId, orgId]);
      
      if (sources.rows.length === 0) {
        console.warn(`Source not found: ${sourceId} for org ${orgId}`);
        return;
      }
      
      const metadata = sources.rows[0].metadata;
      
      // Initialize Dropbox client with proper headers
      const dropboxOptions: any = {
        accessToken: metadata.dropbox_access_token,
        clientId: process.env.DROPBOX_APP_KEY || '',
        clientSecret: process.env.DROPBOX_APP_SECRET || ''
      };
      
      // Set select user header for team accounts
      if (metadata.dropbox_team_member_id) {
        dropboxOptions.selectUser = metadata.dropbox_team_member_id;
      }
      
      // Set path root for team accounts
      if (metadata.dropbox_is_team_account === 'true') {
        if (metadata.dropbox_root_namespace_id) {
          dropboxOptions.pathRoot = JSON.stringify({ '.tag': 'root', 'root': metadata.dropbox_root_namespace_id });
        }
      } else {
        dropboxOptions.pathRoot = JSON.stringify({ '.tag': 'home' });
      }
      
      const dropboxClient = new Dropbox(dropboxOptions);
      
      let hasMore = true;
      let cursor = '';
      
      while (hasMore) {
        let response;
        
        if (cursor) {
          response = await dropboxClient.filesListFolderContinue({ cursor });
        } else {
          response = await dropboxClient.filesListFolder({
            path: '',
            recursive: true
          });
        }
        
        // Process each entry in the listing
        for (const entry of response.result.entries) {
          await this.processFileEntry(orgId, sourceId, account, entry);
        }
        
        hasMore = response.result.has_more;
        cursor = response.result.cursor;
      }
      
      // Store the final cursor
      await this.storeCursor(orgId, sourceId, cursor);
    } catch (error) {
      console.error(`Error during full listing for source ${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Stores cursor for a source
   */
  private async storeCursor(orgId: string, sourceId: string, cursor: string | null): Promise<void> {
    const query = `
      UPDATE sources 
      SET metadata = metadata || $1::jsonb,
          updated_at = NOW()
      WHERE organization_id = $2 AND id = $3
    `;
    
    const metadata = cursor ? { dropbox_cursor: cursor } : { dropbox_cursor: null };
    
    await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
  }

  /**
   * Stores Dropbox event data for audit trail
   */
  private async storeDropboxEvent(eventData: any): Promise<void> {
    // Implementation to store in dropbox_events table
    const query = `
      INSERT INTO dropbox_events (org_id, source_id, cursor, event_data, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    
    await this.postgresService.executeQuery(query, [
      eventData.org_id,
      eventData.source_id,
      eventData.cursor,
      JSON.stringify(eventData.event_data)
    ]);
  }
}
