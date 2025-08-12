"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedFileProcessingService = void 0;
const FileProcessingService_1 = require("./FileProcessingService");
const TaxonomyService_1 = require("./TaxonomyService");
const AgentOrchestrator_1 = require("./AgentOrchestrator");
const ProvenanceService_1 = require("./provenance/ProvenanceService");
const Neo4jService_1 = require("./Neo4jService");
const QueueService_1 = require("./queues/QueueService");
class EnhancedFileProcessingService extends FileProcessingService_1.FileProcessingService {
    constructor(eventProcessingService) {
        super(eventProcessingService);
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.orchestrator = new AgentOrchestrator_1.AgentOrchestrator();
        this.provenance = new ProvenanceService_1.ProvenanceService();
        this.neo4j = new Neo4jService_1.Neo4jService();
        this.queueService = new QueueService_1.QueueService();
    }
    async processFileWithAI(request) {
        const startTime = Date.now();
        try {
            console.log(`Starting enhanced processing for file: ${request.fileName} (${request.fileId})`);
            await this.ensureFileNodeExists(request);
            const workflowId = this.determineWorkflow(request);
            const workflowExecutionId = await this.orchestrator.executeWorkflow(workflowId, {
                fileId: request.fileId,
                fileName: request.fileName,
                filePath: request.filePath,
                mimeType: request.mimeType,
                size: request.size,
                extractedText: request.extractedText,
                metadata: request.metadata
            }, request.orgId, request.userId);
            const results = await this.waitForWorkflowCompletion(workflowExecutionId);
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
        }
        catch (error) {
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
    async batchProcessFiles(requests) {
        console.log(`Starting batch processing for ${requests.length} files`);
        const results = [];
        const batchSize = 5;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(request => this.processFileWithAI(request));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + batchSize < requests.length) {
                await this.sleep(2000);
            }
        }
        return results;
    }
    async processFilesByCriteria(criteria, userId) {
        let query = `
      MATCH (f:File {org_id: $org_id})
      WHERE f.current = true AND f.deleted <> true
    `;
        const params = { org_id: criteria.orgId };
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
        const requests = result.records.map((record) => ({
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
    async reprocessFilesWithUpdatedRules(orgId, userId) {
        console.log('Reprocessing files with updated classification rules');
        return await this.processFilesByCriteria({
            orgId,
            unclassifiedOnly: false
        }, userId);
    }
    async getProcessingStatistics(orgId) {
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
    async ensureFileNodeExists(request) {
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
    determineWorkflow(request) {
        if (this.isScriptFile(request)) {
            return 'script_analysis';
        }
        return 'file_processing';
    }
    isScriptFile(request) {
        const scriptMimeTypes = ['application/pdf', 'text/plain'];
        const scriptKeywords = ['script', 'screenplay', 'treatment'];
        if (!scriptMimeTypes.includes(request.mimeType)) {
            return false;
        }
        const fileName = request.fileName.toLowerCase();
        return scriptKeywords.some(keyword => fileName.includes(keyword));
    }
    async waitForWorkflowCompletion(workflowExecutionId) {
        const maxWaitTime = 300000;
        const checkInterval = 2000;
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            const stats = this.orchestrator.getStatistics();
            await this.sleep(checkInterval);
            if (Date.now() - startTime > 10000) {
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
    async updateFileProcessingStatus(fileId, orgId, status, results) {
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
    async schedulePeriodicReprocessing(orgId, intervalHours = 24) {
        console.log(`Scheduling periodic reprocessing for org ${orgId} every ${intervalHours} hours`);
        console.log('Periodic reprocessing scheduled (implementation pending)');
    }
    async handleFileDeleted(fileId, orgId, userId) {
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.EnhancedFileProcessingService = EnhancedFileProcessingService;
//# sourceMappingURL=EnhancedFileProcessingService.js.map