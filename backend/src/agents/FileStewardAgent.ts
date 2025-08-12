import { BaseAgent, AgentContext, AgentConfig } from './BaseAgent'
import { QueueService } from '../services/queues/QueueService'
import { Neo4jService } from '../services/Neo4jService';
import { PostgresService } from '../services/PostgresService';
import { DropboxService } from '../services/DropboxService';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { FileProcessingService } from '../services/FileProcessingService';
import { EventProcessingService } from '../services/EventProcessingService';
import { ClassificationService } from '../services/classification/ClassificationService';
import { TaxonomyService } from '../services/TaxonomyService';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface SyncJobData {
  orgId: string;
  sourceId: string;
  eventType: 'file_created' | 'file_updated' | 'file_deleted' | 'folder_created' | 'folder_updated' | 'folder_deleted';
  resourcePath: string;
  eventData: any;
}

export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  checksum?: string;
  modified: string;
  dbId: string;
  provider: 'dropbox' | 'gdrive' | 'supabase';
  extra: any;
}

export class FileStewardAgent extends BaseAgent {
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private dropboxService: DropboxService;
  private gdriveService: GoogleDriveService;
  private fileProcessingService: FileProcessingService;
  private classificationService: ClassificationService;
  private taxonomyService: TaxonomyService;

  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('file-steward-agent', queueService, {
      maxRetries: 3,
      retryDelay: 2000,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    });
    
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.dropboxService = new DropboxService();
    this.gdriveService = new GoogleDriveService();
    // Create services with proper dependencies to break circular dependency
    const eventProcessingService = new EventProcessingService(null as any, queueService);
    this.fileProcessingService = new FileProcessingService(eventProcessingService);
    // Set the fileProcessingService dependency in eventProcessingService
    (eventProcessingService as any).fileProcessingService = this.fileProcessingService;
    this.classificationService = new ClassificationService(this.postgresService);
    this.taxonomyService = new TaxonomyService();
  }

  /**
   * Initializes the File Steward Agent and registers queue workers
   */
  protected async onStart(): Promise<void> {
    this.logger.info('Starting FileStewardAgent queue workers...');

    // Register primary file sync worker
    this.queueService.registerWorker('file-sync', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'processSyncEvent',
        job.data,
        context,
        () => this.processSyncEvent(job.data as SyncJobData)
      );
    });

    // Register file classification worker
    this.queueService.registerWorker('file-classification', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'classifyFile',
        job.data,
        context,
        () => this.classifyFile(job.data)
      );
    });
    
    // Register content extraction worker
    this.queueService.registerWorker('content-extraction', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'extractContent',
        job.data,
        context,
        () => this.extractContent(job.data)
      );
    });

    this.logger.info('FileStewardAgent workers registered successfully');
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping FileStewardAgent...');
    // Clean up any resources if needed
  }

  protected async onPause(): Promise<void> {
    this.logger.info('Pausing FileStewardAgent...');
  }

  protected async onResume(): Promise<void> {
    this.logger.info('Resuming FileStewardAgent...');
  }

  /**
   * Main entry point for processing sync events from storage providers
   */
  async processSyncEvent(eventData: SyncJobData): Promise<void> {
    const { orgId, sourceId, eventType, resourcePath, eventData: rawEventData } = eventData;
    
    this.validateContext({ orgId });
    this.logger.info(`Processing sync event: ${eventType} for ${resourcePath}`, { orgId, sourceId });

    // Create commit for this operation
    const commitId = await this.createCommit(
      orgId, 
      `File sync: ${eventType} ${resourcePath}`
    );

    try {
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

      this.logger.info(`Successfully processed sync event: ${eventType} for ${resourcePath}`);
    } catch (error) {
      this.logger.error(`Failed to process sync event: ${eventType} for ${resourcePath}`, error);
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

    // Create parent folder hierarchy
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);

    // Queue for classification if file type supports it
    if (this.shouldClassifyFile(fileMetadata.mimeType)) {
      await this.queueService.addJob('file-classification', 'classify-file', {
        orgId,
        fileId,
        filePath: resourcePath,
        sourceId,
        commitId,
        metadata: fileMetadata
      });
    }

    // Queue for content extraction if applicable
    if (this.shouldExtractContent(fileMetadata.mimeType)) {
      await this.queueService.addJob('content-extraction', 'extract-content', {
        orgId,
        fileId,
        filePath: resourcePath,
        sourceId,
        commitId,
        metadata: fileMetadata
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
      await this.queueService.addJob('file-classification', 'classify-file', {
        orgId,
        fileId: existingFile.id,
        filePath: resourcePath,
        sourceId,
        commitId,
        metadata: fileMetadata
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
      this.logger.warn(`File not found for deletion: ${resourcePath}`);
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
   * Handles folder creation events
   */
  private async handleFolderCreated(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    eventData: any,
    commitId: string
  ): Promise<void> {
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);
  }

  /**
   * Handles folder update events
   */
  private async handleFolderUpdated(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    eventData: any,
    commitId: string
  ): Promise<void> {
    // For now, folder updates don't require special handling beyond hierarchy
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);
  }

  /**
   * Handles folder deletion events
   */
  private async handleFolderDeleted(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    eventData: any,
    commitId: string
  ): Promise<void> {
    await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId);
  }

  /**
   * Extracts standardized metadata from provider-specific event data
   */
  private extractFileMetadata(eventData: any): FileMetadata {
    if (eventData.entry) {
      // Dropbox format
      return {
        name: eventData.entry.name,
        size: eventData.entry.size || 0,
        mimeType: this.inferMimeType(eventData.entry.name),
        checksum: eventData.entry.content_hash,
        modified: eventData.entry.server_modified,
        dbId: eventData.entry.id,
        provider: 'dropbox',
        extra: {
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
        provider: 'gdrive',
        extra: {
          version: eventData.file.version,
          webViewLink: eventData.file.webViewLink
        }
      };
    } else {
      // Supabase format
      return {
        name: eventData.name,
        size: eventData.size || 0,
        mimeType: eventData.mime_type || this.inferMimeType(eventData.name),
        checksum: eventData.checksum,
        modified: eventData.modified,
        dbId: eventData.id,
        provider: 'supabase',
        extra: {
          bucket: eventData.bucket_id
        }
      };
    }
  }

  /**
   * Creates or updates file node in Neo4j
   */
  private async upsertFileNode(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    metadata: FileMetadata,
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
        f.metadata = $metadataJson,
        f.current = true,
        f.deleted = false
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
      checksum: metadata.checksum || null,
      modified: metadata.modified,
      metadataJson: JSON.stringify(metadata.extra || {})
    });

    return result.records[0].get('fileId');
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

      parentId = folderId;
    }
  }

  /**
   * Creates or updates folder node in Neo4j
   */
  private async upsertFolderNode(
    orgId: string,
    sourceId: string,
    path: string,
    name: string,
    parentId: string | null,
    commitId: string
  ): Promise<string> {
    const query = `
      MERGE (f:Folder {org_id: $orgId, source_id: $sourceId, path: $path})
      ON CREATE SET 
        f.id = randomUUID(),
        f.created_at = datetime()
      SET 
        f.name = $name,
        f.updated_at = datetime(),
        f.current = true,
        f.deleted = false
      RETURN f.id as folderId
    `;

    const result = await this.neo4jService.run(query, {
      orgId,
      sourceId,
      path,
      name
    });

    return result.records[0].get('folderId');
  }

  /**
   * Gets existing file node from Neo4j
   */
  private async getFileNode(orgId: string, sourceId: string, path: string): Promise<any> {
    const query = `
      MATCH (f:File {org_id: $orgId, source_id: $sourceId, path: $path, current: true, deleted: false})
      RETURN f
    `;

    const result = await this.neo4jService.run(query, { orgId, sourceId, path });
    
    if (result.records.length === 0) {
      return null;
    }

    const fileNode = result.records[0].get('f');
    return {
      id: fileNode.properties.id,
      properties: fileNode.properties
    };
  }

  /**
   * Creates entity version record for change tracking
   */
  private async createEntityVersion(
    entityId: string,
    entityType: string,
    properties: any,
    commitId: string
  ): Promise<void> {
    // This would integrate with the versioning service
    // For now, log the version creation
    this.logger.debug(`Creating version for ${entityType} ${entityId}`, { commitId });
  }

  /**
   * Updates file node with new metadata
   */
  private async updateFileNode(
    fileId: string,
    metadata: FileMetadata,
    commitId: string
  ): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.name = $name,
        f.size = $size,
        f.mime_type = $mimeType,
        f.checksum = $checksum,
        f.updated_at = datetime(),
        f.modified = datetime($modified),
        f.metadata = $metadataJson
      RETURN f
    `;

    await this.neo4jService.run(query, {
      fileId,
      name: metadata.name,
      size: metadata.size,
      mimeType: metadata.mimeType,
      checksum: metadata.checksum || null,
      modified: metadata.modified,
      metadataJson: JSON.stringify(metadata.extra || {})
    });
  }

  /**
   * Soft deletes file node by setting flags
   */
  private async softDeleteFileNode(fileId: string, commitId: string): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET f.deleted = true, f.current = false, f.end_date = datetime()
      RETURN f
    `;

    await this.neo4jService.run(query, { fileId });
  }

  /**
   * Cleans up orphaned folder nodes
   */
  private async cleanupOrphanedFolders(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    commitId: string
  ): Promise<void> {
    // Implementation for cleaning up empty folder hierarchies
    this.logger.debug(`Cleaning up orphaned folders for path: ${resourcePath}`);
  }

  /**
   * Determines if file should be classified
   */
  private shouldClassifyFile(mimeType: string): boolean {
    const classifiableMimeTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'video/mp4',
      'audio/mpeg'
    ];

    return classifiableMimeTypes.includes(mimeType);
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
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    return extractableMimeTypes.includes(mimeType);
  }

  /**
   * Determines if file changes are significant enough to trigger re-classification
   */
  private hasSignificantChanges(oldMetadata: any, newMetadata: FileMetadata): boolean {
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

  /**
   * Infers MIME type from filename extension
   */
  private inferMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'html': 'text/html',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
      'json': 'application/json'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * File classification processing
   */
  private async classifyFile(jobData: any): Promise<void> {
    const { orgId, fileId, filePath, metadata, fileContent } = jobData;
    
    this.logger.info(`Classifying file: ${filePath}`, { orgId, fileId });

    try {
      // Use classification service to determine file category
      const classification = await this.classificationService.classify(orgId, {
        name: path.basename(filePath),
        path: filePath,
        mimeType: metadata?.mimeType,
        size: metadata?.size,
        extractedText: fileContent
      });
      
      // Persist classification as temporal EdgeFact with provenance
      const taxonomyClassification = {
        slot: classification.slotKey,
        confidence: classification.confidence,
        method: classification.method === 'taxonomy' ? 'rule_based' as const : 'ml_based' as const,
        rule_id: classification.ruleId || undefined,
        metadata: {}
      };
      await this.taxonomyService.applyClassification(fileId, taxonomyClassification, orgId, 'system');

      // Optionally reflect status/metadata on File node without convenience edges
      await this.updateFileClassification(fileId, {
        status: 'classified',
        confidence: classification.confidence,
        metadata: { method: classification.method, ruleId: classification.ruleId, slotKey: classification.slotKey }
      });
      
      this.logger.info(`File classified successfully: ${filePath}`, { classification });
    } catch (error) {
      this.logger.error(`Failed to classify file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Updates file classification in Neo4j
   */
  private async updateFileClassification(
    fileId: string,
    classification: { status: string; confidence: number; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.classification_status = $status,
        f.classification_confidence = $confidence,
        f.classification_metadata = $metadata
      RETURN f
    `;

    await this.neo4jService.run(query, {
      fileId,
      status: classification.status || 'classified',
      confidence: classification.confidence || 0,
      metadata: JSON.stringify(classification.metadata || {})
    });
  }

  /**
   * Content extraction processing
   */
  private async extractContent(jobData: any): Promise<void> {
    const { orgId, fileId, filePath, metadata } = jobData;
    
    this.logger.info(`Extracting content from file: ${filePath}`, { orgId, fileId });

    try {
      // Use file processing service to extract content
      const extractedContent = await this.fileProcessingService.extractContent({
        sourceId: metadata.sourceId,
        path: filePath,
        mimeType: metadata.mimeType
      });

      // Update file node with extracted content
      await this.updateFileContent(fileId, extractedContent);
      
      this.logger.info(`Content extracted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to extract content from file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Updates file with extracted content
   */
  private async updateFileContent(fileId: string, extractedContent: any): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.extracted_text = $text,
        f.content_metadata = $metadata,
        f.extraction_status = 'completed'
      RETURN f
    `;

    await this.neo4jService.run(query, {
      fileId,
      text: extractedContent.text || '',
      metadata: JSON.stringify(extractedContent.metadata || {})
    });
  }
}
