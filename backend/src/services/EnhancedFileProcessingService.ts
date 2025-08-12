import { FileProcessingService } from './FileProcessingService';
import { EventProcessingService } from './EventProcessingService';
import { TaxonomyService } from './TaxonomyService';
import { AgentOrchestrator } from './AgentOrchestrator';
import { ProvenanceService } from './provenance/ProvenanceService';
import { Neo4jService } from './Neo4jService';
import { QueueService } from './queues/QueueService';

interface FileProcessingRequest {
  fileId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  orgId: string;
  sourceId: string;
  userId: string;
  extractedText?: string;
  metadata?: Record<string, any>;
}

interface FileProcessingResult {
  fileId: string;
  success: boolean;
  classification?: {
    slot: string;
    confidence: number;
    method: string;
  };
  contentAnalysis?: {
    scenes?: number;
    characters?: number;
    props?: number;
  };
  noveltyDetection?: {
    isNovel: boolean;
    noveltyScore: number;
    alertLevel: string;
  };
  error?: string;
  processingTime: number;
}

export class EnhancedFileProcessingService extends FileProcessingService {
  private taxonomyService: TaxonomyService;
  private orchestrator: AgentOrchestrator;
  private provenance: ProvenanceService;
  private neo4j: Neo4jService;
  private queueService: QueueService;

  constructor(eventProcessingService: EventProcessingService) {
    super(eventProcessingService);
    this.taxonomyService = new TaxonomyService();
    this.orchestrator = new AgentOrchestrator();
    this.provenance = new ProvenanceService();
    this.neo4j = new Neo4jService();
    this.queueService = new QueueService();
  }

