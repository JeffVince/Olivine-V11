"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStewardAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const Neo4jService_1 = require("../services/Neo4jService");
const PostgresService_1 = require("../services/PostgresService");
const DropboxService_1 = require("../services/DropboxService");
const GoogleDriveService_1 = require("../services/GoogleDriveService");
const FileProcessingService_1 = require("../services/FileProcessingService");
const EventProcessingService_1 = require("../services/EventProcessingService");
const ClassificationService_1 = require("../services/classification/ClassificationService");
const TaxonomyService_1 = require("../services/TaxonomyService");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const FileRepository_1 = require("./FileStewardAgent/graph/FileRepository");
const FolderRepository_1 = require("./FileStewardAgent/graph/FolderRepository");
const ClassificationRepository_1 = require("./FileStewardAgent/graph/ClassificationRepository");
const ContentRepository_1 = require("./FileStewardAgent/graph/ContentRepository");
const Classifier_1 = require("./FileStewardAgent/classification/Classifier");
const Extractor_1 = require("./FileStewardAgent/extraction/Extractor");
const ExtractionJobService_1 = require("./FileStewardAgent/extraction/ExtractionJobService");
const ClusterService_1 = require("./FileStewardAgent/cluster/ClusterService");
const CrossLayerLinkService_1 = require("./FileStewardAgent/cluster/CrossLayerLinkService");
const EventHandlers_1 = require("./FileStewardAgent/handlers/EventHandlers");
const mime_1 = require("./FileStewardAgent/utils/mime");
class FileStewardAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService, config) {
        super('file-steward-agent', queueService, {
            maxRetries: 3,
            retryDelay: 2000,
            healthCheckInterval: 30000,
            enableMonitoring: true,
            logLevel: 'info',
            ...config
        });
        this.clusterMode = false;
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.dropboxService = new DropboxService_1.DropboxService();
        this.gdriveService = new GoogleDriveService_1.GoogleDriveService();
        const eventProcessingService = new EventProcessingService_1.EventProcessingService(null, queueService);
        this.fileProcessingService = new FileProcessingService_1.FileProcessingService(eventProcessingService);
        eventProcessingService.fileProcessingService = this.fileProcessingService;
        this.classificationService = new ClassificationService_1.ClassificationService(this.postgresService);
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.eventBus = new (require('events').EventEmitter)();
        this.clusterMode = process.env.CLUSTER_MODE === 'true';
        this.filesRepo = new FileRepository_1.FileRepository(this.neo4jService);
        this.foldersRepo = new FolderRepository_1.FolderRepository(this.neo4jService);
        this.classificationRepo = new ClassificationRepository_1.ClassificationRepository(this.neo4jService);
        this.contentRepo = new ContentRepository_1.ContentRepository(this.neo4jService);
        this.classifier = new Classifier_1.Classifier(this.postgresService, this.neo4jService);
        this.extractor = new Extractor_1.Extractor(this.fileProcessingService);
        this.extractionJobs = new ExtractionJobService_1.ExtractionJobService(this.postgresService, this.queueService);
        this.clusterService = new ClusterService_1.ClusterService(this.neo4jService, this.postgresService, this.classifier);
        this.crossLayerLinkService = new CrossLayerLinkService_1.CrossLayerLinkService(this.neo4jService);
        this.handlers = new EventHandlers_1.EventHandlers({
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
        });
    }
    async onStart() {
        this.logger.info('Starting FileStewardAgent queue workers...');
        this.queueService.registerWorker('file-sync', async (job) => {
            const context = {
                orgId: job.data.orgId,
                sessionId: (0, uuid_1.v4)()
            };
            await this.executeJob('processSyncEvent', job.data, context, () => this.processSyncEvent(job.data));
        });
        this.queueService.registerWorker('file-classification', async (job) => {
            const context = {
                orgId: job.data.orgId,
                sessionId: (0, uuid_1.v4)()
            };
            await this.executeJob('classifyFile', job.data, context, () => this.classifyFile(job.data));
        });
        this.queueService.registerWorker('content-extraction', async (job) => {
            const context = {
                orgId: job.data.orgId,
                sessionId: (0, uuid_1.v4)()
            };
            await this.executeJob('extractContent', job.data, context, () => this.extractContent(job.data));
        });
        this.logger.info('FileStewardAgent workers registered successfully');
    }
    async onStop() {
        this.logger.info('Stopping FileStewardAgent...');
    }
    async onPause() {
        this.logger.info('Pausing FileStewardAgent...');
    }
    async onResume() {
        this.logger.info('Resuming FileStewardAgent...');
    }
    async processSyncEvent(eventData) {
        const { orgId, sourceId, eventType, resourcePath, eventData: rawEventData } = eventData;
        this.validateContext({ orgId });
        this.logger.info(`Processing sync event: ${eventType} for ${resourcePath}`, { orgId, sourceId });
        const commitId = await this.createCommit(orgId, `File sync: ${eventType} ${resourcePath}`);
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
        }
        catch (error) {
            this.logger.error(`Failed to process sync event: ${eventType} for ${resourcePath}`, error);
            throw error;
        }
    }
    async handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId) {
        const fileMetadata = this.handlers.extractFileMetadata(eventData);
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
        });
        await this.handlers.ensureFolderHierarchy(orgId, sourceId, resourcePath);
        if (this.clusterMode) {
            const clusterId = await this.clusterService.createContentCluster(orgId, fileId);
            const slots = await this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata);
            const extractionTriggered = await this.extractionJobs.queueExtractionJobs(orgId, fileId, slots, fileMetadata);
            const crossLayerLinksCreated = await this.crossLayerLinkService.createInitialCrossLayerLinks(orgId, fileId, slots);
            this.eventBus.emit('file.processed', {
                type: 'file.processed',
                orgId,
                fileId,
                clusterId,
                slots,
                extractionTriggered,
                eventType: 'created',
                timestamp: new Date().toISOString(),
                agent: 'file-steward-agent'
            });
        }
        else {
            if (this.shouldClassifyFile(fileMetadata.mimeType)) {
                await this.queueService.addJob('file-classification', 'classify-file', { orgId, fileId, filePath: resourcePath, sourceId, commitId, metadata: fileMetadata });
            }
            if (this.shouldExtractContent(fileMetadata.mimeType)) {
                await this.queueService.addJob('content-extraction', 'extract-content', { orgId, fileId, filePath: resourcePath, sourceId, commitId, metadata: fileMetadata });
            }
        }
    }
    async handleFileUpdated(orgId, sourceId, resourcePath, eventData, commitId) {
        const fileMetadata = this.handlers.extractFileMetadata(eventData);
        const existingFile = await this.filesRepo.getFileNode(orgId, sourceId, resourcePath);
        if (!existingFile) {
            await this.handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId);
            return;
        }
        await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);
        await this.filesRepo.updateFileNode(existingFile.id, {
            name: fileMetadata.name,
            size: fileMetadata.size,
            mimeType: fileMetadata.mimeType,
            checksum: fileMetadata.checksum || null,
            modified: fileMetadata.modified,
            metadataJson: JSON.stringify(fileMetadata.extra || {})
        });
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
    async handleFileDeleted(orgId, sourceId, resourcePath, eventData, commitId) {
        const existingFile = await this.filesRepo.getFileNode(orgId, sourceId, resourcePath);
        if (!existingFile) {
            this.logger.warn(`File not found for deletion: ${resourcePath}`);
            return;
        }
        await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);
        await this.filesRepo.softDeleteFileNode(existingFile.id);
        await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId);
    }
    async handleFolderCreated(orgId, sourceId, resourcePath, eventData, commitId) {
        await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);
    }
    async handleFolderUpdated(orgId, sourceId, resourcePath, eventData, commitId) {
        await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);
    }
    async handleFolderDeleted(orgId, sourceId, resourcePath, eventData, commitId) {
        await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId);
    }
    extractFileMetadata(eventData) { return this.handlers.extractFileMetadata(eventData); }
    async upsertFileNode(orgId, sourceId, resourcePath, metadata, _commitId) {
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
        });
    }
    async ensureFolderHierarchy(orgId, sourceId, filePath, _commitId) {
        await this.handlers.ensureFolderHierarchy(orgId, sourceId, filePath);
    }
    async upsertFolderNode(orgId, sourceId, path, name, _parentId, _commitId) {
        return this.foldersRepo.upsertFolderNode(orgId, sourceId, path, name);
    }
    async getFileNode(orgId, sourceId, path) { return this.filesRepo.getFileNode(orgId, sourceId, path); }
    async createEntityVersion(entityId, entityType, properties, commitId) {
        this.logger.debug(`Creating version for ${entityType} ${entityId}`, { commitId });
    }
    async updateFileNode(fileId, metadata, _commitId) {
        await this.filesRepo.updateFileNode(fileId, {
            name: metadata.name,
            size: metadata.size,
            mimeType: metadata.mimeType,
            checksum: metadata.checksum || null,
            modified: metadata.modified,
            metadataJson: JSON.stringify(metadata.extra || {})
        });
    }
    async softDeleteFileNode(fileId, _commitId) { await this.filesRepo.softDeleteFileNode(fileId); }
    async cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId) {
        this.logger.debug(`Cleaning up orphaned folders for path: ${resourcePath}`);
    }
    shouldClassifyFile(mimeType) {
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
    shouldExtractContent(mimeType) {
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
    hasSignificantChanges(oldMetadata, newMetadata) {
        if (oldMetadata.name !== newMetadata.name) {
            return true;
        }
        const sizeChange = Math.abs(oldMetadata.size - newMetadata.size) / oldMetadata.size;
        if (sizeChange > 0.1) {
            return true;
        }
        const modifiedTime = new Date(newMetadata.modified);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (modifiedTime > oneHourAgo) {
            return true;
        }
        return false;
    }
    inferMimeType(filename) { return (0, mime_1.inferMimeType)(filename); }
    async classifyFile(jobData) { await this.handlers.classifyFile(jobData); }
    async updateFileClassification(fileId, classification) {
        await this.classificationRepo.updateFileClassification(fileId, classification);
    }
    async extractContent(jobData) { await this.handlers.extractContent(jobData); }
    async updateFileContent(fileId, extractedContent) { await this.contentRepo.updateFileContent(fileId, extractedContent); }
    async processFileWithCluster(orgId, sourceId, fileId, resourcePath, fileMetadata, commitId) {
        this.logger.info(`Processing file with cluster-centric approach: ${resourcePath}`, { orgId, fileId });
        const clusterId = await this.clusterService.createContentCluster(orgId, fileId);
        const slots = await this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata);
        const extractionTriggered = await this.extractionJobs.queueExtractionJobs(orgId, fileId, slots, fileMetadata);
        const crossLayerLinksCreated = await this.crossLayerLinkService.createInitialCrossLayerLinks(orgId, fileId, slots);
        return { fileId, clusterId, slots, extractionTriggered, crossLayerLinksCreated };
    }
    async createContentCluster(orgId, fileId, _commitId) { return this.clusterService.createContentCluster(orgId, fileId); }
    async performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata) { return this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata); }
    async getApplicableTaxonomyRules(orgId, fileMetadata) {
        const result = await this.postgresService.query(`
      SELECT * FROM parser_registry 
      WHERE org_id = $1 
      AND (mime_type = $2 OR mime_type = '*/*')
      AND enabled = true
      ORDER BY min_confidence DESC
    `, [orgId, fileMetadata.mimeType]);
        return result.rows;
    }
    calculateRuleConfidence(rule, fileMetadata, resourcePath) {
        let confidence = 0.7;
        if (rule.mime_type === fileMetadata.mimeType) {
            confidence += 0.2;
        }
        const fileName = path_1.default.basename(resourcePath).toLowerCase();
        if (rule.slot === 'SCRIPT_PRIMARY' && (fileName.includes('script') || fileName.endsWith('.fdx'))) {
            confidence += 0.1;
        }
        if (rule.slot === 'BUDGET_MASTER' && fileMetadata.size > 100000) {
            confidence += 0.05;
        }
        return Math.min(confidence, 1.0);
    }
    async createSlotEdgeFact(fileId, slot, confidence, ruleId, orgId) {
        const edgeFactId = (0, uuid_1.v4)();
        const query = `
      MATCH (f:File {id: $fileId})
      CREATE (ef:EdgeFact {
        id: $edgeFactId,
        type: 'FILLS_SLOT',
        slot: $slot,
        confidence: $confidence,
        ruleId: $ruleId,
        method: 'taxonomy_rule',
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
    getFallbackSlot(mimeType) {
        const fallbackMap = {
            'application/pdf': 'DOCUMENT_GENERAL',
            'image/jpeg': 'MEDIA_IMAGE',
            'image/png': 'MEDIA_IMAGE',
            'video/mp4': 'MEDIA_VIDEO',
            'audio/mpeg': 'MEDIA_AUDIO',
            'text/plain': 'DOCUMENT_TEXT'
        };
        return fallbackMap[mimeType] || 'FILE_UNCLASSIFIED';
    }
    async queueExtractionJobs(orgId, fileId, slots, fileMetadata) { return this.extractionJobs.queueExtractionJobs(orgId, fileId, slots, { mimeType: fileMetadata.mimeType }); }
    async getApplicableParsers(orgId, slot, mimeType) {
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
    async createInitialCrossLayerLinks(orgId, fileId, slots) { return this.crossLayerLinkService.createInitialCrossLayerLinks(orgId, fileId, slots); }
    async getProjectScenes(orgId, fileId) {
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
    async getProjectPurchaseOrders(orgId, fileId) {
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
    async createCrossLayerLink(fromEntityId, toEntityId, relationshipType, orgId) {
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
    enableClusterMode() {
        this.clusterMode = true;
        this.logger.info('Cluster mode enabled for FileStewardAgent');
    }
    disableClusterMode() {
        this.clusterMode = false;
        this.logger.info('Cluster mode disabled for FileStewardAgent');
    }
    async processSyncEventWithCluster(eventData) {
        const { orgId, sourceId, resourcePath, eventData: fileEventData } = eventData;
        const commitId = (0, uuid_1.v4)();
        const fileMetadata = {
            name: fileEventData.name,
            size: fileEventData.size,
            mimeType: fileEventData.mimeType || this.inferMimeType(fileEventData.name),
            checksum: fileEventData.checksum,
            modified: fileEventData.modified,
            dbId: fileEventData.id,
            provider: fileEventData.provider,
            extra: fileEventData.extra || {}
        };
        await this.neo4jService.run(`
      MERGE (f:File {id: $fileId})
      ON CREATE SET f.orgId = $orgId,
                    f.path = $resourcePath,
                    f.name = $name,
                    f.mimeType = $mimeType,
                    f.current = true,
                    f.deleted = false,
                    f.createdAt = datetime(),
                    f.updatedAt = datetime()
      `, {
            fileId: fileEventData.id,
            orgId,
            resourcePath,
            name: fileMetadata.name,
            mimeType: fileMetadata.mimeType,
        });
        const result = await this.processFileWithCluster(orgId, sourceId, fileEventData.id, resourcePath, fileMetadata, commitId);
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
    getEventBus() {
        return this.eventBus;
    }
}
exports.FileStewardAgent = FileStewardAgent;
//# sourceMappingURL=FileStewardAgent.js.map