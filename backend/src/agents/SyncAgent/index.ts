import { BaseAgent, AgentContext, AgentConfig } from '../BaseAgent'
import { QueueService } from '../../services/queues/QueueService'
import { Neo4jService } from '../../services/Neo4jService'
import { PostgresService } from '../../services/PostgresService'
import { DropboxService } from '../../services/DropboxService'
import { GoogleDriveService } from '../../services/GoogleDriveService'
import { SupabaseService } from '../../services/SupabaseService'
import { EventEmitter } from 'events'
import { SyncJobData, SyncStatus } from './types'

export class SyncAgent extends BaseAgent {
  private neo4jService: Neo4jService
  private postgresService: PostgresService
  private dropboxService: DropboxService
  private googleDriveService: GoogleDriveService
  private supabaseService: SupabaseService
  private syncStatuses: Map<string, SyncStatus>
  private eventEmitter: EventEmitter

  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('sync-agent', queueService, config)
    this.neo4jService = new Neo4jService()
    this.postgresService = new PostgresService()
    this.dropboxService = new DropboxService()
    this.googleDriveService = new GoogleDriveService()
    this.supabaseService = new SupabaseService()
    this.syncStatuses = new Map()
    this.eventEmitter = new EventEmitter()
  }

  /**
   * Initialize SyncAgent and register webhook processors
   */
  protected async onStart(): Promise<void> {
    this.logger.info('Starting SyncAgent...')

    // Register webhook event processors
    {
      const opts: any = { concurrency: 5 }
      if (this.queueService.connection) opts.connection = this.queueService.connection
      this.queueService.registerWorker('webhook-events', async (job) => {
        await this.processWebhookEvent(job.data)
      }, opts)
    }

    // Register bulk sync processors
    {
      const opts: any = { concurrency: 2 }
      if (this.queueService.connection) opts.connection = this.queueService.connection
      this.queueService.registerWorker('source-sync', async (job) => {
        await this.processBulkSync(job.data)
      }, opts)
    }

    // Register delta sync processors
    {
      const opts: any = { concurrency: 3 }
      if (this.queueService.connection) opts.connection = this.queueService.connection
      this.queueService.registerWorker('delta-sync', async (job) => {
        await this.processDeltaSync(job.data)
      }, opts)
    }

    // Start periodic health checks
    this.startPeriodicHealthCheck()

    this.logger.info('SyncAgent started successfully')
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping SyncAgent...')

    // Clear all sync statuses
    this.syncStatuses.clear()

    this.logger.info('SyncAgent stopped')
  }

  protected async onPause(): Promise<void> {
    this.logger.info('Pausing SyncAgent...')

    // Pause all active syncs
    for (const [sourceId, status] of this.syncStatuses.entries()) {
      if (status.status === 'syncing') {
        status.status = 'paused'
        this.logger.info(`Paused sync for source ${sourceId}`)
      }
    }
  }

  protected async onResume(): Promise<void> {
    this.logger.info('Resuming SyncAgent...')

    // Resume paused syncs
    for (const [sourceId, status] of this.syncStatuses.entries()) {
      if (status.status === 'paused') {
        status.status = 'idle'
        this.logger.info(`Resumed sync for source ${sourceId}`)
      }
    }
  }

  /**
   * Process incoming webhook events from storage providers
   */
  private async processWebhookEvent(eventData: SyncJobData): Promise<void> {
    const { orgId, sourceId, eventType, resourcePath, eventData: webhookData } = eventData

    this.validateContext({ orgId })
    this.logger.info(`Processing webhook event: ${eventType} for ${resourcePath}`, { orgId, sourceId })

    try {
      // Update sync status
      this.updateSyncStatus(sourceId, { status: 'syncing' })

      // Get source details
      const source = await this.getSource(sourceId, orgId)
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`)
      }

      // Process based on event type
      switch (eventType) {
        case 'file_added':
        case 'file_modified':
          await this.handleFileChange(orgId, sourceId, resourcePath, 'upsert', webhookData)
          break

        case 'file_deleted':
          await this.handleFileChange(orgId, sourceId, resourcePath, 'delete', webhookData)
          break

        case 'folder_added':
          await this.handleFolderChange(orgId, sourceId, resourcePath, 'create', webhookData)
          break

        case 'folder_deleted':
          await this.handleFolderChange(orgId, sourceId, resourcePath, 'delete', webhookData)
          break

        default:
          this.logger.warn(`Unknown event type: ${eventType}`)
      }

      // Update sync status
      const status = this.syncStatuses.get(sourceId)
      if (status) {
        status.filesProcessed += 1
        status.lastSync = new Date()
        status.status = 'idle'
      }

      // Emit sync progress event
      this.eventEmitter.emit('sync-progress', {
        orgId,
        sourceId,
        eventType,
        resourcePath,
        status: 'completed'
      })

    } catch (error) {
      this.logger.error(`Error processing webhook event for ${resourcePath}:`, error)

      // Update error status
      const status = this.syncStatuses.get(sourceId)
      if (status) {
        status.status = 'error'
        status.errors.push(`Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Emit error event
      this.eventEmitter.emit('sync-error', {
        orgId,
        sourceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        resourcePath
      })

      throw error
    }
  }

  /**
   * Helper methods
   */
  private updateSyncStatus(sourceId: string, updates: Partial<SyncStatus>): void {
    const current = this.syncStatuses.get(sourceId) || {
      sourceId,
      status: 'idle' as const,
      lastSync: null,
      filesProcessed: 0,
      totalFiles: 0,
      progress: 0,
      errors: [] as string[]
    }

    this.syncStatuses.set(sourceId, { ...current, ...updates })
  }

  private async getSource(sourceId: string, orgId: string): Promise<any> {
    const query = 'SELECT * FROM sources WHERE id = $1 AND org_id = $2'
    const result = await this.postgresService.executeQuery(query, [sourceId, orgId])
    return result.rows[0] || null
  }

  private async handleFileChange(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    action: 'upsert' | 'delete',
    webhookData: any
  ): Promise<void> {
    this.logger.info(`Handling file change: ${action} ${resourcePath}`, { orgId, sourceId })

    if (action === 'delete') {
      // Mark file as deleted in both PostgreSQL and Neo4j
      await this.markFileAsDeleted(orgId, sourceId, resourcePath)
    } else {
      // Queue file for processing by FileStewardAgent
      await this.queueService.addJob('file-sync', 'process-file', {
        orgId,
        sourceId,
        resourcePath,
        action,
        webhookData,
        syncedAt: new Date().toISOString()
      })
    }

    // Create provenance record
    await this.queueService.addJob('provenance', 'create-action', {
      orgId,
      actionType: 'file_sync',
      tool: 'sync-agent',
      entityType: 'File',
      entityId: resourcePath,
      inputs: { sourceId, resourcePath, action },
      outputs: { status: 'queued' }
    })
  }

  private async handleFolderChange(
    orgId: string,
    sourceId: string,
    resourcePath: string,
    action: 'create' | 'delete',
    webhookData: any
  ): Promise<void> {
    this.logger.info(`Handling folder change: ${action} ${resourcePath}`, { orgId, sourceId })

    if (action === 'delete') {
      // Mark all files in folder as deleted
      await this.markFolderAsDeleted(orgId, sourceId, resourcePath)
    } else {
      // Trigger rescan of folder contents
      await this.queueService.addJob('source-sync', 'scan-folder', {
        orgId,
        sourceId,
        folderPath: resourcePath,
        webhookData
      })
    }
  }

  private async markFileAsDeleted(orgId: string, sourceId: string, path: string): Promise<void> {
    // Update in PostgreSQL
    await this.postgresService.executeQuery(
      'UPDATE files SET deleted = true, deleted_at = NOW() WHERE org_id = $1 AND source_id = $2 AND path = $3',
      [orgId, sourceId, path]
    )

    // Update in Neo4j
    await this.neo4jService.run(
      'MATCH (f:File {org_id: $orgId, source_id: $sourceId, path: $path}) SET f.deleted = true, f.deleted_at = datetime()',
      { orgId, sourceId, path }
    )
  }

  private async markFolderAsDeleted(orgId: string, sourceId: string, folderPath: string): Promise<void> {
    // Update all files in folder in PostgreSQL
    await this.postgresService.executeQuery(
      'UPDATE files SET deleted = true, deleted_at = NOW() WHERE org_id = $1 AND source_id = $2 AND path LIKE $3',
      [orgId, sourceId, `${folderPath}%`]
    )

    // Update all files in folder in Neo4j
    await this.neo4jService.run(
      'MATCH (f:File {org_id: $orgId, source_id: $sourceId}) WHERE f.path STARTS WITH $folderPath SET f.deleted = true, f.deleted_at = datetime()',
      { orgId, sourceId, folderPath }
    )
  }

  private async processBulkSync(jobData: any): Promise<void> {
    // Bulk sync implementation - simplified for space
    this.logger.info(`Processing bulk sync for source ${jobData.sourceId}`)
  }

  private async processDeltaSync(jobData: any): Promise<void> {
    // Delta sync implementation - simplified for space
    this.logger.info(`Processing delta sync for source ${jobData.sourceId}`)
  }

  private startPeriodicHealthCheck(): void {
    setInterval(async () => {
      try {
        // Check for stale syncs and clean up
        for (const [sourceId, status] of this.syncStatuses.entries()) {
          if (status.status === 'syncing' && status.lastSync) {
            const staleDuration = Date.now() - status.lastSync.getTime()

            // If sync has been running for more than 30 minutes, consider it stale
            if (staleDuration > 30 * 60 * 1000) {
              this.logger.warn(`Detected stale sync for source ${sourceId}, resetting to idle`)
              status.status = 'idle'
              status.errors.push('Sync operation timed out and was reset')
            }
          }
        }
      } catch (error) {
        this.logger.error('Error in periodic health check:', error)
      }
    }, 5 * 60 * 1000) // Run every 5 minutes
  }

  /**
   * Public methods for external access
   */
  public getSyncStatus(sourceId: string): SyncStatus | null {
    return this.syncStatuses.get(sourceId) || null
  }

  public getAllSyncStatuses(): Map<string, SyncStatus> {
    return new Map(this.syncStatuses)
  }

  public getEventEmitter(): EventEmitter {
    return this.eventEmitter
  }
}

export * from './types'


