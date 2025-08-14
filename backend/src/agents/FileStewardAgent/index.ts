import { BaseAgent, AgentContext, AgentConfig } from '../BaseAgent'
import { QueueService } from '../../services/queues/QueueService'
import { Neo4jService } from '../../services/Neo4jService'
import { PostgresService } from '../../services/PostgresService'
import { DropboxService } from '../../services/DropboxService'
import { GoogleDriveService } from '../../services/GoogleDriveService'
import { FileProcessingService } from '../../services/FileProcessingService'
import { EventProcessingService } from '../../services/EventProcessingService'
import { ClassificationService } from '../../services/classification/ClassificationService'
import { TaxonomyService } from '../../services/TaxonomyService'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { FileRepository } from './graph/FileRepository'
import { FolderRepository } from './graph/FolderRepository'
import { ClassificationRepository } from './graph/ClassificationRepository'
import { ContentRepository } from './graph/ContentRepository'
import { Classifier } from './classification/Classifier'
import { Extractor } from './extraction/Extractor'
import { ExtractionJobService } from './extraction/ExtractionJobService'
import { ClusterService } from './cluster/ClusterService'
import { CrossLayerLinkService } from './cluster/CrossLayerLinkService'
import { EventHandlers } from './handlers/EventHandlers'
import { inferMimeType } from './utils/mime'
import { SyncJobData, ClusterProcessingResult, FileMetadata } from './types'

export class FileStewardAgent extends BaseAgent {
  private neo4jService: Neo4jService
  private postgresService: PostgresService
  private dropboxService: DropboxService
  private gdriveService: GoogleDriveService
  private fileProcessingService: FileProcessingService
  private classificationService: ClassificationService
  private taxonomyService: TaxonomyService
  private clusterMode = false
  private eventBus: any
  private filesRepo: FileRepository
  private foldersRepo: FolderRepository
  private classificationRepo: ClassificationRepository
  private contentRepo: ContentRepository
  private classifier: Classifier
  private extractor: Extractor
  private extractionJobs: ExtractionJobService
  private clusterService: ClusterService
  private crossLayerLinkService: CrossLayerLinkService
  private handlers: EventHandlers

  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('file-steward-agent', queueService, {
      maxRetries: 3,
      retryDelay: 2000,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    })

    this.neo4jService = new Neo4jService()
    this.postgresService = new PostgresService()
    this.dropboxService = new DropboxService()
    this.gdriveService = new GoogleDriveService()
    const eventProcessingService = new EventProcessingService(null as any, queueService)
    this.fileProcessingService = new FileProcessingService(eventProcessingService)
    ;(eventProcessingService as any).fileProcessingService = this.fileProcessingService
    this.classificationService = new ClassificationService(this.postgresService)
    this.taxonomyService = new TaxonomyService()
    this.eventBus = new (require('events').EventEmitter)()
    this.clusterMode = process.env.CLUSTER_MODE === 'true'

    this.filesRepo = new FileRepository(this.neo4jService)
    this.foldersRepo = new FolderRepository(this.neo4jService)
    this.classificationRepo = new ClassificationRepository(this.neo4jService)
    this.contentRepo = new ContentRepository(this.neo4jService)
    this.classifier = new Classifier(this.postgresService, this.neo4jService)
    this.extractor = new Extractor(this.fileProcessingService)
    this.extractionJobs = new ExtractionJobService(this.postgresService, this.queueService)
    this.clusterService = new ClusterService(this.neo4jService, this.postgresService, this.classifier)
    this.crossLayerLinkService = new CrossLayerLinkService(this.neo4jService)
    this.handlers = new EventHandlers({
      files: this.filesRepo,
      folders: this.foldersRepo,
      classification: this.classificationRepo,
      content: this.contentRepo,
      queues: this.queueService,
      postgres: this.postgresService,
      classifier: this.classifier,
      extractor: this.extractor,
      clusterMode: this.clusterMode,
      eventBus: this.eventBus
    })
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting FileStewardAgent queue workers...')

