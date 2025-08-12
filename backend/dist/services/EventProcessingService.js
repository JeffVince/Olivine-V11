"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventProcessingService = void 0;
const bullmq_1 = require("bullmq");
const QueueService_1 = require("./QueueService");
const Neo4jService_1 = require("./Neo4jService");
const PostgresService_1 = require("./PostgresService");
const File_1 = require("../models/File");
const Source_1 = require("../models/Source");
class EventProcessingService {
    constructor() {
        this.queueService = new QueueService_1.QueueService();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.fileModel = new File_1.FileModel();
        this.sourceModel = new Source_1.SourceModel();
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
        await this.fileSyncQueue.close();
        await this.fileClassificationQueue.close();
        await this.contentExtractionQueue.close();
    }
}
exports.EventProcessingService = EventProcessingService;
//# sourceMappingURL=EventProcessingService.js.map