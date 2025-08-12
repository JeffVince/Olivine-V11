"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventProcessingService = void 0;
const bullmq_1 = require("bullmq");
const uuid_1 = require("uuid");
const QueueService_1 = require("./queues/QueueService");
const Neo4jService_1 = require("./Neo4jService");
const PostgresService_1 = require("./PostgresService");
const File_1 = require("../models/File");
const Source_1 = require("../models/Source");
const TaxonomyService_1 = require("./TaxonomyService");
class EventProcessingService {
    constructor(fileProcessingService) {
        this.agentStatus = new Map();
        this.retryAttempts = new Map();
        this.maxRetryAttempts = 3;
        this.queueService = new QueueService_1.QueueService();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.fileModel = new File_1.FileModel();
        this.sourceModel = new Source_1.SourceModel();
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.fileProcessingService = fileProcessingService;
        this.fileSyncQueue = new bullmq_1.Queue('file-sync', {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        });
        this.fileClassificationQueue = new bullmq_1.Queue('file-classification', {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        });
        this.contentExtractionQueue = new bullmq_1.Queue('content-extraction', {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        });
    }
    async addSyncJob(jobData, priority = 1) {
        const job = await this.fileSyncQueue.add('sync', jobData, { priority });
        return job.id;
    }
    async addClassificationJob(jobData, priority = 2) {
        const job = await this.fileClassificationQueue.add('classify', jobData, { priority });
        return job.id;
    }
    async addExtractionJob(jobData, priority = 3) {
        const job = await this.contentExtractionQueue.add('extract', jobData, { priority });
        return job.id;
    }
    async handleSyncEvent(job) {
        const { fileId, sourceId, orgId, action, filePath, metadata } = job.data;
        console.log(`Processing file sync event for ${fileId} with action ${action}`);
        try {
            switch (action) {
                case 'create':
                case 'update':
                    await this.syncFileToGraph(fileId, sourceId, orgId, filePath, metadata);
                    break;
                case 'delete':
                    await this.removeFileFromGraph(fileId, orgId);
                    break;
                default:
                    throw new Error(`Unknown sync action: ${action}`);
            }
            console.log(`Successfully processed sync event for ${fileId}`);
        }
        catch (error) {
            console.error(`Error processing sync event for ${fileId}:`, error);
            throw error;
        }
    }
    async classifyFile(job) {
        const { fileId, orgId, fileContent, mimeType } = job.data;
        console.log(`Classifying file ${fileId}`);
        try {
            const classificationResult = {
                type: this.determineFileType(mimeType),
                confidence: 0.95,
                categories: ['document'],
                tags: []
            };
            await this.fileModel.updateClassification(fileId, orgId, classificationResult, 'completed');
            const file = await this.fileModel.getFile(fileId, orgId);
            if (file) {
                await this.fileModel.syncToGraph(file);
            }
            console.log(`Successfully classified file ${fileId}`);
        }
        catch (error) {
            console.error(`Error classifying file ${fileId}:`, error);
            throw error;
        }
    }
    async extractContent(job) {
        const { fileId, orgId, fileContent, mimeType } = job.data;
        console.log(`Extracting content from file ${fileId}`);
        try {
            const extractedContent = this.extractTextContent(fileContent, mimeType);
            await this.fileModel.updateExtractedContent(fileId, orgId, extractedContent);
            const file = await this.fileModel.getFile(fileId, orgId);
            if (file) {
                await this.fileModel.syncToGraph(file);
            }
            console.log(`Successfully extracted content from file ${fileId}`);
        }
        catch (error) {
            console.error(`Error extracting content from file ${fileId}:`, error);
            throw error;
        }
    }
    async syncFileToGraph(fileId, sourceId, orgId, filePath, metadata) {
        console.log(`Syncing file ${fileId} to Neo4j graph`);
        try {
            const file = await this.fileModel.getFile(fileId, orgId);
            if (file) {
                await this.fileModel.syncToGraph(file);
                console.log(`Successfully synced file ${fileId} to Neo4j graph`);
            }
            else {
                console.warn(`File not found in PostgreSQL: ${fileId}`);
            }
        }
        catch (error) {
            console.error(`Error syncing file ${fileId} to graph:`, error);
            throw error;
        }
    }
    async removeFileFromGraph(fileId, orgId) {
        console.log(`Removing file ${fileId} from Neo4j graph`);
        try {
            await this.fileModel.removeFromGraph(fileId, orgId);
            console.log(`Successfully removed file ${fileId} from Neo4j graph`);
        }
        catch (error) {
            console.error(`Error removing file ${fileId} from graph:`, error);
            throw error;
        }
    }
    async updateFileClassificationInPostgres(fileId, orgId, classification) {
        const query = `
      UPDATE files 
      SET classification = $1, classification_confidence = $2
      WHERE id = $3 AND org_id = $4
    `;
        await this.postgresService.executeQuery(query, [
            JSON.stringify(classification),
            classification.confidence,
            fileId,
            orgId
        ]);
    }
    async updateFileClassificationInNeo4j(fileId, orgId, classification) {
        const session = this.neo4jService.getSession();
        try {
            const classificationQuery = `
        MATCH (f:File {id: $fileId, orgId: $orgId})
        SET f.classification = $classification,
            f.classificationConfidence = $confidence,
            f.updatedAt = timestamp()
      `;
            await session.run(classificationQuery, {
                fileId,
                orgId,
                classification: classification.type,
                confidence: classification.confidence
            });
        }
        finally {
            await session.close();
        }
    }
    async updateFileContentInPostgres(fileId, orgId, content) {
        const query = `
      UPDATE files 
      SET extracted_content = $1
      WHERE id = $2 AND org_id = $3
    `;
        await this.postgresService.executeQuery(query, [
            content,
            fileId,
            orgId
        ]);
    }
    async updateFileContentInNeo4j(fileId, orgId, content) {
        const session = this.neo4jService.getSession();
        try {
            const contentQuery = `
        MATCH (f:File {id: $fileId, orgId: $orgId})
        SET f.extractedContent = $content,
            f.updatedAt = timestamp()
      `;
            await session.run(contentQuery, {
                fileId,
                orgId,
                content
            });
        }
        finally {
            await session.close();
        }
    }
    determineFileType(mimeType) {
        if (mimeType.startsWith('image/')) {
            return 'image';
        }
        else if (mimeType.startsWith('video/')) {
            return 'video';
        }
        else if (mimeType.startsWith('audio/')) {
            return 'audio';
        }
        else if (mimeType === 'application/pdf') {
            return 'document';
        }
        else if (mimeType.startsWith('text/')) {
            return 'text';
        }
        else {
            return 'unknown';
        }
    }
    extractTextContent(fileContent, mimeType) {
        if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            return fileContent;
        }
        else {
            return `Extracted content from ${mimeType} file`;
        }
    }
    async startWorkers() {
        const syncWorker = new bullmq_1.Worker('file-sync', async (job) => {
            await this.handleSyncEvent(job);
        }, {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        });
        const classificationWorker = new bullmq_1.Worker('file-classification', async (job) => {
            await this.classifyFile(job);
        }, {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        });
        const extractionWorker = new bullmq_1.Worker('content-extraction', async (job) => {
            await this.extractContent(job);
        }, {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB || '0')
            }
        });
        syncWorker.on('error', (error) => {
            console.error('FileSync worker error:', error);
        });
        classificationWorker.on('error', (error) => {
            console.error('FileClassification worker error:', error);
        });
        extractionWorker.on('error', (error) => {
            console.error('ContentExtraction worker error:', error);
        });
        syncWorker.on('completed', (job) => {
            console.log(`FileSync job ${job.id} completed successfully`);
        });
        classificationWorker.on('completed', (job) => {
            console.log(`FileClassification job ${job.id} completed successfully`);
        });
        extractionWorker.on('completed', (job) => {
            console.log(`ContentExtraction job ${job.id} completed successfully`);
        });
        syncWorker.on('failed', (job, error) => {
            console.error(`FileSync job ${job?.id} failed:`, error);
        });
        classificationWorker.on('failed', (job, error) => {
            console.error(`FileClassification job ${job?.id} failed:`, error);
        });
        extractionWorker.on('failed', (job, error) => {
            console.error(`ContentExtraction job ${job?.id} failed:`, error);
        });
        console.log('All queue workers started successfully');
    }
    async close() {
        console.log('Closing EventProcessingService...');
        try {
            await Promise.all([
                this.fileSyncQueue.close(),
                this.fileClassificationQueue.close(),
                this.contentExtractionQueue.close()
            ]);
            await Promise.all([
                this.neo4jService.close(),
                this.postgresService.close(),
                this.queueService.close()
            ]);
            this.agentStatus.clear();
            this.retryAttempts.clear();
            console.log('EventProcessingService closed successfully');
        }
        catch (error) {
            console.error('Error closing EventProcessingService:', error);
            throw error;
        }
    }
    async createCommit(orgId, commitData) {
        const commitId = (0, uuid_1.v4)();
        const query = `
      CREATE (c:Commit {
        id: $commitId,
        orgId: $orgId,
        message: $message,
        author: $author,
        authorType: $authorType,
        timestamp: datetime(),
        metadata: $metadata
      })
      RETURN c.id as commitId
    `;
        await this.neo4jService.executeQuery(query, {
            commitId,
            orgId,
            message: commitData.message,
            author: commitData.author,
            authorType: commitData.authorType,
            metadata: JSON.stringify(commitData.metadata || {})
        });
        return commitId;
    }
    async createAction(commitId, actionData) {
        const actionId = (0, uuid_1.v4)();
        const query = `
      MATCH (c:Commit {id: $commitId})
      CREATE (a:Action {
        id: $actionId,
        actionType: $actionType,
        tool: $tool,
        entityType: $entityType,
        entityId: $entityId,
        inputs: $inputs,
        outputs: $outputs,
        status: $status,
        errorMessage: $errorMessage,
        executionTime: $executionTime,
        timestamp: datetime()
      })
      CREATE (c)-[:HAS_ACTION]->(a)
    `;
        await this.neo4jService.executeQuery(query, {
            commitId,
            actionId,
            actionType: actionData.actionType,
            tool: actionData.tool,
            entityType: actionData.entityType,
            entityId: actionData.entityId,
            inputs: JSON.stringify(actionData.inputs),
            outputs: JSON.stringify(actionData.outputs),
            status: actionData.status,
            errorMessage: actionData.errorMessage || null,
            executionTime: actionData.executionTime || 0
        });
    }
    async createEntityVersion(entityId, entityType, properties, commitId) {
        const versionId = (0, uuid_1.v4)();
        const query = `
      MATCH (c:Commit {id: $commitId})
      CREATE (v:EntityVersion {
        id: $versionId,
        entityId: $entityId,
        entityType: $entityType,
        properties: $properties,
        timestamp: datetime()
      })
      CREATE (c)-[:HAS_VERSION]->(v)
    `;
        await this.neo4jService.executeQuery(query, {
            commitId,
            versionId,
            entityId,
            entityType,
            properties: JSON.stringify(properties)
        });
    }
    async updateAgentStatus(agentType, orgId, status, executionTime, error) {
        const statusKey = `${orgId}:${agentType}`;
        let agentStatus = this.agentStatus.get(statusKey) || {
            agentType,
            orgId,
            status: 'idle',
            lastExecution: new Date().toISOString(),
            executionCount: 0,
            successCount: 0,
            errorCount: 0,
            averageExecutionTime: 0
        };
        agentStatus.executionCount++;
        agentStatus.lastExecution = new Date().toISOString();
        if (status === 'success') {
            agentStatus.status = 'idle';
            agentStatus.successCount++;
        }
        else {
            agentStatus.status = 'error';
            agentStatus.errorCount++;
            agentStatus.lastError = error;
        }
        agentStatus.averageExecutionTime = ((agentStatus.averageExecutionTime * (agentStatus.executionCount - 1)) + executionTime) / agentStatus.executionCount;
        this.agentStatus.set(statusKey, agentStatus);
    }
    async executeWithRetry(fn, jobId) {
        const attempts = this.retryAttempts.get(jobId) || 0;
        try {
            await fn();
            this.retryAttempts.delete(jobId);
        }
        catch (error) {
            if (attempts < this.maxRetryAttempts) {
                this.retryAttempts.set(jobId, attempts + 1);
                console.log(`Retrying job ${jobId}, attempt ${attempts + 1}/${this.maxRetryAttempts}`);
                const delay = Math.pow(2, attempts) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeWithRetry(fn, jobId);
            }
            else {
                this.retryAttempts.delete(jobId);
                throw error;
            }
        }
    }
    async handleSyncError(job, error) {
        const { fileId, orgId } = job.data;
        console.error(`Sync error for file ${fileId}:`, {
            error: error.message,
            stack: error.stack,
            jobData: job.data
        });
        const errorQuery = `
      INSERT INTO sync_errors (file_id, org_id, error_message, error_stack, job_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;
        try {
            await this.postgresService.executeQuery(errorQuery, [
                fileId,
                orgId,
                error.message,
                error.stack,
                JSON.stringify(job.data)
            ]);
        }
        catch (dbError) {
            console.error('Failed to store sync error:', dbError);
        }
    }
    extractFileName(filePath) {
        return filePath.split('/').pop() || filePath;
    }
    extractFileExtension(filePath) {
        const filename = this.extractFileName(filePath);
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1).toLowerCase() : '';
    }
    extractTags(content, filename) {
        const tags = new Set();
        const nameParts = filename.toLowerCase().split(/[._-]/);
        nameParts.forEach(part => {
            if (part.length > 2)
                tags.add(part);
        });
        if (content) {
            const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
            const wordCounts = words.reduce((acc, word) => {
                acc[word] = (acc[word] || 0) + 1;
                return acc;
            }, {});
            Object.entries(wordCounts)
                .filter(([word, count]) => count > 2)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .forEach(([word]) => tags.add(word));
        }
        return Array.from(tags).slice(0, 20);
    }
    async createFileRelationships(fileId, sourceId, orgId, filePath, commitId) {
        const query = `
      MATCH (f:File {id: $fileId, orgId: $orgId})
      MATCH (s:Source {id: $sourceId, orgId: $orgId})
      MATCH (c:Commit {id: $commitId})
      MERGE (f)-[:STORED_IN]->(s)
      MERGE (f)-[:CREATED_IN]->(c)
    `;
        await this.neo4jService.executeQuery(query, { fileId, sourceId, orgId, commitId });
    }
    async createClassificationRelationships(fileId, orgId, classification, commitId) {
        if (classification.type && classification.type !== 'UNCLASSIFIED') {
            const query = `
        MATCH (f:File {id: $fileId, orgId: $orgId})
        MERGE (c:Classification {type: $classificationType, orgId: $orgId})
        MERGE (f)-[:CLASSIFIED_AS {confidence: $confidence, method: $method, timestamp: datetime()}]->(c)
      `;
            await this.neo4jService.executeQuery(query, {
                fileId,
                orgId,
                classificationType: classification.type,
                confidence: classification.confidence,
                method: classification.method || 'unknown'
            });
        }
    }
    async createContentExtractionRelationships(fileId, orgId, content, metadata, commitId) {
        const query = `
      MATCH (f:File {id: $fileId, orgId: $orgId})
      CREATE (e:ExtractedContent {
        id: randomUUID(),
        fileId: $fileId,
        orgId: $orgId,
        contentLength: $contentLength,
        extractionMethod: $extractionMethod,
        extractedAt: datetime(),
        metadata: $metadata
      })
      CREATE (f)-[:HAS_EXTRACTED_CONTENT]->(e)
    `;
        await this.neo4jService.executeQuery(query, {
            fileId,
            orgId,
            contentLength: content.length,
            extractionMethod: metadata.method || 'basic',
            metadata: JSON.stringify(metadata)
        });
    }
    async ensureFolderHierarchy(orgId, sourceId, filePath, commitId) {
        const pathParts = filePath.split('/').filter(part => part.length > 0);
        pathParts.pop();
        if (pathParts.length === 0)
            return;
        let currentPath = '';
        let parentId = null;
        for (const folderName of pathParts) {
            currentPath += `/${folderName}`;
            const folderId = await this.upsertFolderNode(orgId, sourceId, currentPath, folderName, parentId, commitId);
            if (parentId) {
                await this.createFolderRelationship(parentId, folderId, 'CONTAINS', commitId);
            }
            parentId = folderId;
        }
    }
    async upsertFolderNode(orgId, sourceId, path, name, parentId, commitId) {
        const query = `
      MERGE (f:Folder {orgId: $orgId, sourceId: $sourceId, path: $path})
      ON CREATE SET f.id = randomUUID(), f.createdAt = datetime()
      SET f.name = $name, f.updatedAt = datetime()
      RETURN f.id as folderId
    `;
        const result = await this.neo4jService.executeQuery(query, {
            orgId, sourceId, path, name
        });
        return result.records[0].get('folderId');
    }
    async createFolderRelationship(parentId, childId, relType, commitId) {
        const query = `
      MATCH (parent {id: $parentId})
      MATCH (child {id: $childId})
      MERGE (parent)-[:${relType}]->(child)
    `;
        await this.neo4jService.executeQuery(query, { parentId, childId });
    }
    async cleanupOrphanedRelationships(fileId, orgId, commitId) {
        const query = `
      MATCH (f:File {id: $fileId, orgId: $orgId})
      OPTIONAL MATCH (f)-[r]-()
      DELETE r
    `;
        await this.neo4jService.executeQuery(query, { fileId, orgId });
    }
    reportWorkerError(workerName, error) {
        console.error(`Worker ${workerName} error reported:`, {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
    updateWorkerStats(workerName, status) {
        console.log(`Worker ${workerName} job ${status} at ${new Date().toISOString()}`);
    }
    handleJobFailure(job, error) {
        if (!job)
            return;
        console.error('Job failure details:', {
            jobId: job.id,
            jobName: job.name,
            jobData: job.data,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
    async performHealthCheck() {
        try {
            const [neo4jHealth, postgresHealth, redisHealth] = await Promise.all([
                this.neo4jService.healthCheck(),
                this.postgresService.healthCheck(),
                this.queueService.ping()
            ]);
            const healthStatus = {
                neo4j: neo4jHealth,
                postgres: postgresHealth,
                redis: redisHealth,
                timestamp: new Date().toISOString()
            };
            if (!neo4jHealth || !postgresHealth || !redisHealth) {
                console.warn('Health check failed:', healthStatus);
            }
        }
        catch (error) {
            console.error('Health check error:', error);
        }
    }
}
exports.EventProcessingService = EventProcessingService;
//# sourceMappingURL=EventProcessingService.js.map