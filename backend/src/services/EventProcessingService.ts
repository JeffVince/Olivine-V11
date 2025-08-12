import { Queue, Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { QueueService } from './QueueService';
import { Neo4jService } from './Neo4jService';
import { PostgresService } from './PostgresService';
import { FileModel, FileClassification } from '../models/File';
import { SourceModel } from '../models/Source';

// Job data interfaces as specified in the implementation plan
interface SyncJobData {
  fileId: string;
  sourceId: string;
  orgId: string;
  action: 'create' | 'update' | 'delete';
  filePath: string;
  metadata: any;
}

interface ClassificationJobData {
  fileId: string;
  orgId: string;
  fileContent: string;
  mimeType: string;
}

interface ExtractionJobData {
  fileId: string;
  orgId: string;
  fileContent: string;
  mimeType: string;
}

export class EventProcessingService {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Event processing service implementation
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Queue service integration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend event processing tests
  private queueService: QueueService;
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private fileModel: FileModel;
  private sourceModel: SourceModel;
  
  // BullMQ queues as specified in the implementation plan
  private fileSyncQueue: Queue<SyncJobData>;
  private fileClassificationQueue: Queue<ClassificationJobData>;
  private contentExtractionQueue: Queue<ExtractionJobData>;

  constructor() {
    this.queueService = new QueueService();
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    this.fileModel = new FileModel();
    this.sourceModel = new SourceModel();
    
    // Initialize BullMQ queues with prioritization as specified in the plan
    this.fileSyncQueue = new Queue('file-sync', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });
    
    this.fileClassificationQueue = new Queue('file-classification', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });
    
    this.contentExtractionQueue = new Queue('content-extraction', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });
  }

  /**
   * Add a file sync job to the queue with prioritization
   * @param jobData Sync job data
   * @param priority Job priority (1 = highest, with sync events having higher priority than classification/extraction)
   * @returns Job ID
   */
  async addSyncJob(jobData: SyncJobData, priority: number = 1): Promise<string> {
    const job = await this.fileSyncQueue.add('sync', jobData, { priority });
    return job.id as string;
  }

  /**
   * Add a file classification job to the queue
   * @param jobData Classification job data
   * @param priority Job priority (2 = medium)
   * @returns Job ID
   */
  async addClassificationJob(jobData: ClassificationJobData, priority: number = 2): Promise<string> {
    const job = await this.fileClassificationQueue.add('classify', jobData, { priority });
    return job.id as string;
  }

  /**
   * Add a content extraction job to the queue
   * @param jobData Extraction job data
   * @param priority Job priority (3 = lowest)
   * @returns Job ID
   */
  async addExtractionJob(jobData: ExtractionJobData, priority: number = 3): Promise<string> {
    const job = await this.contentExtractionQueue.add('extract', jobData, { priority });
    return job.id as string;
  }

  /**
   * Process file sync events and update Neo4j graph
   * This implements the detailed logic described in the architecture plan
   */
  async handleSyncEvent(job: Job<SyncJobData>): Promise<void> {
    const { fileId, sourceId, orgId, action, filePath, metadata } = job.data;
    
    console.log(`Processing file sync event for ${fileId} with action ${action}`);
    
    try {
      switch (action) {
        case 'create':
        case 'update':
          // For create/update, we need to sync the file to Neo4j
          // This would involve creating/updating nodes and relationships in the graph
          await this.syncFileToGraph(fileId, sourceId, orgId, filePath, metadata);
          break;
          
        case 'delete':
          // For delete, we need to remove the file from Neo4j
          await this.removeFileFromGraph(fileId, orgId);
          break;
          
        default:
          throw new Error(`Unknown sync action: ${action}`);
      }
      
      console.log(`Successfully processed sync event for ${fileId}`);
    } catch (error) {
      console.error(`Error processing sync event for ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Classify a file using AI/ML models
   * This implements the detailed logic described in the architecture plan
   */
  async classifyFile(job: Job<ClassificationJobData>): Promise<void> {
    const { fileId, orgId, fileContent, mimeType } = job.data;
    
    console.log(`Classifying file ${fileId}`);
    
    try {
      // This is where we would implement the actual classification logic
      // For now, we'll just log that we're processing the classification
      // In a real implementation, this would involve:
      // 1. Loading appropriate AI/ML models
      // 2. Processing the file content based on MIME type
      // 3. Generating classification results
      // 4. Updating the file metadata in PostgreSQL and Neo4j
      
      // Placeholder for classification logic
      const classificationResult = {
        type: this.determineFileType(mimeType),
        confidence: 0.95,
        categories: ['document'],
        tags: []
      };
      
      // Update classification using FileModel (handles both PostgreSQL and Neo4j)
      await this.fileModel.updateClassification(fileId, orgId, classificationResult, 'completed');
      
      // Re-sync to Neo4j to update the graph with classification data
      const file = await this.fileModel.getFile(fileId, orgId);
      if (file) {
        await this.fileModel.syncToGraph(file);
      }
      
      console.log(`Successfully classified file ${fileId}`);
    } catch (error) {
      console.error(`Error classifying file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Extract content from a file
   * This implements the detailed logic described in the architecture plan
   */
  async extractContent(job: Job<ExtractionJobData>): Promise<void> {
    const { fileId, orgId, fileContent, mimeType } = job.data;
    
    console.log(`Extracting content from file ${fileId}`);
    
    try {
      // This is where we would implement the actual content extraction logic
      // For now, we'll just log that we're processing the extraction
      // In a real implementation, this would involve:
      // 1. Selecting appropriate extraction method based on MIME type
      // 2. Extracting text, metadata, or other content from the file
      // 3. Storing extracted content in PostgreSQL and Neo4j
      
      // Placeholder for content extraction logic
      const extractedContent = this.extractTextContent(fileContent, mimeType);
      
      // Store extracted content using FileModel
      await this.fileModel.updateExtractedContent(fileId, orgId, extractedContent);
      
      // Re-sync to Neo4j to update the graph with extracted content
      const file = await this.fileModel.getFile(fileId, orgId);
      if (file) {
        await this.fileModel.syncToGraph(file);
      }
      
      console.log(`Successfully extracted content from file ${fileId}`);
    } catch (error) {
      console.error(`Error extracting content from file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Sync file to Neo4j graph using FileModel
   */
  private async syncFileToGraph(fileId: string, sourceId: string, orgId: string, filePath: string, metadata: any): Promise<void> {
    console.log(`Syncing file ${fileId} to Neo4j graph`);
    
    try {
      // Get the file from PostgreSQL first
      const file = await this.fileModel.getFile(fileId, orgId);
      if (file) {
        // Sync to Neo4j using the FileModel
        await this.fileModel.syncToGraph(file);
        console.log(`Successfully synced file ${fileId} to Neo4j graph`);
      } else {
        console.warn(`File not found in PostgreSQL: ${fileId}`);
      }
    } catch (error) {
      console.error(`Error syncing file ${fileId} to graph:`, error);
      throw error;
    }
  }

  /**
   * Remove file from Neo4j graph using FileModel
   */
  private async removeFileFromGraph(fileId: string, orgId: string): Promise<void> {
    console.log(`Removing file ${fileId} from Neo4j graph`);
    
    try {
      await this.fileModel.removeFromGraph(fileId, orgId);
      console.log(`Successfully removed file ${fileId} from Neo4j graph`);
    } catch (error) {
      console.error(`Error removing file ${fileId} from graph:`, error);
      throw error;
    }
  }

  /**
   * Update file classification in PostgreSQL
   */
  private async updateFileClassificationInPostgres(fileId: string, orgId: string, classification: any): Promise<void> {
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

  /**
   * Update file classification in Neo4j
   */
  private async updateFileClassificationInNeo4j(fileId: string, orgId: string, classification: any): Promise<void> {
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
    } finally {
      await session.close();
    }
  }

  /**
   * Update extracted file content in PostgreSQL
   */
  private async updateFileContentInPostgres(fileId: string, orgId: string, content: string): Promise<void> {
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

  /**
   * Update extracted file content in Neo4j
   */
  private async updateFileContentInNeo4j(fileId: string, orgId: string, content: string): Promise<void> {
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
    } finally {
      await session.close();
    }
  }

  /**
   * Determine file type based on MIME type
   */
  private determineFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType === 'application/pdf') {
      return 'document';
    } else if (mimeType.startsWith('text/')) {
      return 'text';
    } else {
      return 'unknown';
    }
  }

  /**
   * Extract text content from file based on MIME type
   */
  private extractTextContent(fileContent: string, mimeType: string): string {
    // In a real implementation, this would use appropriate libraries for different file types
    // For now, we'll just return the content as-is for text-based files
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return fileContent;
    } else {
      // Placeholder for other file types - would use libraries like pdf-parse, etc.
      return `Extracted content from ${mimeType} file`;
    }
  }

  /**
   * Start all queue workers
   */
  async startWorkers(): Promise<void> {
    // Create workers for each queue as specified in the implementation plan
    const syncWorker = new Worker('file-sync', async (job: Job<SyncJobData>) => {
      await this.handleSyncEvent(job);
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });
    
    const classificationWorker = new Worker('file-classification', async (job: Job<ClassificationJobData>) => {
      await this.classifyFile(job);
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });
    
    const extractionWorker = new Worker('content-extraction', async (job: Job<ExtractionJobData>) => {
      await this.extractContent(job);
    }, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });
    
    // Handle worker errors
    syncWorker.on('error', (error) => {
      console.error('FileSync worker error:', error);
    });
    
    classificationWorker.on('error', (error) => {
      console.error('FileClassification worker error:', error);
    });
    
    extractionWorker.on('error', (error) => {
      console.error('ContentExtraction worker error:', error);
    });
    
    // Handle job completion
    syncWorker.on('completed', (job) => {
      console.log(`FileSync job ${job.id} completed successfully`);
    });
    
    classificationWorker.on('completed', (job) => {
      console.log(`FileClassification job ${job.id} completed successfully`);
    });
    
    extractionWorker.on('completed', (job) => {
      console.log(`ContentExtraction job ${job.id} completed successfully`);
    });
    
    // Handle job failures
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

  /**
   * Close all queue connections
   */
  async close(): Promise<void> {
    await this.fileSyncQueue.close();
    await this.fileClassificationQueue.close();
    await this.contentExtractionQueue.close();
  }
}
