"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clusterResolvers = void 0;
const uuid_1 = require("uuid");
exports.clusterResolvers = {
    Query: {
        async getContentCluster(_, { clusterId, orgId }, context) {
            const clusterResult = await context.neo4jService.run(`
        MATCH (cc:ContentCluster {id: $clusterId, orgId: $orgId})
        OPTIONAL MATCH (cc)<-[:HAS_CLUSTER]-(f:File)
        RETURN cc, f.id as fileId, f.name as fileName
      `, { clusterId, orgId });
            if (clusterResult.records.length === 0) {
                return null;
            }
            const record = clusterResult.records[0];
            const cluster = record.get('cc').properties;
            const jobsResult = await context.postgresService.query(`
        SELECT ej.*, COUNT(eet.id) as entities_count, COUNT(elt.id) as links_count
        FROM extraction_job ej
        LEFT JOIN extracted_entity_temp eet ON ej.id = eet.job_id
        LEFT JOIN extracted_link_temp elt ON ej.id = elt.job_id
        WHERE ej.orgId = $1 AND ej.orgId = $2
        GROUP BY ej.id
        ORDER BY ej.created_at DESC
      `, [record.get('fileId'), orgId]);
            return {
                id: cluster.id,
                orgId: cluster.orgId,
                fileId: record.get('fileId'),
                fileName: record.get('fileName'),
                projectId: cluster.projectId,
                status: cluster.status,
                entitiesCount: cluster.entitiesCount || 0,
                linksCount: cluster.linksCount || 0,
                crossLayerLinksCount: cluster.crossLayerLinksCount || 0,
                extractionMethod: cluster.extractionMethod,
                confidence: cluster.confidence,
                createdAt: cluster.createdAt,
                updatedAt: cluster.updatedAt,
                extractionJobs: jobsResult.rows.map(job => ({
                    id: job.id,
                    status: job.status,
                    parserName: job.parser_name,
                    parserVersion: job.parser_version,
                    confidence: job.confidence,
                    entitiesCount: parseInt(job.entities_count) || 0,
                    linksCount: parseInt(job.links_count) || 0,
                    createdAt: job.created_at,
                    completedAt: job.completed_at,
                    metadata: job.metadata
                }))
            };
        },
        async getContentClusters(_, { orgId, fileId, projectId, limit = 50, offset = 0 }, context) {
            const conditions = ['cc.orgId = $orgId'];
            const cypherParams = { orgId, offset, limit };
            if (fileId) {
                conditions.push('f.id = $fileId');
                cypherParams.fileId = fileId;
            }
            if (projectId) {
                conditions.push('cc.projectId = $projectId');
                cypherParams.projectId = projectId;
            }
            const query = `
        MATCH (cc:ContentCluster)<-[:HAS_CLUSTER]-(f:File)
        WHERE ${conditions.join(' AND ')}
        RETURN cc, f.id as fileId, f.name as fileName
        ORDER BY cc.updatedAt DESC
        SKIP $offset LIMIT $limit
      `;
            const result = await context.neo4jService.run(query, cypherParams);
            return result.records.map(record => {
                const cluster = record.get('cc').properties;
                return {
                    id: cluster.id,
                    orgId: cluster.orgId,
                    fileId: record.get('fileId'),
                    fileName: record.get('fileName'),
                    projectId: cluster.projectId,
                    status: cluster.status,
                    entitiesCount: cluster.entitiesCount || 0,
                    linksCount: cluster.linksCount || 0,
                    crossLayerLinksCount: cluster.crossLayerLinksCount || 0,
                    extractionMethod: cluster.extractionMethod,
                    confidence: cluster.confidence,
                    createdAt: cluster.createdAt,
                    updatedAt: cluster.updatedAt
                };
            });
        },
        async getExtractionJob(_, { jobId, orgId }, context) {
            const jobResult = await context.postgresService.query(`
        SELECT ej.*, f.name as file_name
        FROM extraction_job ej
        JOIN files f ON ej.file_id = f.id
        WHERE ej.id = $1 AND ej.orgId = $2
      `, [jobId, orgId]);
            if (jobResult.rows.length === 0) {
                return null;
            }
            const job = jobResult.rows[0];
            const entitiesResult = await context.postgresService.query(`
        SELECT * FROM extracted_entity_temp WHERE job_id = $1 ORDER BY created_at
      `, [jobId]);
            const linksResult = await context.postgresService.query(`
        SELECT * FROM extracted_link_temp WHERE job_id = $1 ORDER BY created_at
      `, [jobId]);
            const auditResult = await context.postgresService.query(`
        SELECT * FROM promotion_audit WHERE job_id = $1 ORDER BY timestamp DESC
      `, [jobId]);
            return {
                id: job.id,
                orgId: job.orgId,
                fileId: job.file_id,
                fileName: job.file_name,
                projectId: job.project_id,
                status: job.status,
                parserName: job.parser_name,
                parserVersion: job.parser_version,
                method: job.method,
                confidence: job.confidence,
                createdAt: job.created_at,
                completedAt: job.completed_at,
                promotedAt: job.promoted_at,
                metadata: job.metadata,
                stagedEntities: entitiesResult.rows.map(entity => ({
                    id: entity.id,
                    kind: entity.kind,
                    data: entity.raw_json,
                    hash: entity.hash,
                    confidence: entity.confidence,
                    sourceOffset: entity.source_offset,
                    createdAt: entity.created_at
                })),
                stagedLinks: linksResult.rows.map(link => ({
                    id: link.id,
                    fromHash: link.from_hash,
                    toHash: link.to_hash,
                    relType: link.rel_type,
                    data: link.raw_json,
                    confidence: link.confidence,
                    createdAt: link.created_at
                })),
                auditTrail: auditResult.rows.map(audit => ({
                    id: audit.id,
                    actor: audit.actor,
                    action: audit.action,
                    beforeJson: audit.before_json,
                    afterJson: audit.after_json,
                    timestamp: audit.timestamp
                }))
            };
        },
        async getExtractionJobs(_, { orgId, fileId, status, limit = 50, offset = 0 }, context) {
            let whereClause = 'WHERE ej.orgId = $1';
            const params = [orgId];
            let paramIndex = 2;
            if (fileId) {
                whereClause += ` AND ej.file_id = $${paramIndex}`;
                params.push(fileId);
                paramIndex++;
            }
            if (status) {
                whereClause += ` AND ej.status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            const query = `
        SELECT ej.*, f.name as file_name,
               COUNT(DISTINCT eet.id) as entities_count,
               COUNT(DISTINCT elt.id) as links_count
        FROM extraction_job ej
        JOIN files f ON ej.file_id = f.id
        LEFT JOIN extracted_entity_temp eet ON ej.id = eet.job_id
        LEFT JOIN extracted_link_temp elt ON ej.id = elt.job_id
        ${whereClause}
        GROUP BY ej.id, f.name
        ORDER BY ej.created_at DESC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex}
      `;
            params.push(limit, offset);
            const result = await context.postgresService.query(query, params);
            return result.rows.map(job => ({
                id: job.id,
                orgId: job.orgId,
                fileId: job.file_id,
                fileName: job.file_name,
                projectId: job.project_id,
                status: job.status,
                parserName: job.parser_name,
                parserVersion: job.parser_version,
                method: job.method,
                confidence: job.confidence,
                entitiesCount: parseInt(job.entities_count) || 0,
                linksCount: parseInt(job.links_count) || 0,
                createdAt: job.created_at,
                completedAt: job.completed_at,
                promotedAt: job.promoted_at,
                metadata: job.metadata
            }));
        },
        async getParserRegistry(_, { orgId }, context) {
            const result = await context.postgresService.query(`
        SELECT * FROM parser_registry 
        WHERE orgId = $1 
        ORDER BY slot, parser_name, parser_version DESC
      `, [orgId]);
            return result.rows.map(parser => ({
                id: parser.id,
                orgId: parser.orgId,
                slot: parser.slot,
                mimeType: parser.mime_type,
                extension: parser.extension,
                parserName: parser.parser_name,
                parserVersion: parser.parser_version,
                minConfidence: parser.min_confidence,
                featureFlag: parser.feature_flag,
                enabled: parser.enabled,
                createdAt: parser.created_at,
                updatedAt: parser.updated_at
            }));
        }
    },
    Mutation: {
        async requestExtraction(_, { fileId, orgId, parserName, slot }, context) {
            const fileResult = await context.neo4jService.run(`
        MATCH (f:File {id: $fileId, orgId: $orgId})
        RETURN f
      `, { fileId, orgId });
            if (fileResult.records.length === 0) {
                throw new Error('File not found');
            }
            const file = fileResult.records[0].get('f').properties;
            let parsers;
            if (parserName) {
                parsers = await context.postgresService.query(`
          SELECT * FROM parser_registry 
          WHERE orgId = $1 AND parser_name = $2 AND enabled = true
        `, [orgId, parserName]);
            }
            else {
                parsers = await context.postgresService.query(`
          SELECT * FROM parser_registry 
          WHERE orgId = $1 
          AND (mime_type = $2 OR mime_type = '*/*')
          AND ($3::text IS NULL OR slot = $3)
          AND enabled = true
          ORDER BY min_confidence DESC
        `, [orgId, file.mime_type, slot]);
            }
            if (parsers.rows.length === 0) {
                throw new Error('No enabled parsers found for this file type');
            }
            const extractionJobs = [];
            for (const parser of parsers.rows) {
                const jobId = (0, uuid_1.v4)();
                const dedupeKey = `${fileId}-${parser.parser_name}-${parser.parser_version}-${file.checksum || 'no-checksum'}`;
                await context.postgresService.query(`
          INSERT INTO extraction_job (
            id, orgId, file_id, parser_name, parser_version, 
            method, dedupe_key, status, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', NOW())
          ON CONFLICT (dedupe_key) DO UPDATE SET
            status = 'queued',
            created_at = NOW()
          RETURNING id
        `, [jobId, orgId, fileId, parser.parser_name, parser.parser_version, 'rule-based', dedupeKey]);
                await context.queueService.addJob('content-extraction', 'extract-content', {
                    jobId,
                    orgId,
                    fileId,
                    slot: parser.slot,
                    parser: parser.parser_name,
                    parserVersion: parser.parser_version,
                    metadata: { mimeType: file.mime_type, size: file.size }
                });
                extractionJobs.push(jobId);
            }
            return {
                success: true,
                extractionJobs,
                message: `Queued ${extractionJobs.length} extraction job(s)`
            };
        },
        async promoteExtraction(_, { jobId, orgId, reviewNotes }, context) {
            const jobResult = await context.postgresService.query(`
        SELECT * FROM extraction_job 
        WHERE id = $1 AND orgId = $2 AND status = 'completed'
      `, [jobId, orgId]);
            if (jobResult.rows.length === 0) {
                throw new Error('Extraction job not found or not ready for promotion');
            }
            await context.queueService.addJob('content-promotion', 'promote-extraction', {
                jobId,
                orgId,
                actor: context.user?.id || 'unknown',
                autoPromoted: false,
                reviewNotes
            });
            return {
                success: true,
                message: 'Promotion queued successfully'
            };
        },
        async rollbackPromotion(_, { auditId, orgId, reason }, context) {
            const auditResult = await context.postgresService.query(`
        SELECT pa.*, ej.orgId 
        FROM promotion_audit pa
        JOIN extraction_job ej ON pa.job_id = ej.id
        WHERE pa.id = $1 AND ej.orgId = $2 AND pa.action = 'promote'
      `, [auditId, orgId]);
            if (auditResult.rows.length === 0) {
                throw new Error('Promotion audit record not found');
            }
            await context.queueService.addJob('content-rollback', 'rollback-promotion', {
                auditId,
                orgId,
                actor: context.user?.id || 'unknown',
                reason
            });
            return {
                success: true,
                message: 'Rollback queued successfully'
            };
        },
        async updateParserRegistry(_, { id, orgId, enabled, minConfidence, featureFlag }, context) {
            const updateFields = [];
            const values = [id, orgId];
            let paramIndex = 3;
            if (enabled !== undefined) {
                updateFields.push(`enabled = $${paramIndex}`);
                values.push(enabled);
                paramIndex++;
            }
            if (minConfidence !== undefined) {
                updateFields.push(`min_confidence = $${paramIndex}`);
                values.push(minConfidence);
                paramIndex++;
            }
            if (featureFlag !== undefined) {
                updateFields.push(`feature_flag = $${paramIndex}`);
                values.push(featureFlag);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }
            updateFields.push(`updated_at = NOW()`);
            const result = await context.postgresService.query(`
        UPDATE parser_registry 
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND orgId = $2
        RETURNING *
      `, values);
            if (result.rows.length === 0) {
                throw new Error('Parser registry entry not found');
            }
            const parser = result.rows[0];
            return {
                id: parser.id,
                orgId: parser.orgId,
                slot: parser.slot,
                mimeType: parser.mime_type,
                extension: parser.extension,
                parserName: parser.parser_name,
                parserVersion: parser.parser_version,
                minConfidence: parser.min_confidence,
                featureFlag: parser.feature_flag,
                enabled: parser.enabled,
                createdAt: parser.created_at,
                updatedAt: parser.updated_at
            };
        },
        async startClusterWorkflow(_, { workflowName, orgId, fileId, clusterId }, context) {
            const workflowId = await context.clusterOrchestrator.startWorkflow(workflowName, {
                orgId,
                fileId,
                clusterId,
                sessionId: (0, uuid_1.v4)(),
                metadata: { trigger: 'manual' }
            });
            return {
                success: true,
                workflowId,
                message: `Started workflow: ${workflowName}`
            };
        }
    }
};
exports.default = exports.clusterResolvers;
//# sourceMappingURL=clusterResolvers.js.map