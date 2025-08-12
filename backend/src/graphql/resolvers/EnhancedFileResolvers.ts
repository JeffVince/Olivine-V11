import { Neo4jService } from '../../services/Neo4jService';
import { PostgresService } from '../../services/PostgresService';
import { FileProcessingService } from '../../services/FileProcessingService';
import { EventProcessingService } from '../../services/EventProcessingService';
import { ClassificationService } from '../../services/classification/ClassificationService';
import { TaxonomyService } from '../../services/TaxonomyService';
import { QueueService } from '../../services/queues/QueueService';
import { TenantService } from '../../services/TenantService';
import winston from 'winston';

export interface FileFilter {
  orgId?: string;
  sourceId?: string;
  projectId?: string;
  classificationStatus?: string;
  mimeType?: string;
  path?: string;
  name?: string;
  sizeMin?: number;
  sizeMax?: number;
  modifiedAfter?: string;
  modifiedBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface FileSearchResults {
  results: Array<{
    file: any;
    score: number;
    highlights: string[];
  }>;
  totalCount: number;
  facets: any;
}

export class EnhancedFileResolvers {
  private neo4jService: Neo4jService;
  private postgresService: PostgresService;
  private fileProcessingService: FileProcessingService;
  private classificationService: ClassificationService;
  private queueService: QueueService;
  private tenantService: TenantService;
  private logger: winston.Logger;
  private taxonomyService: TaxonomyService;

  constructor() {
    this.neo4jService = new Neo4jService();
    this.postgresService = new PostgresService();
    // Create services with proper dependencies to break circular dependency
    const eventProcessingService = new EventProcessingService(null as any, new QueueService());
    this.fileProcessingService = new FileProcessingService(eventProcessingService);
    // Set the fileProcessingService dependency in eventProcessingService
    (eventProcessingService as any).fileProcessingService = this.fileProcessingService;
    this.classificationService = new ClassificationService(this.postgresService);
    this.queueService = new QueueService();
    this.tenantService = new TenantService();
    this.taxonomyService = new TaxonomyService();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.label({ label: 'enhanced-file-resolvers' })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Get a single file by ID with tenant validation
   */
  async getFile(id: string, orgId: string, context: any): Promise<any> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, orgId);
    
    this.logger.info(`Getting file ${id} for org ${orgId}`);
    
    // Query from Neo4j knowledge graph
    const query = `
      MATCH (f:File {id: $id, org_id: $orgId, current: true, deleted: false})
      OPTIONAL MATCH (s:Source {id: f.source_id, org_id: $orgId})
      OPTIONAL MATCH (p:Project {id: f.project_id, org_id: $orgId})
      OPTIONAL MATCH (parent:File {id: f.parent_id, org_id: $orgId})
      OPTIONAL MATCH (f)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})-[:TO]->(cs:CanonicalSlot)
      RETURN f, s, p, parent, cs
    `;

    const result = await this.neo4jService.run(query, { id, orgId });
    
    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const file = record.get('f').properties;
    const source = record.get('s')?.properties;
    const project = record.get('p')?.properties;
    const parent = record.get('parent')?.properties;
    const cs = record.get('cs')?.properties;

    return {
      id: file.id,
      orgId: file.org_id,
      sourceId: file.source_id,
      projectId: file.project_id,
      parentId: file.parent_id,
      path: file.path,
      name: file.name,
      size: file.size?.toNumber?.() || file.size,
      mimeType: file.mime_type,
      checksum: file.checksum,
      metadata: JSON.parse(file.metadata || '{}'),
      classificationStatus: file.classification_status || 'PENDING',
      classificationConfidence: file.classification_confidence?.toNumber?.() || file.classification_confidence,
      canonicalSlot: cs?.key || null,
      extractedText: file.extracted_text,
      current: file.current,
      deleted: file.deleted,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      modified: file.modified,
      // Relationships will be resolved by field resolvers
      source,
      project,
      parent
    };
  }

