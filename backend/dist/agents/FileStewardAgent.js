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
        const fileMetadata = this.extractFileMetadata(eventData);
        const fileId = await this.upsertFileNode(orgId, sourceId, resourcePath, fileMetadata, commitId);
        await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);
        if (this.clusterMode) {
            const clusterResult = await this.processFileWithCluster(orgId, sourceId, fileId, resourcePath, fileMetadata, commitId);
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
        }
        else {
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
    async handleFileUpdated(orgId, sourceId, resourcePath, eventData, commitId) {
        const fileMetadata = this.extractFileMetadata(eventData);
        const existingFile = await this.getFileNode(orgId, sourceId, resourcePath);
        if (!existingFile) {
            await this.handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId);
            return;
        }
        await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);
        await this.updateFileNode(existingFile.id, fileMetadata, commitId);
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
        const existingFile = await this.getFileNode(orgId, sourceId, resourcePath);
        if (!existingFile) {
            this.logger.warn(`File not found for deletion: ${resourcePath}`);
            return;
        }
        await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);
        await this.softDeleteFileNode(existingFile.id, commitId);
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
    extractFileMetadata(eventData) {
        if (eventData.entry) {
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
        }
        else if (eventData.file) {
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
        }
        else {
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
    async upsertFileNode(orgId, sourceId, resourcePath, metadata, commitId) {
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
    async ensureFolderHierarchy(orgId, sourceId, filePath, commitId) {
        const pathParts = filePath.split('/').filter(part => part.length > 0);
        pathParts.pop();
        let currentPath = '';
        let parentId = null;
        for (const folderName of pathParts) {
            currentPath += `/${folderName}`;
            const folderId = await this.upsertFolderNode(orgId, sourceId, currentPath, folderName, parentId, commitId);
            parentId = folderId;
        }
    }
    async upsertFolderNode(orgId, sourceId, path, name, parentId, commitId) {
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
    async getFileNode(orgId, sourceId, path) {
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
    async createEntityVersion(entityId, entityType, properties, commitId) {
        this.logger.debug(`Creating version for ${entityType} ${entityId}`, { commitId });
    }
    async updateFileNode(fileId, metadata, commitId) {
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
    async softDeleteFileNode(fileId, commitId) {
        const query = `
      MATCH (f:File {id: $fileId})
      SET f.deleted = true, f.current = false, f.end_date = datetime()
      RETURN f
    `;
        await this.neo4jService.run(query, { fileId });
    }
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
    inferMimeType(filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const mimeTypes = {
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
    async classifyFile(jobData) {
        const { orgId, fileId, filePath, metadata, fileContent } = jobData;
        this.logger.info(`Classifying file: ${filePath}`, { orgId, fileId });
        try {
            const classification = await this.classificationService.classify(orgId, {
                name: path_1.default.basename(filePath),
                path: filePath,
                mimeType: metadata?.mimeType,
                size: metadata?.size,
                extractedText: fileContent
            });
            const taxonomyClassification = {
                slot: classification.slotKey,
                confidence: classification.confidence,
                method: classification.method === 'taxonomy' ? 'rule_based' : 'ml_based',
                rule_id: classification.ruleId || undefined,
                metadata: {}
            };
            await this.taxonomyService.applyClassification(fileId, taxonomyClassification, orgId, 'system');
            await this.updateFileClassification(fileId, {
                status: 'classified',
                confidence: classification.confidence,
                metadata: { method: classification.method, ruleId: classification.ruleId, slotKey: classification.slotKey }
            });
            this.logger.info(`File classified successfully: ${filePath}`, { classification });
        }
        catch (error) {
            this.logger.error(`Failed to classify file: ${filePath}`, error);
            throw error;
        }
    }
    async updateFileClassification(fileId, classification) {
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
    async extractContent(jobData) {
        const { orgId, fileId, filePath, metadata } = jobData;
        this.logger.info(`Extracting content from file: ${filePath}`, { orgId, fileId });
        try {
            const extractedContent = await this.fileProcessingService.extractContent({
                orgId,
                sourceId: metadata.sourceId,
                path: filePath,
                mimeType: metadata.mimeType
            });
            const normalizedExtracted = typeof extractedContent === 'string'
                ? { text: extractedContent, metadata: {} }
                : extractedContent;
            await this.updateFileContent(fileId, normalizedExtracted);
            this.logger.info(`Content extracted successfully: ${filePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to extract content from file: ${filePath}`, error);
            throw error;
        }
    }
    async updateFileContent(fileId, extractedContent) {
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
    async processFileWithCluster(orgId, sourceId, fileId, resourcePath, fileMetadata, commitId) {
        this.logger.info(`Processing file with cluster-centric approach: ${resourcePath}`, { orgId, fileId });
        const clusterId = await this.createContentCluster(orgId, fileId, commitId);
        const slots = await this.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata);
        const extractionTriggered = await this.queueExtractionJobs(orgId, fileId, slots, fileMetadata);
        const crossLayerLinksCreated = await this.createInitialCrossLayerLinks(orgId, fileId, slots);
        return {
            fileId,
            clusterId,
            slots,
            extractionTriggered,
            crossLayerLinksCreated
        };
    }
    async createContentCluster(orgId, fileId, commitId) {
        const clusterId = (0, uuid_1.v4)();
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
        await this.postgresService.query(`
      INSERT INTO content_cluster (id, org_id, file_id, status, entities_count, links_count, created_at, updated_at)
      VALUES ($1, $2, $3, 'empty', 0, 0, NOW(), NOW())
    `, [clusterId, orgId, fileId]);
        this.logger.debug(`Created content cluster: ${clusterId}`, { fileId, orgId });
        return clusterId;
    }
    async performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata) {
        const slots = [];
        try {
            const rules = await this.getApplicableTaxonomyRules(orgId, fileMetadata);
            for (const rule of rules) {
                const confidence = this.calculateRuleConfidence(rule, fileMetadata, resourcePath);
                if (confidence >= rule.minConfidence) {
                    slots.push(rule.slot);
                    await this.createSlotEdgeFact(fileId, rule.slot, confidence, rule.id, orgId);
                }
            }
            if (slots.length === 0) {
                const fallbackSlot = this.getFallbackSlot(fileMetadata.mimeType);
                if (fallbackSlot) {
                    slots.push(fallbackSlot);
                    await this.createSlotEdgeFact(fileId, fallbackSlot, 0.5, 'fallback', orgId);
                }
            }
            this.logger.debug(`Multi-slot classification completed`, { fileId, slots });
            return slots;
        }
        catch (error) {
            this.logger.error(`Multi-slot classification failed`, { fileId, error });
            return [];
        }
    }
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
    async queueExtractionJobs(orgId, fileId, slots, fileMetadata) {
        let jobsQueued = false;
        for (const slot of slots) {
            const parsers = await this.getApplicableParsers(orgId, slot, fileMetadata.mimeType);
            for (const parser of parsers) {
                const jobId = (0, uuid_1.v4)();
                await this.postgresService.query(`
          INSERT INTO extraction_job (id, org_id, file_id, slot, parser_name, parser_version, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'queued', NOW())
        `, [jobId, orgId, fileId, slot, parser.parser_name, parser.parser_version]);
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
    async createInitialCrossLayerLinks(orgId, fileId, slots) {
        let linksCreated = 0;
        if (slots.includes('SCRIPT_PRIMARY')) {
            const projectScenes = await this.getProjectScenes(orgId, fileId);
            for (const scene of projectScenes) {
                await this.createCrossLayerLink(fileId, scene.id, 'SCRIPT_FOR', orgId);
                linksCreated++;
            }
        }
        if (slots.includes('BUDGET_MASTER')) {
            const projectPOs = await this.getProjectPurchaseOrders(orgId, fileId);
            for (const po of projectPOs) {
                await this.createCrossLayerLink(fileId, po.id, 'BUDGET_FOR', orgId);
                linksCreated++;
            }
        }
        return linksCreated;
    }
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