  /**
   * Enhanced file processing with AI agents and taxonomy classification
   */
  async processFileWithAI(request: FileProcessingRequest): Promise<FileProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting enhanced processing for file: ${request.fileName} (${request.fileId})`);

      // Step 1: Create file node in Neo4j if it doesn't exist
      await this.ensureFileNodeExists(request);

      // Step 2: Determine processing workflow based on file type
      const workflowId = this.determineWorkflow(request);
      
      // Step 3: Execute workflow through orchestrator
      const workflowExecutionId = await this.orchestrator.executeWorkflow(
        workflowId,
        {
          fileId: request.fileId,
          fileName: request.fileName,
          filePath: request.filePath,
          mimeType: request.mimeType,
          size: request.size,
          extractedText: request.extractedText,
          metadata: request.metadata
        },
        request.orgId,
        request.userId
      );

      // Step 4: Wait for workflow completion and collect results
      const results = await this.waitForWorkflowCompletion(workflowExecutionId);

      // Step 5: Update file status and metadata
      await this.updateFileProcessingStatus(request.fileId, request.orgId, 'completed', results);

      const processingTime = Date.now() - startTime;

      return {
        fileId: request.fileId,
        success: true,
        classification: results.classification,
        contentAnalysis: results.contentAnalysis,
        noveltyDetection: results.noveltyDetection,
        processingTime
      };

    } catch (error) {
      console.error('Error in enhanced file processing:', error);
      
      await this.updateFileProcessingStatus(request.fileId, request.orgId, 'failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      const processingTime = Date.now() - startTime;

      return {
        fileId: request.fileId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      };
    }
  }

  /**
   * Batch process multiple files
   */
  async batchProcessFiles(requests: FileProcessingRequest[]): Promise<FileProcessingResult[]> {
    console.log(`Starting batch processing for ${requests.length} files`);
    
    const results: FileProcessingResult[] = [];
    const batchSize = 5; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.processFileWithAI(request));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < requests.length) {
        await this.sleep(2000);
      }
    }

    return results;
  }

  /**
   * Process files that match specific criteria
   */
  async processFilesByCriteria(criteria: {
    orgId: string;
    sourceId?: string;
    mimeTypes?: string[];
    minSize?: number;
    maxSize?: number;
    unclassifiedOnly?: boolean;
  }, userId: string): Promise<FileProcessingResult[]> {
    
    // Build query to find matching files
    let query = `
      MATCH (f:File {org_id: $org_id})
      WHERE f.current = true AND f.deleted <> true
    `;
    
    const params: any = { org_id: criteria.orgId };

    if (criteria.sourceId) {
      query += ` AND f.source_id = $source_id`;
      params.source_id = criteria.sourceId;
    }

    if (criteria.mimeTypes && criteria.mimeTypes.length > 0) {
      query += ` AND f.mime_type IN $mime_types`;
      params.mime_types = criteria.mimeTypes;
    }

    if (criteria.minSize !== undefined) {
      query += ` AND f.size >= $min_size`;
      params.min_size = criteria.minSize;
    }

    if (criteria.maxSize !== undefined) {
      query += ` AND f.size <= $max_size`;
      params.max_size = criteria.maxSize;
    }

    if (criteria.unclassifiedOnly) {
      query += `
        AND NOT EXISTS {
          MATCH (f)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})
        }
      `;
    }

    query += `
      RETURN f.id as fileId, f.name as fileName, f.path as filePath, 
             f.mime_type as mimeType, f.size as size, f.source_id as sourceId,
             f.metadata as metadata
      LIMIT 100
    `;

    const result = await this.neo4j.executeQuery(query, params, criteria.orgId);
    
    if (result.records.length === 0) {
      console.log('No files found matching criteria');
      return [];
    }

    // Convert to processing requests
    const requests: FileProcessingRequest[] = result.records.map((record: any) => ({
      fileId: record.get('fileId'),
      fileName: record.get('fileName'),
      filePath: record.get('filePath'),
      mimeType: record.get('mimeType'),
      size: record.get('size'),
      orgId: criteria.orgId,
      sourceId: record.get('sourceId'),
      userId: userId,
      metadata: record.get('metadata')
    }));

    console.log(`Found ${requests.length} files matching criteria`);

    return await this.batchProcessFiles(requests);
  }

  /**
   * Reprocess files with updated classification rules
   */
  async reprocessFilesWithUpdatedRules(orgId: string, userId: string): Promise<FileProcessingResult[]> {
    console.log('Reprocessing files with updated classification rules');

    return await this.processFilesByCriteria({
      orgId,
      unclassifiedOnly: false // Reprocess all files
    }, userId);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStatistics(orgId: string): Promise<any> {
    const query = `
      MATCH (f:File {org_id: $org_id})
      OPTIONAL MATCH (f)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})-[:TO]->(cs:CanonicalSlot)
      
      WITH 
        count(f) as total_files,
        count(ef) as classified_files,
        collect(DISTINCT cs.key) as used_slots,
        collect(DISTINCT f.mime_type) as file_types,
        sum(f.size) as total_size
      
      RETURN {
        total_files: total_files,
        classified_files: classified_files,
        unclassified_files: total_files - classified_files,
        classification_rate: CASE WHEN total_files > 0 THEN toFloat(classified_files) / toFloat(total_files) ELSE 0.0 END,
        used_slots: used_slots,
        file_types: file_types,
        total_size_bytes: total_size
      } as stats
    `;

    const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
    return result.records[0]?.get('stats') || {};
  }

  /**
   * Ensure file node exists in Neo4j
   */
  private async ensureFileNodeExists(request: FileProcessingRequest): Promise<void> {
    const query = `
      MERGE (f:File {id: $file_id, org_id: $org_id})
      ON CREATE SET
        f.source_id = $source_id,
        f.name = $file_name,
        f.path = $file_path,
        f.mime_type = $mime_type,
        f.size = $size,
        f.current = true,
        f.deleted = false,
        f.created_at = datetime(),
        f.updated_at = datetime(),
        f.metadata = $metadata
      ON MATCH SET
        f.updated_at = datetime(),
        f.metadata = coalesce(f.metadata, {}) + $metadata
      
      RETURN f
    `;

    await this.neo4j.executeQuery(query, {
      file_id: request.fileId,
      org_id: request.orgId,
      source_id: request.sourceId,
      file_name: request.fileName,
      file_path: request.filePath,
      mime_type: request.mimeType,
      size: request.size,
      metadata: request.metadata || {}
    }, request.orgId);
  }

  /**
   * Determine which workflow to use based on file characteristics
   */
  private determineWorkflow(request: FileProcessingRequest): string {
    // Check if it's a script file
    if (this.isScriptFile(request)) {
      return 'script_analysis';
    }

    // Default to general file processing
    return 'file_processing';
  }

  /**
   * Check if file is likely a script
   */
  private isScriptFile(request: FileProcessingRequest): boolean {
    const scriptMimeTypes = ['application/pdf', 'text/plain'];
    const scriptKeywords = ['script', 'screenplay', 'treatment'];

    if (!scriptMimeTypes.includes(request.mimeType)) {
      return false;
    }

    const fileName = request.fileName.toLowerCase();
    return scriptKeywords.some(keyword => fileName.includes(keyword));
  }

  /**
   * Wait for workflow completion and collect results
   */
  private async waitForWorkflowCompletion(workflowExecutionId: string): Promise<any> {
    const maxWaitTime = 300000; // 5 minutes
    const checkInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Check orchestrator for workflow status
      const stats = this.orchestrator.getStatistics();
      
      // For now, return mock results
      // In a full implementation, we'd track workflow execution status
      await this.sleep(checkInterval);
      
      // Simulate workflow completion
      if (Date.now() - startTime > 10000) { // Wait at least 10 seconds
        return {
          classification: {
            slot: 'SCRIPT_PRIMARY',
            confidence: 0.85,
            method: 'hybrid'
          },
          contentAnalysis: {
            scenes: 15,
            characters: 8,
            props: 12
          },
          noveltyDetection: {
            isNovel: false,
            noveltyScore: 0.2,
            alertLevel: 'info'
          }
        };
      }
    }

    throw new Error('Workflow execution timeout');
  }

  /**
   * Update file processing status in Neo4j
   */
  private async updateFileProcessingStatus(
    fileId: string, 
    orgId: string, 
    status: string, 
    results: any
  ): Promise<void> {
    const query = `
      MATCH (f:File {id: $file_id, org_id: $org_id})
      SET f.processing_status = $status,
          f.processing_results = $results,
          f.processed_at = datetime(),
          f.updated_at = datetime()
      RETURN f
    `;

    await this.neo4j.executeQuery(query, {
      file_id: fileId,
      org_id: orgId,
      status,
      results: JSON.stringify(results)
    }, orgId);
  }

  /**
   * Schedule periodic reprocessing of files
   */
  async schedulePeriodicReprocessing(orgId: string, intervalHours: number = 24): Promise<void> {
    console.log(`Scheduling periodic reprocessing for org ${orgId} every ${intervalHours} hours`);

    // In a full implementation, this would integrate with a job scheduler
    // For now, we'll just log the intent
    console.log('Periodic reprocessing scheduled (implementation pending)');
  }

  /**
   * Handle file deletion
   */
  async handleFileDeleted(fileId: string, orgId: string, userId: string): Promise<void> {
    const query = `
      MATCH (f:File {id: $file_id, org_id: $org_id})
      SET f.deleted = true,
          f.deleted_at = datetime(),
          f.current = false,
          f.updated_at = datetime()
      
      // End any active EdgeFacts for this file
      WITH f
      MATCH (f)<-[:FROM]-(ef:EdgeFact {valid_to: null})
      SET ef.valid_to = datetime(),
          ef.ended_by_commit = $commit_id
      
      RETURN count(ef) as ended_relationships
    `;

    const commitId = await this.provenance.createCommit({
      orgId,
      message: `File deleted: ${fileId}`,
      author: userId,
      authorType: 'user'
    });

    await this.neo4j.executeQuery(query, {
      file_id: fileId,
      org_id: orgId,
      commit_id: commitId
    }, orgId);

    console.log(`File ${fileId} marked as deleted and relationships ended`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