  /**
   * Get files with advanced filtering and pagination
   */
  async getFiles(filter: FileFilter = {}, limit: number = 50, offset: number = 0, context: any): Promise<any[]> {
    if (!filter.orgId) {
      throw new Error('Organization ID is required');
    }

    // Validate tenant access
    await this.tenantService.validateAccess(context.user, filter.orgId);

    this.logger.info(`Getting files for org ${filter.orgId}`, { filter, limit, offset });

    // Build dynamic query based on filter
    let whereConditions = ['f.org_id = $orgId', 'f.current = true', 'f.deleted = false'];
    const params: any = { orgId: filter.orgId };

    if (filter.sourceId) {
      whereConditions.push('f.source_id = $sourceId');
      params.sourceId = filter.sourceId;
    }

    if (filter.projectId) {
      whereConditions.push('f.project_id = $projectId');
      params.projectId = filter.projectId;
    }

    if (filter.classificationStatus) {
      whereConditions.push('f.classification_status = $classificationStatus');
      params.classificationStatus = filter.classificationStatus;
    }

    if (filter.mimeType) {
      whereConditions.push('f.mime_type = $mimeType');
      params.mimeType = filter.mimeType;
    }

    if (filter.path) {
      whereConditions.push('f.path CONTAINS $path');
      params.path = filter.path;
    }

    if (filter.name) {
      whereConditions.push('f.name CONTAINS $name');
      params.name = filter.name;
    }

    if (filter.sizeMin) {
      whereConditions.push('f.size >= $sizeMin');
      params.sizeMin = filter.sizeMin;
    }

    if (filter.sizeMax) {
      whereConditions.push('f.size <= $sizeMax');
      params.sizeMax = filter.sizeMax;
    }

    if (filter.modifiedAfter) {
      whereConditions.push('f.modified >= datetime($modifiedAfter)');
      params.modifiedAfter = filter.modifiedAfter;
    }

    if (filter.modifiedBefore) {
      whereConditions.push('f.modified <= datetime($modifiedBefore)');
      params.modifiedBefore = filter.modifiedBefore;
    }

    const query = `
      MATCH (f:File)
      WHERE ${whereConditions.join(' AND ')}
      OPTIONAL MATCH (s:Source {id: f.source_id, org_id: $orgId})
      OPTIONAL MATCH (p:Project {id: f.project_id, org_id: $orgId})
      OPTIONAL MATCH (f)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})-[:TO]->(cs:CanonicalSlot)
      RETURN f, s, p, cs
      ORDER BY f.updated_at DESC
      SKIP $offset
      LIMIT $limit
    `;

    params.offset = offset;
    params.limit = limit;

    const result = await this.neo4jService.run(query, params);
    
    return result.records.map((record: any) => {
      const file = record.get('f').properties;
      const source = record.get('s')?.properties;
      const project = record.get('p')?.properties;
      const cs = record.get('cs')?.properties;

      return {
        id: file.id,
        orgId: file.org_id,
        sourceId: file.source_id,
        projectId: file.project_id,
        parentId: file.parent_id,
        path: file.path,
        name: file.name,
        size: file.size?.toNumber?.() || file.size,
        mimeType: file.mime_type,
        checksum: file.checksum,
        metadata: JSON.parse(file.metadata || '{}'),
        classificationStatus: file.classification_status || 'PENDING',
        classificationConfidence: file.classification_confidence?.toNumber?.() || file.classification_confidence,
        canonicalSlot: cs?.key || null,
        extractedText: file.extracted_text,
        current: file.current,
        deleted: file.deleted,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
        modified: file.modified,
        source,
        project
      };
    });
  }

