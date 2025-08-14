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

export interface ClusterProcessingResult {
  fileId: string;
  clusterId: string;
  slots: string[];
  extractionTriggered: boolean;
  crossLayerLinksCreated: number;
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
  private clusterMode = false;
  private eventBus: any; // EventEmitter for cluster events

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
    this.eventBus = new (require('events').EventEmitter)();
    
    // Enable cluster mode if environment variable is set
    this.clusterMode = process.env.CLUSTER_MODE === 'true';
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

    // If cluster mode is enabled, process with cluster-centric approach
    if (this.clusterMode) {
      const clusterResult = await this.processFileWithCluster(orgId, sourceId, fileId, resourcePath, fileMetadata, commitId);
      
      // Emit cluster processing event for orchestration
      this.eventBus.emit('file.processed', {
        type: 'file.processed',
        orgId,
        fileId,
        clusterId: clusterResult.clusterId,
        slots: clusterResult.slots,
        extractionTriggered: clusterResult.extractionTriggered,
        eventType: 'created',
        timestamp: new Date().toISOString(),
        agent: 'file-steward-agent'
      });
    } else {
      // Legacy processing approach
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
        orgId,
        sourceId: metadata.sourceId,
        path: filePath,
        mimeType: metadata.mimeType
      });

      // Normalize extracted content to expected shape
      const normalizedExtracted = typeof extractedContent === 'string'
        ? { text: extractedContent, metadata: {} }
        : extractedContent;

      // Update file node with extracted content
      await this.updateFileContent(fileId, normalizedExtracted);
      
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

  // ========================================
  // CLUSTER-CENTRIC PROCESSING METHODS
  // ========================================

  /**
   * Process file with cluster-centric approach
   */
  private async processFileWithCluster(
    orgId: string,
    sourceId: string,
    fileId: string,
    resourcePath: string,
    fileMetadata: FileMetadata,
    commitId: string
  ): Promise<ClusterProcessingResult> {
    this.logger.info(`Processing file with cluster-centric approach: ${resourcePath}`, { orgId, fileId });

    // Step 1: Create content cluster for this file
    const clusterId = await this.createContentCluster(orgId, fileId, commitId);

    // Step 2: Perform multi-slot classification
    const slots = await this.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata);

    // Step 3: Queue extraction jobs based on classification
    const extractionTriggered = await this.queueExtractionJobs(orgId, fileId, slots, fileMetadata);

    // Step 4: Create initial cross-layer links if applicable
    const crossLayerLinksCreated = await this.createInitialCrossLayerLinks(orgId, fileId, slots);

    return {
      fileId,
      clusterId,
      slots,
      extractionTriggered,
      crossLayerLinksCreated
    };
  }

  /**
   * Create content cluster for file
   */
  private async createContentCluster(orgId: string, fileId: string, commitId: string): Promise<string> {
    const clusterId = uuidv4();
    
    const query = `
      MATCH (f:File {id: $fileId})
      CREATE (cc:ContentCluster {
        id: $clusterId,
        orgId: $orgId,
        fileId: $fileId,
        projectId: f.project_id,
        status: 'empty',
        entitiesCount: 0,
        linksCount: 0,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      CREATE (f)-[:HAS_CLUSTER]->(cc)
      RETURN cc.id as clusterId
    `;

    await this.neo4jService.run(query, { clusterId, orgId, fileId });
    
    // Also create staging record in PostgreSQL
    await this.postgresService.query(`
      INSERT INTO content_cluster (id, org_id, file_id, status, entities_count, links_count, created_at, updated_at)
      VALUES ($1, $2, $3, 'empty', 0, 0, NOW(), NOW())
    `, [clusterId, orgId, fileId]);

    this.logger.debug(`Created content cluster: ${clusterId}`, { fileId, orgId });
    return clusterId;
  }

  /**
   * Perform multi-slot classification using taxonomy rules
   */
  private async performMultiSlotClassification(
    orgId: string,
    fileId: string,
    resourcePath: string,
    fileMetadata: FileMetadata
  ): Promise<string[]> {
    const slots: string[] = [];

    try {
      // Get applicable taxonomy rules for this file
      const rules = await this.getApplicableTaxonomyRules(orgId, fileMetadata);

      for (const rule of rules) {
        const confidence = this.calculateRuleConfidence(rule, fileMetadata, resourcePath);
        
        if (confidence >= (rule.min_confidence ?? (rule.minConfidence ?? 0))) {
          slots.push(rule.slot);
          
          // Create EdgeFact for this classification
          await this.createSlotEdgeFact(fileId, rule.slot, confidence, rule.id, orgId);
        }
      }

      // Always include SCRIPT_PRIMARY for .fdx or filenames containing 'script'
      const fileName = path.basename(resourcePath).toLowerCase();
      if ((fileName.endsWith('.fdx') || fileName.includes('script')) && !slots.includes('SCRIPT_PRIMARY')) {
        slots.push('SCRIPT_PRIMARY');
        await this.createSlotEdgeFact(fileId, 'SCRIPT_PRIMARY', 0.9, 'filename_heuristic', orgId);
      }

      // Fallback classification if still empty
      if (slots.length === 0) {
        const fallbackSlot = this.getFallbackSlot(fileMetadata.mimeType);
        if (fallbackSlot) {
          slots.push(fallbackSlot);
          await this.createSlotEdgeFact(fileId, fallbackSlot, 0.5, 'fallback', orgId);
        }
      }

      this.logger.debug(`Multi-slot classification completed`, { fileId, slots });
      return slots;
    } catch (error) {
      this.logger.error(`Multi-slot classification failed`, { fileId, error });
      return [];
    }
  }

  /**
   * Get applicable taxonomy rules for file
   */
  private async getApplicableTaxonomyRules(orgId: string, fileMetadata: FileMetadata): Promise<any[]> {
    const result = await this.postgresService.query(`
      SELECT * FROM parser_registry 
      WHERE org_id = $1 
      AND (mime_type = $2 OR mime_type = '*/*')
      AND enabled = true
      ORDER BY min_confidence DESC
    `, [orgId, fileMetadata.mimeType]);

    return result.rows;
  }

  /**
   * Calculate confidence score for taxonomy rule
   */
  private calculateRuleConfidence(rule: any, fileMetadata: FileMetadata, resourcePath: string): number {
    let confidence = 0.7; // Base confidence

    // Boost confidence for exact MIME type match
    if (rule.mime_type === fileMetadata.mimeType) {
      confidence += 0.2;
    }

    // Boost confidence for file name patterns
    const fileName = path.basename(resourcePath).toLowerCase();
    if (rule.slot === 'SCRIPT_PRIMARY' && (fileName.includes('script') || fileName.endsWith('.fdx'))) {
      confidence += 0.1;
    }

    // Boost confidence for file size patterns
    if (rule.slot === 'BUDGET_MASTER' && fileMetadata.size > 100000) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Create EdgeFact for slot classification
   */
  private async createSlotEdgeFact(
    fileId: string,
    slot: string,
    confidence: number,
    ruleId: string,
    orgId: string
  ): Promise<void> {
    const edgeFactId = uuidv4();
    
    const query = `
      MATCH (f:File {id: $fileId})
      CREATE (ef:EdgeFact {
        id: $edgeFactId,
        type: 'FILLS_SLOT',
        props: {
          slot: $slot,
          confidence: $confidence,
          ruleId: $ruleId,
          method: 'taxonomy_rule'
        },
        orgId: $orgId,
        createdAt: datetime(),
        validFrom: datetime(),
        validTo: null
      })
      CREATE (f)<-[:FILLS_SLOT]-(ef)
      RETURN ef.id as edgeFactId
    `;

    await this.neo4jService.run(query, {
      fileId,
      edgeFactId,
      slot,
      confidence,
      ruleId,
      orgId
    });
  }

  /**
   * Get fallback slot for unclassified files
   */
  private getFallbackSlot(mimeType: string): string | null {
    const fallbackMap: Record<string, string> = {
      'application/pdf': 'DOCUMENT_GENERAL',
      'image/jpeg': 'MEDIA_IMAGE',
      'image/png': 'MEDIA_IMAGE',
      'video/mp4': 'MEDIA_VIDEO',
      'audio/mpeg': 'MEDIA_AUDIO',
      'text/plain': 'DOCUMENT_TEXT'
    };

    return fallbackMap[mimeType] || 'FILE_UNCLASSIFIED';
  }

  /**
   * Queue extraction jobs based on classification slots
   */
  private async queueExtractionJobs(
    orgId: string,
    fileId: string,
    slots: string[],
    fileMetadata: FileMetadata
  ): Promise<boolean> {
    let jobsQueued = false;

    for (const slot of slots) {
      const parsers = await this.getApplicableParsers(orgId, slot, fileMetadata.mimeType);
      
      for (const parser of parsers) {
        const jobId = uuidv4();
        
        // Create extraction job record
        await this.postgresService.query(`
          INSERT INTO extraction_job (id, org_id, file_id, parser_name, parser_version, status, created_at)
          VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
        `, [jobId, orgId, fileId, parser.parser_name, parser.parser_version]);

        // Queue the actual extraction job
        await this.queueService.addJob('content-extraction', 'extract-content', {
          jobId,
          orgId,
          fileId,
          slot,
          parser: parser.parser_name,
          parserVersion: parser.parser_version,
          metadata: fileMetadata
        });

        jobsQueued = true;
      }
    }

    return jobsQueued;
  }

  /**
   * Get applicable parsers for slot and MIME type
   */
  private async getApplicableParsers(orgId: string, slot: string, mimeType: string): Promise<any[]> {
    const result = await this.postgresService.query(`
      SELECT * FROM parser_registry 
      WHERE org_id = $1 
      AND slot = $2 
      AND (mime_type = $3 OR mime_type = '*/*')
      AND enabled = true
      ORDER BY parser_version DESC
    `, [orgId, slot, mimeType]);

    return result.rows;
  }

  /**
   * Create initial cross-layer links based on classification
   */
  private async createInitialCrossLayerLinks(
    orgId: string,
    fileId: string,
    slots: string[]
  ): Promise<number> {
    let linksCreated = 0;

    // Example: Link script files to project scenes
    if (slots.includes('SCRIPT_PRIMARY')) {
      const projectScenes = await this.getProjectScenes(orgId, fileId);
      
      for (const scene of projectScenes) {
        await this.createCrossLayerLink(fileId, scene.id, 'SCRIPT_FOR', orgId);
        linksCreated++;
      }
    }

    // Example: Link budget files to purchase orders
    if (slots.includes('BUDGET_MASTER')) {
      const projectPOs = await this.getProjectPurchaseOrders(orgId, fileId);
      
      for (const po of projectPOs) {
        await this.createCrossLayerLink(fileId, po.id, 'BUDGET_FOR', orgId);
        linksCreated++;
      }
    }

    return linksCreated;
  }

  /**
   * Get project scenes for cross-layer linking
   */
  private async getProjectScenes(orgId: string, fileId: string): Promise<any[]> {
    const query = `
      MATCH (f:File {id: $fileId})-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(s:Scene)
      WHERE s.org_id = $orgId
      RETURN s.id as id, s.number as number, s.title as title
      LIMIT 10
    `;

    const result = await this.neo4jService.run(query, { fileId, orgId });
    return result.records.map(record => ({
      id: record.get('id'),
      number: record.get('number'),
      title: record.get('title')
    }));
  }

  /**
   * Get project purchase orders for cross-layer linking
   */
  private async getProjectPurchaseOrders(orgId: string, fileId: string): Promise<any[]> {
    const query = `
      MATCH (f:File {id: $fileId})-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(po:PurchaseOrder)
      WHERE po.org_id = $orgId
      RETURN po.id as id, po.number as number, po.vendor as vendor
      LIMIT 5
    `;

    const result = await this.neo4jService.run(query, { fileId, orgId });
    return result.records.map(record => ({
      id: record.get('id'),
      number: record.get('number'),
      vendor: record.get('vendor')
    }));
  }

  /**
   * Create cross-layer relationship link
   */
  private async createCrossLayerLink(
    fromEntityId: string,
    toEntityId: string,
    relationshipType: string,
    orgId: string
  ): Promise<void> {
    const query = `
      MATCH (from {id: $fromEntityId}), (to {id: $toEntityId})
      CREATE (from)-[r:${relationshipType} {
        orgId: $orgId,
        createdAt: datetime(),
        method: 'automatic',
        createdBy: 'file-steward-agent'
      }]->(to)
      RETURN r
    `;

    await this.neo4jService.run(query, { fromEntityId, toEntityId, orgId });
  }

  /**
   * Enable cluster mode for this agent
   */
  public enableClusterMode(): void {
    this.clusterMode = true;
    this.logger.info('Cluster mode enabled for FileStewardAgent');
  }

  /**
   * Disable cluster mode for this agent
   */
  public disableClusterMode(): void {
    this.clusterMode = false;
    this.logger.info('Cluster mode disabled for FileStewardAgent');
  }

  /**
   * Get cluster processing event bus for external orchestration
   */
  /**
   * Process sync event with cluster-centric approach
   */
  public async processSyncEventWithCluster(eventData: any): Promise<ClusterProcessingResult> {
    const { orgId, sourceId, resourcePath, eventData: fileEventData } = eventData;
    
    // Generate commit ID for provenance
    const commitId = uuidv4();
    
    // Create file metadata from event data
    const fileMetadata: FileMetadata = {
      name: fileEventData.name,
      size: fileEventData.size,
      mimeType: fileEventData.mimeType || this.inferMimeType(fileEventData.name),
      checksum: fileEventData.checksum,
      modified: fileEventData.modified,
      dbId: fileEventData.id,
      provider: fileEventData.provider,
      extra: fileEventData.extra || {}
    };
    
    // Process file with cluster approach
    const result = await this.processFileWithCluster(
      orgId,
      sourceId,
      fileEventData.id, // fileId
      resourcePath,
      fileMetadata,
      commitId
    );
    
    // Emit cluster processing event if in cluster mode
    if (this.clusterMode) {
      this.eventBus.emit('file.cluster.processed', {
        orgId,
        sourceId,
        fileId: fileEventData.id,
        resourcePath,
        clusterId: result.clusterId,
        slots: result.slots,
        extractionTriggered: result.extractionTriggered,
        crossLayerLinksCreated: result.crossLayerLinksCreated,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  }
  
  public getEventBus(): any {
    return this.eventBus;
  }
}
