"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedFileResolvers = void 0;
const Neo4jService_1 = require("../../services/Neo4jService");
const PostgresService_1 = require("../../services/PostgresService");
const FileProcessingService_1 = require("../../services/FileProcessingService");
const ClassificationService_1 = require("../../services/classification/ClassificationService");
const TaxonomyService_1 = require("../../services/TaxonomyService");
const QueueService_1 = require("../../services/queues/QueueService");
const TenantService_1 = require("../../services/TenantService");
const winston_1 = __importDefault(require("winston"));
class EnhancedFileResolvers {
    constructor() {
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.fileProcessingService = new FileProcessingService_1.FileProcessingService();
        this.classificationService = new ClassificationService_1.ClassificationService(this.postgresService);
        this.queueService = new QueueService_1.QueueService();
        this.tenantService = new TenantService_1.TenantService();
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.label({ label: 'enhanced-file-resolvers' })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
    }
    async getFile(id, orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        this.logger.info(`Getting file ${id} for org ${orgId}`);
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
            source,
            project,
            parent
        };
    }
    async getFiles(filter = {}, limit = 50, offset = 0, context) {
        if (!filter.orgId) {
            throw new Error('Organization ID is required');
        }
        await this.tenantService.validateAccess(context.user, filter.orgId);
        this.logger.info(`Getting files for org ${filter.orgId}`, { filter, limit, offset });
        let whereConditions = ['f.org_id = $orgId', 'f.current = true', 'f.deleted = false'];
        const params = { orgId: filter.orgId };
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
        return result.records.map((record) => {
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
    async searchFiles(orgId, query, filters = {}, limit = 20, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        this.logger.info(`Searching files for org ${orgId}`, { query, filters, limit });
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
        const results = result.records.map((record) => {
            const file = record.get('f').properties;
            const source = record.get('s')?.properties;
            const project = record.get('p')?.properties;
            const cs = record.get('cs')?.properties;
            const score = record.get('score');
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
        const facets = await this.getFacetsForSearch(orgId, query, filters);
        return {
            results,
            totalCount: results.length,
            facets
        };
    }
    async classifyFile(input, context) {
        await this.tenantService.validateAccess(context.user, input.orgId);
        this.logger.info(`Classifying file ${input.fileId}`, input);
        await this.taxonomyService.applyClassification(input.fileId, {
            slot: input.canonicalSlot,
            confidence: input.confidence || 1.0,
            method: 'manual',
            rule_id: undefined,
            metadata: input.metadata || {}
        }, input.orgId, context.user.id);
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
        return this.getFile(input.fileId, input.orgId, context);
    }
    async triggerFileReprocessing(fileId, orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        this.logger.info(`Triggering reprocessing for file ${fileId}`);
        try {
            const resetQuery = `
        MATCH (f:File {id: $fileId, org_id: $orgId})
        SET f.classification_status = 'PENDING',
            f.classification_confidence = 0,
            f.updated_at = datetime()
        RETURN f
      `;
            await this.neo4jService.run(resetQuery, { fileId, orgId });
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
        }
        catch (error) {
            this.logger.error(`Failed to trigger reprocessing for file ${fileId}:`, error);
            return false;
        }
    }
    async bulkClassifyFiles(fileIds, orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        this.logger.info(`Bulk classifying ${fileIds.length} files for org ${orgId}`);
        const results = [];
        for (const fileId of fileIds) {
            try {
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
            }
            catch (error) {
                this.logger.error(`Failed to queue file ${fileId} for classification:`, error);
            }
        }
        return results;
    }
    async getFileStats(orgId, context) {
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
        const record = result.records[0];
        return {
            total: record.get('total')?.toNumber?.() || record.get('total') || 0,
            byStatus: {},
            byMimeType: {},
            bySource: {},
            byProject: {}
        };
    }
    async getFileVersions(fileId, orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        const versionsQuery = `
      MATCH (v:Version {org_id: $orgId, entity_id: $fileId, entity_type: 'File'})
      OPTIONAL MATCH (c:Commit {id: v.commit_id})
      RETURN v, c
      ORDER BY v.created_at DESC
    `;
        const result = await this.neo4jService.run(versionsQuery, { orgId, fileId });
        return result.records.map((record) => {
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
    buildSearchFilters(filters) {
        const conditions = [];
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
    generateHighlights(file, query) {
        const highlights = [];
        const searchTerms = query.toLowerCase().split(' ');
        const fileName = (file.name || '').toLowerCase();
        for (const term of searchTerms) {
            if (fileName.includes(term)) {
                highlights.push(`Filename: ${file.name}`);
                break;
            }
        }
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
    async getFacetsForSearch(orgId, query, filters) {
        return {
            mimeTypes: {},
            sources: {},
            classificationStatus: {},
            fileSize: {}
        };
    }
}
exports.EnhancedFileResolvers = EnhancedFileResolvers;
//# sourceMappingURL=EnhancedFileResolvers.js.map