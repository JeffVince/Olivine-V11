# Data Ingestion & Normalization Implementation
## Event-Driven File Processing Pipeline

### 1. Storage Provider Integration Architecture

#### 1.1 Dropbox Integration (Fully Implemented)

**Webhook Handler Implementation**
```typescript
import { Request, Response } from 'express';
import crypto from 'crypto';
import { Dropbox } from 'dropbox';

export class DropboxWebhookHandler {
  private dropboxClient: Dropbox;
  private webhookSecret: string;

  constructor(accessToken: string, webhookSecret: string) {
    this.dropboxClient = new Dropbox({ accessToken });
    this.webhookSecret = webhookSecret;
  }

  /**
   * Validates Dropbox webhook signature for security
   */
  private validateSignature(body: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Processes incoming Dropbox webhook notifications
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-dropbox-signature'] as string;
    const body = JSON.stringify(req.body);

    if (!this.validateSignature(body, signature)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const { list_folder } = req.body;
    
    for (const account of list_folder.accounts) {
      await this.processDeltaChanges(account);
    }

    res.status(200).json({ status: 'processed' });
  }

  /**
   * Fetches and processes delta changes using Dropbox cursor API
   */
  private async processDeltaChanges(account: string): Promise<void> {
    try {
      // Get stored cursor for this account
      const cursor = await this.getStoredCursor(account);
      
      let hasMore = true;
      let currentCursor = cursor;

      while (hasMore) {
        const response = await this.dropboxClient.filesListFolderContinue({
          cursor: currentCursor
        });

        // Process each entry in the delta
        for (const entry of response.entries) {
          await this.processFileEntry(account, entry);
        }

        hasMore = response.has_more;
        currentCursor = response.cursor;
      }

      // Store the new cursor
      await this.storeCursor(account, currentCursor);

    } catch (error) {
      if (error.error_summary && error.error_summary.includes('reset')) {
        // Cursor reset - need to do full re-sync
        await this.handleCursorReset(account);
      } else {
        throw error;
      }
    }
  }

  /**
   * Processes individual file/folder entries from Dropbox delta
   */
  private async processFileEntry(account: string, entry: any): Promise<void> {
    const eventData = {
      account,
      entry,
      timestamp: new Date().toISOString()
    };

    // Determine event type based on entry tag
    let eventType: string;
    switch (entry['.tag']) {
      case 'file':
        eventType = entry.id ? 'file_updated' : 'file_created';
        break;
      case 'folder':
        eventType = entry.id ? 'folder_updated' : 'folder_created';
        break;
      case 'deleted':
        eventType = entry.is_dir ? 'folder_deleted' : 'file_deleted';
        break;
      default:
        return; // Skip unknown entry types
    }

    // Store event in staging table
    await this.storeDropboxEvent({
      account,
      eventType,
      resourcePath: entry.path_display || entry.path_lower,
      eventData
    });

    // Trigger async processing
    await this.eventProcessingService.processSyncEvent({
      orgId: await this.getOrgIdForAccount(account),
      sourceId: await this.getSourceIdForAccount(account),
      eventType,
      resourcePath: entry.path_display || entry.path_lower,
      eventData
    });
  }

  /**
   * Handles cursor reset by performing full folder listing
   */
  private async handleCursorReset(account: string): Promise<void> {
    console.log(`Cursor reset for account ${account}, performing full sync`);
    
    // Start fresh listing from root
    const response = await this.dropboxClient.filesListFolder({
      path: '',
      recursive: true,
      include_deleted: false
    });

    // Process all entries
    for (const entry of response.entries) {
      await this.processFileEntry(account, entry);
    }

    // Handle pagination if needed
    let cursor = response.cursor;
    while (response.has_more) {
      const continueResponse = await this.dropboxClient.filesListFolderContinue({
        cursor
      });
      
      for (const entry of continueResponse.entries) {
        await this.processFileEntry(account, entry);
      }
      
      cursor = continueResponse.cursor;
    }

    // Store the new cursor
    await this.storeCursor(account, cursor);
  }

  private async storeDropboxEvent(eventData: any): Promise<void> {
    // Implementation to store in dropbox_events table
    const query = `
      INSERT INTO dropbox_events (org_id, source_id, cursor, event_data, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    
    await this.database.query(query, [
      eventData.orgId,
      eventData.sourceId,
      eventData.cursor,
      JSON.stringify(eventData)
    ]);
  }

  private async getStoredCursor(account: string): Promise<string> {
    // Retrieve cursor from database
    const query = `
      SELECT dropbox_cursor FROM sources 
      WHERE provider_account_id = $1 AND provider = 'dropbox'
    `;
    
    const result = await this.database.query(query, [account]);
    return result.rows[0]?.dropbox_cursor || '';
  }

  private async storeCursor(account: string, cursor: string): Promise<void> {
    // Store cursor in database
    const query = `
      UPDATE sources 
      SET dropbox_cursor = $1, updated_at = NOW()
      WHERE provider_account_id = $2 AND provider = 'dropbox'
    `;
    
    await this.database.query(query, [cursor, account]);
  }
}
```

#### 1.2 Google Drive Integration (Implementation Required)

**Google Drive Push Notification Handler**
```typescript
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export class GoogleDriveIntegration {
  private drive: any;
  private auth: JWT;

  constructor(serviceAccountKey: any) {
    this.auth = new JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ]
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Sets up push notifications for Google Drive changes
   */
  async setupPushNotifications(orgId: string, sourceId: string): Promise<string> {
    const channelId = `gdrive_${sourceId}_${Date.now()}`;
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhooks/gdrive`;

    try {
      const response = await this.drive.changes.watch({
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          payload: true
        }
      });

      // Store channel info for later cleanup
      await this.storeChannelInfo(orgId, sourceId, channelId, response.data);
      
      return channelId;
    } catch (error) {
      console.error('Failed to setup Google Drive push notifications:', error);
      throw error;
    }
  }

  /**
   * Processes Google Drive push notification
   */
  async handlePushNotification(req: Request, res: Response): Promise<void> {
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceState = req.headers['x-goog-resource-state'] as string;
    const pageToken = req.headers['x-goog-page-token'] as string;

    if (resourceState === 'sync') {
      // Initial sync message, acknowledge and return
      res.status(200).send('OK');
      return;
    }

    try {
      // Get source info from channel ID
      const sourceInfo = await this.getSourceFromChannelId(channelId);
      
      if (!sourceInfo) {
        res.status(404).send('Channel not found');
        return;
      }

      // Fetch changes since last page token
      await this.fetchAndProcessChanges(sourceInfo.orgId, sourceInfo.sourceId, pageToken);
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing Google Drive notification:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Fetches and processes changes from Google Drive
   */
  private async fetchAndProcessChanges(orgId: string, sourceId: string, pageToken?: string): Promise<void> {
    try {
      const response = await this.drive.changes.list({
        pageToken: pageToken || await this.getStoredPageToken(sourceId),
        includeRemoved: true,
        spaces: 'drive'
      });

      const changes = response.data.changes || [];

      for (const change of changes) {
        await this.processGDriveChange(orgId, sourceId, change);
      }

      // Store new page token
      if (response.data.nextPageToken) {
        await this.storePageToken(sourceId, response.data.nextPageToken);
      }

    } catch (error) {
      console.error('Error fetching Google Drive changes:', error);
      throw error;
    }
  }

  /**
   * Processes individual Google Drive change
   */
  private async processGDriveChange(orgId: string, sourceId: string, change: any): Promise<void> {
    let eventType: string;
    let resourcePath: string;

    if (change.removed) {
      eventType = change.file?.mimeType === 'application/vnd.google-apps.folder' 
        ? 'folder_deleted' 
        : 'file_deleted';
      resourcePath = change.fileId; // Use fileId for deleted items
    } else {
      const file = change.file;
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        eventType = 'folder_updated';
      } else {
        eventType = 'file_updated';
      }
      resourcePath = await this.getFullPath(file.id);
    }

    // Store event in staging table
    await this.storeGDriveEvent({
      orgId,
      sourceId,
      eventType,
      resourcePath,
      eventData: change
    });

    // Trigger async processing
    await this.eventProcessingService.processSyncEvent({
      orgId,
      sourceId,
      eventType,
      resourcePath,
      eventData: change
    });
  }

  /**
   * Gets full path for a Google Drive file
   */
  private async getFullPath(fileId: string): Promise<string> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'name,parents'
      });

      const file = response.data;
      let path = file.name;

      // Build full path by traversing parents
      if (file.parents && file.parents.length > 0) {
        const parentPath = await this.getFullPath(file.parents[0]);
        path = `${parentPath}/${file.name}`;
      }

      return path;
    } catch (error) {
      console.error('Error getting file path:', error);
      return fileId; // Fallback to file ID
    }
  }

  private async storeGDriveEvent(eventData: any): Promise<void> {
    const query = `
      INSERT INTO gdrive_events (org_id, source_id, page_token, event_data, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    
    await this.database.query(query, [
      eventData.orgId,
      eventData.sourceId,
      eventData.pageToken,
      JSON.stringify(eventData)
    ]);
  }
}
```

#### 1.3 Supabase Storage Integration

**Native Storage Event Handler**
```typescript
export class SupabaseStorageIntegration {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Sets up database triggers for file table changes
   */
  async setupStorageTriggers(): Promise<void> {
    // Create trigger function for file changes
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION notify_file_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO sync_events (org_id, source_id, event_type, resource_type, resource_id, resource_path, event_data)
          VALUES (NEW.org_id, NEW.source_id, 'file_created', 'file', NEW.id, NEW.path, row_to_json(NEW));
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          INSERT INTO sync_events (org_id, source_id, event_type, resource_type, resource_id, resource_path, event_data)
          VALUES (NEW.org_id, NEW.source_id, 'file_updated', 'file', NEW.id, NEW.path, 
                  json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO sync_events (org_id, source_id, event_type, resource_type, resource_id, resource_path, event_data)
          VALUES (OLD.org_id, OLD.source_id, 'file_deleted', 'file', OLD.id, OLD.path, row_to_json(OLD));
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await this.supabase.rpc('exec_sql', { sql: triggerFunction });

    // Create triggers on files table
    const createTriggers = `
      DROP TRIGGER IF EXISTS file_changes_trigger ON files;
      CREATE TRIGGER file_changes_trigger
        AFTER INSERT OR UPDATE OR DELETE ON files
        FOR EACH ROW EXECUTE FUNCTION notify_file_changes();
    `;

    await this.supabase.rpc('exec_sql', { sql: createTriggers });
  }

  /**
   * Subscribes to real-time file changes
   */
  subscribeToFileChanges(orgId: string, callback: (payload: any) => void): RealtimeChannel {
    return this.supabase
      .channel(`files_${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `org_id=eq.${orgId}`
        },
        async (payload) => {
          // Process the change and sync to Neo4j
          await this.processSupabaseFileChange(payload);
          callback(payload);
        }
      )
      .subscribe();
  }

  /**
   * Processes Supabase file changes
   */
  private async processSupabaseFileChange(payload: any): Promise<void> {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    let syncEventType: string;
    let eventData: any;

    switch (eventType) {
      case 'INSERT':
        syncEventType = 'file_created';
        eventData = newRecord;
        break;
      case 'UPDATE':
        syncEventType = 'file_updated';
        eventData = { old: oldRecord, new: newRecord };
        break;
      case 'DELETE':
        syncEventType = 'file_deleted';
        eventData = oldRecord;
        break;
      default:
        return;
    }

    // Trigger sync processing
    await this.eventProcessingService.processSyncEvent({
      orgId: eventData.org_id || oldRecord?.org_id,
      sourceId: eventData.source_id || oldRecord?.source_id,
      eventType: syncEventType,
      resourcePath: eventData.path || oldRecord?.path,
      eventData
    });
  }
}
```

### 2. File Steward Agent Implementation

#### 2.1 Core Processing Engine

**File Steward Agent Architecture**
```typescript
export class FileStewardAgent {
  private neo4jService: Neo4jService;
  private classificationService: ClassificationService;
  private extractionService: ContentExtractionService;
  private eventQueue: Queue;

  constructor(
    neo4jService: Neo4jService,
    classificationService: ClassificationService,
    extractionService: ContentExtractionService,
    eventQueue: Queue
  ) {
    this.neo4jService = neo4jService;
    this.classificationService = classificationService;
    this.extractionService = extractionService;
    this.eventQueue = eventQueue;
  }

  /**
   * Processes sync events and updates the knowledge graph
   */
  async processSyncEvent(eventData: SyncJobData): Promise<void> {
    const { orgId, sourceId, eventType, resourcePath, eventData: rawEventData } = eventData;

    try {
      // Create commit for this operation
      const commitId = await this.createCommit(orgId, {
        message: `File sync: ${eventType} ${resourcePath}`,
        author: 'file-steward-agent',
        authorType: 'agent'
      });

      switch (eventType) {
        case 'file_created':
          await this.handleFileCreated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'file_updated':
          await this.handleFileUpdated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'file_deleted':
          await this.handleFileDeleted(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'folder_created':
          await this.handleFolderCreated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'folder_updated':
          await this.handleFolderUpdated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'folder_deleted':
          await this.handleFolderDeleted(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
      }

      // Mark sync event as processed
      await this.markSyncEventProcessed(eventData);

    } catch (error) {
      console.error('Error processing sync event:', error);
      await this.handleSyncError(eventData, error);
      throw error;
    }
  }

  /**
   * Handles file creation events
   */
  private async handleFileCreated(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    eventData: any, 
    commitId: string
  ): Promise<void> {
    // Extract file metadata from event data
    const fileMetadata = this.extractFileMetadata(eventData);
    
    // Create or update file node in Neo4j
    const fileId = await this.upsertFileNode(orgId, sourceId, resourcePath, fileMetadata, commitId);

    // Create parent folder relationships
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);

    // Queue for classification
    await this.eventQueue.add('classify-file', {
      orgId,
      fileId,
      filePath: resourcePath,
      sourceId,
      commitId
    });

    // Queue for content extraction if applicable
    if (this.shouldExtractContent(fileMetadata.mimeType)) {
      await this.eventQueue.add('extract-content', {
        orgId,
        fileId,
        filePath: resourcePath,
        sourceId,
        commitId
      });
    }
  }

  /**
   * Handles file update events
   */
  private async handleFileUpdated(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    eventData: any, 
    commitId: string
  ): Promise<void> {
    const fileMetadata = this.extractFileMetadata(eventData);
    
    // Get existing file node
    const existingFile = await this.getFileNode(orgId, sourceId, resourcePath);
    
    if (!existingFile) {
      // File doesn't exist in graph, treat as creation
      await this.handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId);
      return;
    }

    // Create version record for the update
    await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);

    // Update file node with new metadata
    await this.updateFileNode(existingFile.id, fileMetadata, commitId);

    // Re-classify if content changed significantly
    if (this.hasSignificantChanges(existingFile.properties, fileMetadata)) {
      await this.eventQueue.add('classify-file', {
        orgId,
        fileId: existingFile.id,
        filePath: resourcePath,
        sourceId,
        commitId
      });
    }
  }

  /**
   * Handles file deletion events
   */
  private async handleFileDeleted(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    eventData: any, 
    commitId: string
  ): Promise<void> {
    const existingFile = await this.getFileNode(orgId, sourceId, resourcePath);
    
    if (!existingFile) {
      console.warn(`File not found for deletion: ${resourcePath}`);
      return;
    }

    // Create version record before deletion
    await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);

    // Soft delete by setting deleted flag and end-dating relationships
    await this.softDeleteFileNode(existingFile.id, commitId);

    // Clean up orphaned folder nodes if needed
    await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId);
  }

  /**
   * Creates or updates file node in Neo4j
   */
  private async upsertFileNode(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    metadata: any, 
    commitId: string
  ): Promise<string> {
    const query = `
      MERGE (f:File {org_id: $orgId, source_id: $sourceId, path: $path})
      ON CREATE SET 
        f.id = randomUUID(),
        f.created_at = datetime(),
        f.db_id = $dbId
      SET 
        f.name = $name,
        f.size = $size,
        f.mime_type = $mimeType,
        f.checksum = $checksum,
        f.updated_at = datetime(),
        f.modified = datetime($modified),
        f.metadata = $metadata
      RETURN f.id as fileId
    `;

    const result = await this.neo4jService.run(query, {
      orgId,
      sourceId,
      path: resourcePath,
      dbId: metadata.dbId,
      name: metadata.name,
      size: metadata.size,
      mimeType: metadata.mimeType,
      checksum: metadata.checksum,
      modified: metadata.modified,
      metadata: JSON.stringify(metadata.extra || {})
    });

    const fileId = result.records[0].get('fileId');

    // Create action record
    await this.createAction(commitId, {
      actionType: 'upsert_file',
      tool: 'file-steward-agent',
      entityType: 'File',
      entityId: fileId,
      inputs: { orgId, sourceId, resourcePath, metadata },
      outputs: { fileId },
      status: 'success'
    });

    return fileId;
  }

  /**
   * Ensures folder hierarchy exists in the graph
   */
  private async ensureFolderHierarchy(
    orgId: string, 
    sourceId: string, 
    filePath: string, 
    commitId: string
  ): Promise<void> {
    const pathParts = filePath.split('/').filter(part => part.length > 0);
    pathParts.pop(); // Remove filename

    let currentPath = '';
    let parentId: string | null = null;

    for (const folderName of pathParts) {
      currentPath += `/${folderName}`;
      
      const folderId = await this.upsertFolderNode(
        orgId, 
        sourceId, 
        currentPath, 
        folderName, 
        parentId, 
        commitId
      );

      // Create parent-child relationship
      if (parentId) {
        await this.createFolderRelationship(parentId, folderId, 'CONTAINS', commitId);
      }

      parentId = folderId;
    }

    // Create file-to-folder relationship
    if (parentId) {
      const fileId = await this.getFileIdByPath(orgId, sourceId, filePath);
      if (fileId) {
        await this.createFolderRelationship(parentId, fileId, 'CONTAINS', commitId);
      }
    }
  }

  /**
   * Extracts standardized metadata from provider-specific event data
   */
  private extractFileMetadata(eventData: any): any {
    // Handle different provider formats
    if (eventData.entry) {
      // Dropbox format
      return {
        name: eventData.entry.name,
        size: eventData.entry.size,
        mimeType: this.inferMimeType(eventData.entry.name),
        checksum: eventData.entry.content_hash,
        modified: eventData.entry.server_modified,
        dbId: eventData.entry.id,
        extra: {
          provider: 'dropbox',
          rev: eventData.entry.rev,
          pathDisplay: eventData.entry.path_display
        }
      };
    } else if (eventData.file) {
      // Google Drive format
      return {
        name: eventData.file.name,
        size: parseInt(eventData.file.size) || 0,
        mimeType: eventData.file.mimeType,
        checksum: eventData.file.md5Checksum,
        modified: eventData.file.modifiedTime,
        dbId: eventData.file.id,
        extra: {
          provider: 'gdrive',
          version: eventData.file.version,
          webViewLink: eventData.file.webViewLink
        }
      };
    } else {
      // Supabase format
      return {
        name: eventData.name,
        size: eventData.size,
        mimeType: eventData.mime_type,
        checksum: eventData.checksum,
        modified: eventData.modified,
        dbId: eventData.id,
        extra: {
          provider: 'supabase',
          bucket: eventData.bucket_id
        }
      };
    }
  }

  /**
   * Determines if content extraction should be performed
   */
  private shouldExtractContent(mimeType: string): boolean {
    const extractableMimeTypes = [
      'application/pdf',
      'text/plain',
      'text/html',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    return extractableMimeTypes.includes(mimeType);
  }

  /**
   * Determines if file changes are significant enough to trigger re-classification
   */
  private hasSignificantChanges(oldMetadata: any, newMetadata: any): boolean {
    // Check if name changed (might affect classification)
    if (oldMetadata.name !== newMetadata.name) {
      return true;
    }

    // Check if size changed significantly (>10% change)
    const sizeChange = Math.abs(oldMetadata.size - newMetadata.size) / oldMetadata.size;
    if (sizeChange > 0.1) {
      return true;
    }

    // Check if modification time is recent (within last hour)
    const modifiedTime = new Date(newMetadata.modified);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (modifiedTime > oneHourAgo) {
      return true;
    }

    return false;
  }

  private async createCommit(orgId: string, commitData: any): Promise<string> {
    // Implementation for creating commit records
    // This will be detailed in the versioning section
    return 'commit-id-placeholder';
  }

  private async createAction(commitId: string, actionData: any): Promise<void> {
    // Implementation for creating action records
    // This will be detailed in the provenance section
  }
}
```

### 3. Classification Engine Implementation

#### 3.1 Taxonomy-Based Classification

**Rule-Based Classification System**
```typescript
export interface TaxonomyRule {
  id: string;
  orgId: string;
  slotKey: string;
  matchPattern: string;
  fileType?: string;
  priority: number;
  enabled: boolean;
  conditions: ClassificationCondition[];
}

export interface ClassificationCondition {
  type: 'filename' | 'path' | 'size' | 'mime_type' | 'content';
  operator: 'matches' | 'contains' | 'equals' | 'greater_than' | 'less_than';
  value: string | number;
  caseSensitive?: boolean;
}

export class TaxonomyClassificationEngine {
  private rules: Map<string, TaxonomyRule[]> = new Map();

  /**
   * Loads taxonomy rules for an organization
   */
  async loadTaxonomyRules(orgId: string): Promise<void> {
    const query = `
      SELECT tr.*, tp.name as profile_name
      FROM taxonomy_rules tr
      JOIN taxonomy_profiles tp ON tr.profile_id = tp.id
      WHERE tr.org_id = $1 AND tr.enabled = true AND tp.active = true
      ORDER BY tr.priority ASC
    `;
    
    const result = await this.database.query(query, [orgId]);
    this.rules.set(orgId, result.rows);
  }

  /**
   * Classifies a file based on taxonomy rules
   */
  async classifyFile(orgId: string, fileData: any): Promise<ClassificationResult> {
    const rules = this.rules.get(orgId) || [];
    
    for (const rule of rules) {
      if (await this.evaluateRule(rule, fileData)) {
        return {
          slotKey: rule.slotKey,
          confidence: this.calculateConfidence(rule, fileData),
          ruleId: rule.id,
          method: 'taxonomy'
        };
      }
    }

    return {
      slotKey: 'UNCLASSIFIED',
      confidence: 0,
      ruleId: null,
      method: 'default'
    };
  }

  /**
   * Evaluates if a rule matches the file data
   */
  private async evaluateRule(rule: TaxonomyRule, fileData: any): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, fileData)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluates individual classification conditions
   */
  private async evaluateCondition(condition: ClassificationCondition, fileData: any): Promise<boolean> {
    let fieldValue: any;

    switch (condition.type) {
      case 'filename':
        fieldValue = fileData.name;
        break;
      case 'path':
        fieldValue = fileData.path;
        break;
      case 'size':
        fieldValue = fileData.size;
        break;
      case 'mime_type':
        fieldValue = fileData.mimeType;
        break;
      case 'content':
        fieldValue = fileData.extractedText || '';
        break;
      default:
        return false;
    }

    return this.applyOperator(condition.operator, fieldValue, condition.value, condition.caseSensitive);
  }

  /**
   * Applies comparison operators for condition evaluation
   */
  private applyOperator(
    operator: string, 
    fieldValue: any, 
    conditionValue: any, 
    caseSensitive: boolean = true
  ): boolean {
    switch (operator) {
      case 'matches':
        const regex = new RegExp(conditionValue, caseSensitive ? 'g' : 'gi');
        return regex.test(fieldValue);
      case 'contains':
        const searchValue = caseSensitive ? conditionValue : conditionValue.toLowerCase();
        const searchField = caseSensitive ? fieldValue : fieldValue.toLowerCase();
        return searchField.includes(searchValue);
      case 'equals':
        return fieldValue === conditionValue;
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      default:
        return false;
    }
  }

  /**
   * Calculates confidence score for classification
   */
  private calculateConfidence(rule: TaxonomyRule, fileData: any): number {
    // Simple confidence calculation based on number of matching conditions
    const totalConditions = rule.conditions.length;
    let matchingConditions = 0;

    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, fileData)) {
        matchingConditions++;
      }
    }

    return matchingConditions / totalConditions;
  }
}
```

### 4. Content Extraction Pipeline

#### 4.1 Multi-Format Content Extraction

**Content Extraction Service**
```typescript
export class ContentExtractionService {
  private ocrService: OCRService;
  private pdfParser: PDFParser;
  private docParser: DocumentParser;

  /**
   * Extracts content from files based on MIME type
   */
  async extractContent(orgId: string, fileData: any): Promise<ExtractionResult> {
    const { mimeType, path, size } = fileData;
    const startTime = Date.now();

    try {
      let extractedContent: string = '';
      let metadata: any = {};

      switch (mimeType) {
        case 'application/pdf':
          const pdfResult = await this.extractFromPDF(path);
          extractedContent = pdfResult.text;
          metadata = pdfResult.metadata;
          break;

        case 'text/plain':
          extractedContent = await this.extractFromText(path);
          break;

        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const docResult = await this.extractFromDocument(path);
          extractedContent = docResult.text;
          metadata = docResult.metadata;
          break;

        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
          extractedContent = await this.extractFromImage(path);
          break;

        default:
          return {
            success: false,
            error: `Unsupported MIME type: ${mimeType}`,
            extractedText: '',
            metadata: {}
          };
      }

      return {
        success: true,
        extractedText: extractedContent,
        metadata,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        extractedText: '',
        metadata: {}
      };
    }
  }

  /**
   * Extracts text from PDF files
   */
  private async extractFromPDF(filePath: string): Promise<{ text: string; metadata: any }> {
    const pdfData = await this.pdfParser.parse(filePath);
    
    return {
      text: pdfData.text,
      metadata: {
        pageCount: pdfData.pageCount,
        title: pdfData.title,
        author: pdfData.author,
        creationDate: pdfData.creationDate,
        modificationDate: pdfData.modificationDate
      }
    };
  }

  /**
   * Extracts text from plain text files
   */
  private async extractFromText(filePath: string): Promise<string> {
    return await fs.promises.readFile(filePath, 'utf8');
  }

  /**
   * Extracts text from images using OCR
   */
  private async extractFromImage(filePath: string): Promise<string> {
    return await this.ocrService.extractText(filePath);
  }

  /**
   * Extracts text from document files
   */
  private async extractFromDocument(filePath: string): Promise<{ text: string; metadata: any }> {
    return await this.docParser.parse(filePath);
  }
}
```

This implementation provides a comprehensive data ingestion pipeline that handles multiple storage providers, processes files through the File Steward Agent, classifies content using taxonomy rules, and extracts text content for further analysis. The system is designed to be event-driven, scalable, and maintainable with full audit trails and error handling.