  /**
   * Advanced file search with full-text search and relevance scoring
   */
  async searchFiles(
    orgId: string, 
    query: string, 
    filters: FileFilter = {}, 
    limit: number = 20,
    context: any
  ): Promise<FileSearchResults> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, orgId);

    this.logger.info(`Searching files for org ${orgId}`, { query, filters, limit });

    // Use Neo4j full-text search
    const searchQuery = `
      CALL db.index.fulltext.queryNodes("file_content_search", $searchText)
      YIELD node, score
      WHERE node.org_id = $orgId AND node.current = true AND node.deleted = false
      ${this.buildSearchFilters(filters)}
      OPTIONAL MATCH (s:Source {id: node.source_id, org_id: $orgId})
      OPTIONAL MATCH (p:Project {id: node.project_id, org_id: $orgId})
      OPTIONAL MATCH (node)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})-[:TO]->(cs:CanonicalSlot)
      RETURN node as f, s, p, cs, score
      ORDER BY score DESC
      LIMIT $limit
    `;

    const searchParams = {
      searchText: query,
      orgId,
      limit,
      ...filters
    };

    const result = await this.neo4jService.run(searchQuery, searchParams);
    
    const results = result.records.map((record: any) => {
      const file = record.get('f').properties;
      const source = record.get('s')?.properties;
      const project = record.get('p')?.properties;
      const cs = record.get('cs')?.properties;
      const score = record.get('score');

      // Generate highlights based on search query
      const highlights = this.generateHighlights(file, query);

      return {
        file: {
          id: file.id,
          orgId: file.org_id,
          sourceId: file.source_id,
          projectId: file.project_id,
          path: file.path,
          name: file.name,
          size: file.size?.toNumber?.() || file.size,
          mimeType: file.mime_type,
          checksum: file.checksum,
          metadata: JSON.parse(file.metadata || '{}'),
          classificationStatus: file.classification_status || 'PENDING',
          classificationConfidence: file.classification_confidence?.toNumber?.() || file.classification_confidence,
          canonicalSlot: cs?.key || null,
          extractedText: file.extracted_text,
          current: file.current,
          deleted: file.deleted,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
          modified: file.modified,
          source,
          project
        },
        score,
        highlights
      };
    });

    // Get facet data for filtering
    const facets = await this.getFacetsForSearch(orgId, query, filters);

    return {
      results,
      totalCount: results.length, // In a real implementation, this would be a separate count query
      facets
    };
  }

  /**
   * Classify a file manually or trigger automatic classification
   */
  async classifyFile(input: any, context: any): Promise<any> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, input.orgId);

    this.logger.info(`Classifying file ${input.fileId}`, input);

    // Apply classification via provenance EdgeFact
    await this.taxonomyService.applyClassification(
      input.fileId,
      {
        slot: input.canonicalSlot,
        confidence: input.confidence || 1.0,
        method: 'manual',
        rule_id: undefined,
        metadata: input.metadata || {}
      },
      input.orgId,
      context.user.id
    );

    // Reflect status on File node (no convenience edges)
    const statusUpdate = `
      MATCH (f:File {id: $fileId, org_id: $orgId})
      SET f.classification_status = 'CLASSIFIED',
          f.classification_confidence = $confidence,
          f.classification_metadata = $metadata,
          f.updated_at = datetime()
      RETURN f
    `;
    await this.neo4jService.run(statusUpdate, {
      fileId: input.fileId,
      orgId: input.orgId,
      confidence: input.confidence || 1.0,
      metadata: JSON.stringify(input.metadata || {})
    });

    // Return updated file view
    return this.getFile(input.fileId, input.orgId, context);
  }

  /**
   * Trigger file reprocessing (classification and extraction)
   */
  async triggerFileReprocessing(fileId: string, orgId: string, context: any): Promise<boolean> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, orgId);

    this.logger.info(`Triggering reprocessing for file ${fileId}`);

    try {
      // Reset classification status
      const resetQuery = `
        MATCH (f:File {id: $fileId, org_id: $orgId})
        SET f.classification_status = 'PENDING',
            f.classification_confidence = 0,
            f.updated_at = datetime()
        RETURN f
      `;

      await this.neo4jService.run(resetQuery, { fileId, orgId });

      // Queue for reprocessing
      await this.queueService.addJob('file-classification', 'classify-file', {
        orgId,
        fileId,
        triggeredBy: context.user.id
      });

      await this.queueService.addJob('content-extraction', 'extract-content', {
        orgId,
        fileId,
        triggeredBy: context.user.id
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to trigger reprocessing for file ${fileId}:`, error);
      return false;
    }
  }

  /**
   * Bulk classify multiple files
   */
  async bulkClassifyFiles(fileIds: string[], orgId: string, context: any): Promise<any[]> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, orgId);

    this.logger.info(`Bulk classifying ${fileIds.length} files for org ${orgId}`);

    const results: any[] = [];

    for (const fileId of fileIds) {
      try {
        // Queue each file for classification
        await this.queueService.addJob('file-classification', 'classify-file', {
          orgId,
          fileId,
          triggeredBy: context.user.id,
          bulkOperation: true
        });

        const file = await this.getFile(fileId, orgId, context);
        if (file) {
          results.push(file);
        }
      } catch (error) {
        this.logger.error(`Failed to queue file ${fileId} for classification:`, error);
      }
    }

    return results;
  }

  /**
   * Get file statistics for organization
   */
  async getFileStats(orgId: string, context: any): Promise<any> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, orgId);

    this.logger.info(`Getting file stats for org ${orgId}`);

    const statsQuery = `
      MATCH (f:File {org_id: $orgId, current: true, deleted: false})
      OPTIONAL MATCH (s:Source {id: f.source_id, org_id: $orgId})
      OPTIONAL MATCH (p:Project {id: f.project_id, org_id: $orgId})
      RETURN 
        count(f) as total,
        collect(DISTINCT f.classification_status) as statuses,
        collect(DISTINCT f.mime_type) as mimeTypes,
        collect(DISTINCT s.name) as sources,
        collect(DISTINCT p.name) as projects,
        f.classification_status as status,
        f.mime_type as mimeType,
        s.name as sourceName,
        p.name as projectName
    `;

    const result = await this.neo4jService.run(statsQuery, { orgId });
    
    if (result.records.length === 0) {
      return {
        total: 0,
        byStatus: {},
        byMimeType: {},
        bySource: {},
        byProject: {}
      };
    }

    // This is a simplified version - in reality you'd want separate queries for each aggregation
    const record = result.records[0];
    
    return {
      total: record.get('total')?.toNumber?.() || record.get('total') || 0,
      byStatus: {}, // Would be calculated from actual data
      byMimeType: {}, // Would be calculated from actual data
      bySource: {}, // Would be calculated from actual data
      byProject: {} // Would be calculated from actual data
    };
  }

  /**
   * Get file versions from provenance system
   */
  async getFileVersions(fileId: string, orgId: string, context: any): Promise<any[]> {
    // Validate tenant access
    await this.tenantService.validateAccess(context.user, orgId);

    const versionsQuery = `
      MATCH (v:Version {org_id: $orgId, entity_id: $fileId, entity_type: 'File'})
      OPTIONAL MATCH (c:Commit {id: v.commit_id})
      RETURN v, c
      ORDER BY v.created_at DESC
    `;

    const result = await this.neo4jService.run(versionsQuery, { orgId, fileId });
    
    return result.records.map((record: any) => {
      const version = record.get('v').properties;
      const commit = record.get('c')?.properties;
      
      return {
        id: version.id,
        orgId: version.org_id,
        entityId: version.entity_id,
        entityType: version.entity_type,
        properties: JSON.parse(version.properties),
        commitId: version.commit_id,
        createdAt: version.created_at,
        contentHash: version.content_hash,
        metadata: JSON.parse(version.metadata || '{}'),
        commit: commit ? {
          id: commit.id,
          message: commit.message,
          author: commit.author,
          createdAt: commit.created_at
        } : null
      };
    });
  }

  /**
   * Build search filter conditions for Neo4j
   */
  private buildSearchFilters(filters: FileFilter): string {
    const conditions: string[] = [];
    
    if (filters.sourceId) {
      conditions.push('AND node.source_id = $sourceId');
    }
    
    if (filters.projectId) {
      conditions.push('AND node.project_id = $projectId');
    }
    
    if (filters.classificationStatus) {
      conditions.push('AND node.classification_status = $classificationStatus');
    }
    
    if (filters.mimeType) {
      conditions.push('AND node.mime_type = $mimeType');
    }

    return conditions.join(' ');
  }

  /**
   * Generate search result highlights
   */
  private generateHighlights(file: any, query: string): string[] {
    const highlights: string[] = [];
    const searchTerms = query.toLowerCase().split(' ');
    
    // Check filename highlights
    const fileName = (file.name || '').toLowerCase();
    for (const term of searchTerms) {
      if (fileName.includes(term)) {
        highlights.push(`Filename: ${file.name}`);
        break;
      }
    }
    
    // Check content highlights
    const extractedText = (file.extracted_text || '').toLowerCase();
    for (const term of searchTerms) {
      const index = extractedText.indexOf(term);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(extractedText.length, index + term.length + 50);
        const snippet = extractedText.substring(start, end);
        highlights.push(`Content: ...${snippet}...`);
        break;
      }
    }
    
    return highlights;
  }

  /**
   * Get faceted search data for filters
   */
  private async getFacetsForSearch(orgId: string, query: string, filters: FileFilter): Promise<any> {
    // This would typically run aggregation queries to get facet counts
    // For now, return a simple structure
    return {
      mimeTypes: {},
      sources: {},
      classificationStatus: {},
      fileSize: {}
    };
  }
}
