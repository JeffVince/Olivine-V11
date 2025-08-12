"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const DropboxService_1 = require("../services/DropboxService");
const GoogleDriveService_1 = require("../services/GoogleDriveService");
const SupabaseService_1 = require("../services/SupabaseService");
const events_1 = require("events");
class SyncAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService, config) {
        super('sync-agent', queueService, config);
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.dropboxService = new DropboxService_1.DropboxService();
        this.googleDriveService = new GoogleDriveService_1.GoogleDriveService();
        this.supabaseService = new SupabaseService_1.SupabaseService();
        this.syncStatuses = new Map();
        this.eventEmitter = new events_1.EventEmitter();
    }
    async onStart() {
        this.logger.info('Starting SyncAgent...');
        this.queueService.registerWorker('webhook-events', async (job) => {
            await this.processWebhookEvent(job.data);
        }, {
            concurrency: 5,
            connection: this.queueService.connection
        });
        this.queueService.registerWorker('source-sync', async (job) => {
            await this.processBulkSync(job.data);
        }, {
            concurrency: 2,
            connection: this.queueService.connection
        });
        this.queueService.registerWorker('delta-sync', async (job) => {
            await this.processDeltaSync(job.data);
        }, {
            concurrency: 3,
            connection: this.queueService.connection
        });
        this.startPeriodicHealthCheck();
        this.logger.info('SyncAgent started successfully');
    }
    async onStop() {
        this.logger.info('Stopping SyncAgent...');
        this.syncStatuses.clear();
        this.logger.info('SyncAgent stopped');
    }
    async onPause() {
        this.logger.info('Pausing SyncAgent...');
        for (const [sourceId, status] of this.syncStatuses.entries()) {
            if (status.status === 'syncing') {
                status.status = 'paused';
                this.logger.info(`Paused sync for source ${sourceId}`);
            }
        }
    }
    async onResume() {
        this.logger.info('Resuming SyncAgent...');
        for (const [sourceId, status] of this.syncStatuses.entries()) {
            if (status.status === 'paused') {
                status.status = 'idle';
                this.logger.info(`Resumed sync for source ${sourceId}`);
            }
        }
    }
    async processWebhookEvent(eventData) {
        const { orgId, sourceId, eventType, resourcePath, eventData: webhookData } = eventData;
        this.validateContext({ orgId });
        this.logger.info(`Processing webhook event: ${eventType} for ${resourcePath}`, { orgId, sourceId });
        try {
            this.updateSyncStatus(sourceId, { status: 'syncing' });
            const source = await this.getSource(sourceId, orgId);
            if (!source) {
                throw new Error(`Source not found: ${sourceId}`);
            }
            switch (eventType) {
                case 'file_added':
                case 'file_modified':
                    await this.handleFileChange(orgId, sourceId, resourcePath, 'upsert', webhookData);
                    break;
                case 'file_deleted':
                    await this.handleFileChange(orgId, sourceId, resourcePath, 'delete', webhookData);
                    break;
                case 'folder_added':
                    await this.handleFolderChange(orgId, sourceId, resourcePath, 'create', webhookData);
                    break;
                case 'folder_deleted':
                    await this.handleFolderChange(orgId, sourceId, resourcePath, 'delete', webhookData);
                    break;
                default:
                    this.logger.warn(`Unknown event type: ${eventType}`);
            }
            const status = this.syncStatuses.get(sourceId);
            if (status) {
                status.filesProcessed += 1;
                status.lastSync = new Date();
                status.status = 'idle';
            }
            this.eventEmitter.emit('sync-progress', {
                orgId,
                sourceId,
                eventType,
                resourcePath,
                status: 'completed'
            });
        }
        catch (error) {
            this.logger.error(`Error processing webhook event for ${resourcePath}:`, error);
            const status = this.syncStatuses.get(sourceId);
            if (status) {
                status.status = 'error';
                status.errors.push(`Webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            this.eventEmitter.emit('sync-error', {
                orgId,
                sourceId,
                error: error instanceof Error ? error.message : 'Unknown error',
                resourcePath
            });
            throw error;
        }
    }
    updateSyncStatus(sourceId, updates) {
        const current = this.syncStatuses.get(sourceId) || {
            sourceId,
            status: 'idle',
            lastSync: null,
            filesProcessed: 0,
            totalFiles: 0,
            progress: 0,
            errors: []
        };
        this.syncStatuses.set(sourceId, { ...current, ...updates });
    }
    async getSource(sourceId, orgId) {
        const query = 'SELECT * FROM sources WHERE id = $1 AND org_id = $2';
        const result = await this.postgresService.executeQuery(query, [sourceId, orgId]);
        return result.rows[0] || null;
    }
    async handleFileChange(orgId, sourceId, resourcePath, action, webhookData) {
        this.logger.info(`Handling file change: ${action} ${resourcePath}`, { orgId, sourceId });
        if (action === 'delete') {
            await this.markFileAsDeleted(orgId, sourceId, resourcePath);
        }
        else {
            await this.queueService.addJob('file-sync', 'process-file', {
                orgId,
                sourceId,
                resourcePath,
                action,
                webhookData,
                syncedAt: new Date().toISOString()
            });
        }
        await this.queueService.addJob('provenance', 'create-action', {
            orgId,
            actionType: 'file_sync',
            tool: 'sync-agent',
            entityType: 'File',
            entityId: resourcePath,
            inputs: { sourceId, resourcePath, action },
            outputs: { status: 'queued' }
        });
    }
    async handleFolderChange(orgId, sourceId, resourcePath, action, webhookData) {
        this.logger.info(`Handling folder change: ${action} ${resourcePath}`, { orgId, sourceId });
        if (action === 'delete') {
            await this.markFolderAsDeleted(orgId, sourceId, resourcePath);
        }
        else {
            await this.queueService.addJob('source-sync', 'scan-folder', {
                orgId,
                sourceId,
                folderPath: resourcePath,
                webhookData
            });
        }
    }
    async markFileAsDeleted(orgId, sourceId, path) {
        await this.postgresService.executeQuery('UPDATE files SET deleted = true, deleted_at = NOW() WHERE org_id = $1 AND source_id = $2 AND path = $3', [orgId, sourceId, path]);
        await this.neo4jService.run('MATCH (f:File {org_id: $orgId, source_id: $sourceId, path: $path}) SET f.deleted = true, f.deleted_at = datetime()', { orgId, sourceId, path });
    }
    async markFolderAsDeleted(orgId, sourceId, folderPath) {
        await this.postgresService.executeQuery('UPDATE files SET deleted = true, deleted_at = NOW() WHERE org_id = $1 AND source_id = $2 AND path LIKE $3', [orgId, sourceId, `${folderPath}%`]);
        await this.neo4jService.run('MATCH (f:File {org_id: $orgId, source_id: $sourceId}) WHERE f.path STARTS WITH $folderPath SET f.deleted = true, f.deleted_at = datetime()', { orgId, sourceId, folderPath });
    }
    async processBulkSync(jobData) {
        this.logger.info(`Processing bulk sync for source ${jobData.sourceId}`);
    }
    async processDeltaSync(jobData) {
        this.logger.info(`Processing delta sync for source ${jobData.sourceId}`);
    }
    startPeriodicHealthCheck() {
        setInterval(async () => {
            try {
                for (const [sourceId, status] of this.syncStatuses.entries()) {
                    if (status.status === 'syncing' && status.lastSync) {
                        const staleDuration = Date.now() - status.lastSync.getTime();
                        if (staleDuration > 30 * 60 * 1000) {
                            this.logger.warn(`Detected stale sync for source ${sourceId}, resetting to idle`);
                            status.status = 'idle';
                            status.errors.push('Sync operation timed out and was reset');
                        }
                    }
                }
            }
            catch (error) {
                this.logger.error('Error in periodic health check:', error);
            }
        }, 5 * 60 * 1000);
    }
    getSyncStatus(sourceId) {
        return this.syncStatuses.get(sourceId) || null;
    }
    getAllSyncStatuses() {
        return new Map(this.syncStatuses);
    }
    getEventEmitter() {
        return this.eventEmitter;
    }
}
exports.SyncAgent = SyncAgent;
//# sourceMappingURL=SyncAgent.js.map