    this.queueService.registerWorker('file-sync', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('processSyncEvent', job.data, context, () => this.processSyncEvent(job.data as SyncJobData))
    })

    this.queueService.registerWorker('file-classification', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('classifyFile', job.data, context, () => this.classifyFile(job.data))
    })

    this.queueService.registerWorker('content-extraction', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('extractContent', job.data, context, () => this.extractContent(job.data))
    })

    this.logger.info('FileStewardAgent workers registered successfully')
  }

  protected async onStop(): Promise<void> { this.logger.info('Stopping FileStewardAgent...') }
  protected async onPause(): Promise<void> { this.logger.info('Pausing FileStewardAgent...') }
  protected async onResume(): Promise<void> { this.logger.info('Resuming FileStewardAgent...') }

  async processSyncEvent(eventData: SyncJobData): Promise<void> {
    const { orgId, sourceId, eventType, resourcePath, eventData: rawEventData } = eventData
    this.validateContext({ orgId })
    this.logger.info(`Processing sync event: ${eventType} for ${resourcePath}`, { orgId, sourceId })
    const commitId = await this.createCommit(orgId, `File sync: ${eventType} ${resourcePath}`)
    try {
      switch (eventType) {
        case 'file_created':
          await this.handleFileCreated(orgId, sourceId, resourcePath, rawEventData, commitId)
          break
        case 'file_updated':
          await this.handleFileUpdated(orgId, sourceId, resourcePath, rawEventData, commitId)
          break
        case 'file_deleted':
          await this.handleFileDeleted(orgId, sourceId, resourcePath, rawEventData, commitId)
          break
        case 'folder_created':
          await this.handleFolderCreated(orgId, sourceId, resourcePath, rawEventData, commitId)
          break
        case 'folder_updated':
          await this.handleFolderUpdated(orgId, sourceId, resourcePath, rawEventData, commitId)
          break
        case 'folder_deleted':
          await this.handleFolderDeleted(orgId, sourceId, resourcePath, rawEventData, commitId)
          break
      }
      this.logger.info(`Successfully processed sync event: ${eventType} for ${resourcePath}`)
    } catch (error) {
      this.logger.error(`Failed to process sync event: ${eventType} for ${resourcePath}`, error)
      throw error
    }
  }

  private async handleFileCreated(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void> {
    const fileMetadata = this.handlers.extractFileMetadata(eventData)
    const fileId = await this.filesRepo.upsertFileNode({
      orgId,
      sourceId,
      resourcePath,
      dbId: fileMetadata.dbId,
      name: fileMetadata.name,
      size: fileMetadata.size,
      mimeType: fileMetadata.mimeType,
      checksum: fileMetadata.checksum || null,
      modified: fileMetadata.modified,
      metadataJson: JSON.stringify(fileMetadata.extra || {})
    })
    await this.handlers.ensureFolderHierarchy(orgId, sourceId, resourcePath)
    if (this.clusterMode) {
      const clusterId = await this.clusterService.createContentCluster(orgId, fileId)
      const slots = await this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata)
      const extractionTriggered = await this.extractionJobs.queueExtractionJobs(orgId, fileId, slots, fileMetadata)
      const crossLayerLinksCreated = await this.crossLayerLinkService.createInitialCrossLayerLinks(orgId, fileId, slots)
      this.eventBus.emit('file.processed', {
        type: 'file.processed', orgId, fileId, clusterId, slots, extractionTriggered, eventType: 'created', timestamp: new Date().toISOString(), agent: 'file-steward-agent'
      })
    } else {
      if (this.shouldClassifyFile(fileMetadata.mimeType)) {
        await this.queueService.addJob('file-classification', 'classify-file', { orgId, fileId, filePath: resourcePath, sourceId, commitId, metadata: fileMetadata })
      }
      if (this.shouldExtractContent(fileMetadata.mimeType)) {
        await this.queueService.addJob('content-extraction', 'extract-content', { orgId, fileId, filePath: resourcePath, sourceId, commitId, metadata: fileMetadata })
      }
    }
  }

  private async handleFileUpdated(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void> {
    const fileMetadata = this.handlers.extractFileMetadata(eventData)
    const existingFile = await this.filesRepo.getFileNode(orgId, sourceId, resourcePath)
    if (!existingFile) {
      await this.handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId)
      return
    }
    await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId)
    await this.filesRepo.updateFileNode(existingFile.id, {
      name: fileMetadata.name,
      size: fileMetadata.size,
      mimeType: fileMetadata.mimeType,
      checksum: fileMetadata.checksum || null,
      modified: fileMetadata.modified,
      metadataJson: JSON.stringify(fileMetadata.extra || {})
    })
    if (this.hasSignificantChanges(existingFile.properties, fileMetadata)) {
      await this.queueService.addJob('file-classification', 'classify-file', { orgId, fileId: existingFile.id, filePath: resourcePath, sourceId, commitId, metadata: fileMetadata })
    }
  }

  private async handleFileDeleted(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void> {
    const existingFile = await this.filesRepo.getFileNode(orgId, sourceId, resourcePath)
    if (!existingFile) {
      this.logger.warn(`File not found for deletion: ${resourcePath}`)
      return
    }
    await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId)
    await this.filesRepo.softDeleteFileNode(existingFile.id)
    await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId)
  }

  private async handleFolderCreated(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void> {
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId)
  }

  private async handleFolderUpdated(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void> {
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId)
  }

  private async handleFolderDeleted(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void> {
    await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId)
  }

  private extractFileMetadata(eventData: any): FileMetadata { return this.handlers.extractFileMetadata(eventData) }

  private async upsertFileNode(orgId: string, sourceId: string, resourcePath: string, metadata: FileMetadata, _commitId: string): Promise<string> {
    return this.filesRepo.upsertFileNode({
      orgId,
      sourceId,
      resourcePath,
      dbId: metadata.dbId,
      name: metadata.name,
      size: metadata.size,
      mimeType: metadata.mimeType,
      checksum: metadata.checksum || null,
      modified: metadata.modified,
      metadataJson: JSON.stringify(metadata.extra || {})
    })
  }

  private async ensureFolderHierarchy(orgId: string, sourceId: string, filePath: string, _commitId: string): Promise<void> {
    await this.handlers.ensureFolderHierarchy(orgId, sourceId, filePath)
  }

  private async upsertFolderNode(orgId: string, sourceId: string, path: string, name: string, _parentId: string | null, _commitId: string): Promise<string> {
    return this.foldersRepo.upsertFolderNode(orgId, sourceId, path, name)
  }

  private async getFileNode(orgId: string, sourceId: string, path: string): Promise<any> { return this.filesRepo.getFileNode(orgId, sourceId, path) }

  private async createEntityVersion(entityId: string, entityType: string, properties: any, commitId: string): Promise<void> {
    this.logger.debug(`Creating version for ${entityType} ${entityId}`, { commitId })
  }

  private async updateFileNode(fileId: string, metadata: FileMetadata, _commitId: string): Promise<void> {
    await this.filesRepo.updateFileNode(fileId, {
      name: metadata.name,
      size: metadata.size,
      mimeType: metadata.mimeType,
      checksum: metadata.checksum || null,
      modified: metadata.modified,
      metadataJson: JSON.stringify(metadata.extra || {})
    })
  }

  private async softDeleteFileNode(fileId: string, _commitId: string): Promise<void> { await this.filesRepo.softDeleteFileNode(fileId) }

  private async cleanupOrphanedFolders(orgId: string, sourceId: string, resourcePath: string, commitId: string): Promise<void> {
    this.logger.debug(`Cleaning up orphaned folders for path: ${resourcePath}`)
  }

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
    ]
    return classifiableMimeTypes.includes(mimeType)
  }

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
    ]
    return extractableMimeTypes.includes(mimeType)
  }

  private hasSignificantChanges(oldMetadata: any, newMetadata: FileMetadata): boolean {
    if (oldMetadata.name !== newMetadata.name) return true
    const sizeChange = Math.abs(oldMetadata.size - newMetadata.size) / oldMetadata.size
    if (sizeChange > 0.1) return true
    const modifiedTime = new Date(newMetadata.modified)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    return modifiedTime > oneHourAgo
  }

  private inferMimeType(filename: string): string { return inferMimeType(filename) }

  private async classifyFile(jobData: any): Promise<void> { await this.handlers.classifyFile(jobData) }

  private async updateFileClassification(fileId: string, classification: { status: string; confidence: number; metadata?: Record<string, unknown> }): Promise<void> {
    await this.classificationRepo.updateFileClassification(fileId, classification)
  }

  private async extractContent(jobData: any): Promise<void> { await this.handlers.extractContent(jobData) }

  private async updateFileContent(fileId: string, extractedContent: any): Promise<void> { await this.contentRepo.updateFileContent(fileId, extractedContent) }

  private async processFileWithCluster(
    orgId: string,
    sourceId: string,
    fileId: string,
    resourcePath: string,
    fileMetadata: FileMetadata,
    commitId: string
  ): Promise<ClusterProcessingResult> {
    this.logger.info(`Processing file with cluster-centric approach: ${resourcePath}`, { orgId, fileId })
    const clusterId = await this.clusterService.createContentCluster(orgId, fileId)
    const slots = await this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata)
    const extractionTriggered = await this.extractionJobs.queueExtractionJobs(orgId, fileId, slots, fileMetadata)
    const crossLayerLinksCreated = await this.crossLayerLinkService.createInitialCrossLayerLinks(orgId, fileId, slots)
    return { fileId, clusterId, slots, extractionTriggered, crossLayerLinksCreated }
  }

  private async createContentCluster(orgId: string, fileId: string, _commitId: string): Promise<string> { return this.clusterService.createContentCluster(orgId, fileId) }
  private async performMultiSlotClassification(orgId: string, fileId: string, resourcePath: string, fileMetadata: FileMetadata): Promise<string[]> { return this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata) }
  private async queueExtractionJobs(orgId: string, fileId: string, slots: string[], fileMetadata: FileMetadata): Promise<boolean> { return this.extractionJobs.queueExtractionJobs(orgId, fileId, slots, { mimeType: fileMetadata.mimeType }) }
  private async createInitialCrossLayerLinks(orgId: string, fileId: string, slots: string[]): Promise<number> { return this.crossLayerLinkService.createInitialCrossLayerLinks(orgId, fileId, slots) }

  public enableClusterMode(): void { this.clusterMode = true; this.logger.info('Cluster mode enabled for FileStewardAgent') }
  public disableClusterMode(): void { this.clusterMode = false; this.logger.info('Cluster mode disabled for FileStewardAgent') }

  public async processSyncEventWithCluster(eventData: any): Promise<ClusterProcessingResult> {
    const { orgId, sourceId, resourcePath, eventData: fileEventData } = eventData
    const commitId = uuidv4()
    const fileMetadata: FileMetadata = {
      name: fileEventData.name,
      size: fileEventData.size,
      mimeType: fileEventData.mimeType || this.inferMimeType(fileEventData.name),
      checksum: fileEventData.checksum,
      modified: fileEventData.modified,
      dbId: fileEventData.id,
      provider: fileEventData.provider,
      extra: fileEventData.extra || {}
    }
    await this.neo4jService.run(
      `
      MERGE (f:File {id: $fileId})
      ON CREATE SET f.orgId = $orgId,
                    f.path = $resourcePath,
                    f.name = $name,
                    f.mimeType = $mimeType,
                    f.current = true,
                    f.deleted = false,
                    f.createdAt = datetime(),
                    f.updatedAt = datetime()
      `,
      { fileId: fileEventData.id, orgId, resourcePath, name: fileMetadata.name, mimeType: fileMetadata.mimeType }
    )
    const result = await this.processFileWithCluster(orgId, sourceId, fileEventData.id, resourcePath, fileMetadata, commitId)
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
      })
    }
    return result
  }

  public getEventBus(): any { return this.eventBus }
}

export * from './types'
export * from './handlers/EventHandlers'
export * from './graph/FileRepository'
export * from './graph/FolderRepository'
export * from './graph/ClassificationRepository'
export * from './graph/ContentRepository'
export * from './classification/Classifier'
export * from './extraction/Extractor'
export * from './extraction/ExtractionJobService'
export * from './cluster/ClusterService'
export * from './cluster/CrossLayerLinkService'