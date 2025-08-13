"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionService = void 0;
const BaseService_1 = require("../BaseService");
const uuid_1 = require("uuid");
class PromotionService extends BaseService_1.BaseService {
    constructor(postgresService, neo4jService, queueService) {
        super('PromotionService');
        this.postgresService = postgresService;
        this.neo4jService = neo4jService;
        this.queueService = queueService;
    }
    async processPromotionJob(jobData) {
        const { jobId, orgId, actor, autoPromoted = false, reviewNotes } = jobData;
        this.logger.info(`Processing promotion job: ${jobId}`, { orgId, actor, autoPromoted });
        try {
            const jobDetails = await this.getExtractionJobDetails(jobId);
            if (!jobDetails) {
                throw new Error(`Extraction job not found: ${jobId}`);
            }
            const stagedEntities = await this.getStagedEntities(jobId);
            const stagedLinks = await this.getStagedLinks(jobId);
            await this.validatePromotionRules(orgId, stagedEntities, stagedLinks);
            const session = this.neo4jService.getSession();
            const transaction = session.beginTransaction();
            try {
                const commitId = (0, uuid_1.v4)();
                await this.createCommitRecord(transaction, commitId, orgId, actor, 'promotion', {
                    jobId,
                    entitiesCount: stagedEntities.length,
                    linksCount: stagedLinks.length,
                    autoPromoted,
                    reviewNotes
                });
                const entityMapping = await this.promoteEntities(transaction, stagedEntities, commitId, orgId);
                const relationshipsCreated = await this.promoteLinks(transaction, stagedLinks, entityMapping, commitId, orgId);
                await this.updateContentClusterStats(transaction, jobDetails.file_id, stagedEntities.length, relationshipsCreated);
                await transaction.commit();
                const auditId = await this.createPromotionAudit(jobId, actor, 'promote', {
                    stagedEntities: stagedEntities.length,
                    stagedLinks: stagedLinks.length
                }, {
                    nodesCreated: Object.keys(entityMapping).length,
                    relationshipsCreated,
                    commitId
                });
                await this.updateExtractionJobStatus(jobId, 'promoted', {
                    promotedAt: new Date().toISOString(),
                    promotedBy: actor,
                    auditId
                });
                if (process.env.CLEANUP_STAGING_ON_PROMOTION === 'true') {
                    await this.cleanupStagingData(jobId);
                }
                const result = {
                    nodesCreated: Object.keys(entityMapping).length,
                    relationshipsCreated,
                    commitId,
                    auditId
                };
                this.logger.info(`Promotion completed: ${jobId}`, result);
                return result;
            }
            catch (error) {
                await transaction.rollback();
                throw error;
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Promotion failed: ${jobId}`, { error: message });
            await this.updateExtractionJobStatus(jobId, 'promotion_failed', { error: message });
            throw error;
        }
    }
    async processRollbackJob(jobData) {
        const { auditId, orgId, actor, reason } = jobData;
        this.logger.info(`Processing rollback job: ${auditId}`, { orgId, actor, reason });
        try {
            const auditDetails = await this.getPromotionAuditDetails(auditId);
            if (!auditDetails) {
                throw new Error(`Promotion audit not found: ${auditId}`);
            }
            const rollbackOps = await this.getRollbackOperations(auditId);
            const session = this.neo4jService.getSession();
            const transaction = session.beginTransaction();
            try {
                const commitId = (0, uuid_1.v4)();
                await this.createCommitRecord(transaction, commitId, orgId, actor, 'rollback', {
                    originalAuditId: auditId,
                    reason,
                    rollbackOpsCount: rollbackOps.length
                });
                let nodesRemoved = 0;
                let relationshipsRemoved = 0;
                for (const op of rollbackOps) {
                    if (op.type === 'node_created') {
                        await this.removeNode(transaction, op.nodeId);
                        nodesRemoved++;
                    }
                    else if (op.type === 'relationship_created') {
                        await this.removeRelationship(transaction, op.relationshipId);
                        relationshipsRemoved++;
                    }
                }
                const fileId = auditDetails.after_json?.fileId;
                if (fileId) {
                    await this.updateContentClusterStats(transaction, fileId, -nodesRemoved, -relationshipsRemoved);
                }
                await transaction.commit();
                await this.createPromotionAudit(auditDetails.job_id, actor, 'rollback', {
                    originalAuditId: auditId,
                    reason
                }, {
                    nodesRemoved,
                    relationshipsRemoved,
                    commitId
                });
                await this.updateExtractionJobStatus(auditDetails.job_id, 'rolled_back', {
                    rolledBackAt: new Date().toISOString(),
                    rolledBackBy: actor,
                    rollbackReason: reason
                });
                const result = {
                    nodesRemoved,
                    relationshipsRemoved,
                    commitId
                };
                this.logger.info(`Rollback completed: ${auditId}`, result);
                return result;
            }
            catch (error) {
                await transaction.rollback();
                throw error;
            }
            finally {
                await session.close();
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Rollback failed: ${auditId}`, { error: message });
            throw error;
        }
    }
    async getExtractionJobDetails(jobId) {
        const result = await this.postgresService.query(`
      SELECT * FROM extraction_job WHERE id = $1
    `, [jobId]);
        return result.rows[0];
    }
    async getStagedEntities(jobId) {
        const result = await this.postgresService.query(`
      SELECT * FROM extracted_entity_temp 
      WHERE job_id = $1 
      ORDER BY created_at
    `, [jobId]);
        return result.rows;
    }
    async getStagedLinks(jobId) {
        const result = await this.postgresService.query(`
      SELECT * FROM extracted_link_temp 
      WHERE job_id = $1 
      ORDER BY created_at
    `, [jobId]);
        return result.rows;
    }
    async validatePromotionRules(orgId, entities, links) {
        const entityGroups = new Map();
        for (const entity of entities) {
            const key = `${entity.kind}:${JSON.stringify(entity.raw_json)}`;
            if (!entityGroups.has(key)) {
                entityGroups.set(key, []);
            }
            entityGroups.get(key).push(entity);
        }
        for (const [key, group] of entityGroups) {
            if (group.length > 1) {
                this.logger.warn(`Duplicate entities detected for promotion`, { key, count: group.length });
            }
            const [kind, dataStr] = key.split(':');
            const data = JSON.parse(dataStr);
            if (kind === 'Scene' && data.number) {
                const existing = await this.neo4jService.run(`
          MATCH (s:Scene {org_id: $orgId, number: $number})
          RETURN s.id as id
        `, { orgId, number: data.number });
                if (existing.records.length > 0) {
                    throw new Error(`Scene ${data.number} already exists in project`);
                }
            }
        }
        for (const link of links) {
            await this.validateCrossLayerLink(orgId, link);
        }
    }
    async validateCrossLayerLink(orgId, link) {
        const allowedCrossLayerRels = [
            'SCHEDULED_ON',
            'PORTRAYED_BY',
            'HAS_LOCATION',
            'FOR_SCENE',
            'FOR_CREW'
        ];
        if (!allowedCrossLayerRels.includes(link.rel_type)) {
            this.logger.warn(`Unknown cross-layer relationship type: ${link.rel_type}`);
        }
    }
    async promoteEntities(transaction, entities, commitId, orgId) {
        const entityMapping = {};
        for (const entity of entities) {
            const nodeId = (0, uuid_1.v4)();
            const data = entity.raw_json;
            const nodeProps = {
                id: nodeId,
                org_id: orgId,
                ...data,
                created_at: new Date().toISOString(),
                created_by: 'extraction-system',
                commit_id: commitId,
                extraction_confidence: entity.confidence,
                extraction_source_offset: entity.source_offset
            };
            const query = `
        CREATE (n:${entity.kind} $props)
        RETURN n.id as nodeId
      `;
            await transaction.run(query, { props: nodeProps });
            entityMapping[entity.hash] = nodeId;
            this.logger.debug(`Promoted entity to graph`, {
                kind: entity.kind,
                nodeId,
                hash: entity.hash
            });
        }
        return entityMapping;
    }
    async promoteLinks(transaction, links, entityMapping, commitId, orgId) {
        let relationshipsCreated = 0;
        for (const link of links) {
            const fromNodeId = entityMapping[link.from_hash];
            const toNodeId = entityMapping[link.to_hash];
            if (!fromNodeId || !toNodeId) {
                this.logger.warn(`Skipping link - missing entity mapping`, {
                    fromHash: link.from_hash,
                    toHash: link.to_hash
                });
                continue;
            }
            const relProps = {
                org_id: orgId,
                created_at: new Date().toISOString(),
                created_by: 'extraction-system',
                commit_id: commitId,
                extraction_confidence: link.confidence,
                ...link.raw_json
            };
            const query = `
        MATCH (from {id: $fromNodeId}), (to {id: $toNodeId})
        CREATE (from)-[r:${link.rel_type} $props]->(to)
        RETURN id(r) as relId
      `;
            await transaction.run(query, {
                fromNodeId,
                toNodeId,
                props: relProps
            });
            relationshipsCreated++;
        }
        return relationshipsCreated;
    }
    async updateContentClusterStats(transaction, fileId, entitiesDelta, linksDelta) {
        const query = `
      MATCH (f:File {id: $fileId})-[:HAS_CLUSTER]->(cc:ContentCluster)
      SET 
        cc.entitiesCount = cc.entitiesCount + $entitiesDelta,
        cc.linksCount = cc.linksCount + $linksDelta,
        cc.updatedAt = datetime(),
        cc.status = CASE 
          WHEN cc.entitiesCount + $entitiesDelta > 0 THEN 'populated'
          ELSE 'empty'
        END
      RETURN cc.id as clusterId
    `;
        await transaction.run(query, { fileId, entitiesDelta, linksDelta });
        await this.postgresService.query(`
      UPDATE content_cluster 
      SET 
        entities_count = entities_count + $1,
        links_count = links_count + $2,
        updated_at = NOW(),
        status = CASE 
          WHEN entities_count + $1 > 0 THEN 'populated'
          ELSE 'empty'
        END
      WHERE file_id = $3
    `, [entitiesDelta, linksDelta, fileId]);
    }
    async createCommitRecord(transaction, commitId, orgId, actor, action, metadata) {
        const query = `
      CREATE (c:Commit {
        id: $commitId,
        org_id: $orgId,
        actor: $actor,
        action: $action,
        timestamp: datetime(),
        metadata: $metadata
      })
      RETURN c.id as commitId
    `;
        await transaction.run(query, {
            commitId,
            orgId,
            actor,
            action,
            metadata: JSON.stringify(metadata)
        });
    }
    async createPromotionAudit(jobId, actor, action, beforeJson, afterJson) {
        const auditId = (0, uuid_1.v4)();
        await this.postgresService.query(`
      INSERT INTO promotion_audit (id, job_id, actor, action, before_json, after_json, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [auditId, jobId, actor, action, JSON.stringify(beforeJson), JSON.stringify(afterJson)]);
        return auditId;
    }
    async updateExtractionJobStatus(jobId, status, metadata) {
        await this.postgresService.query(`
      UPDATE extraction_job 
      SET status = $2, metadata = metadata || $3
      WHERE id = $1
    `, [jobId, status, JSON.stringify(metadata)]);
    }
    async getPromotionAuditDetails(auditId) {
        const result = await this.postgresService.query(`
      SELECT * FROM promotion_audit WHERE id = $1
    `, [auditId]);
        return result.rows[0];
    }
    async getRollbackOperations(auditId) {
        return [
            { type: 'node_created', nodeId: 'mock-node-1' },
            { type: 'relationship_created', relationshipId: 'mock-rel-1' }
        ];
    }
    async removeNode(transaction, nodeId) {
        const query = `
      MATCH (n {id: $nodeId})
      DETACH DELETE n
    `;
        await transaction.run(query, { nodeId });
    }
    async removeRelationship(transaction, relationshipId) {
        const query = `
      MATCH ()-[r]-()
      WHERE id(r) = $relationshipId
      DELETE r
    `;
        await transaction.run(query, { relationshipId: parseInt(relationshipId) });
    }
    async cleanupStagingData(jobId) {
        await this.postgresService.query(`
      DELETE FROM extracted_entity_temp WHERE job_id = $1
    `, [jobId]);
        await this.postgresService.query(`
      DELETE FROM extracted_link_temp WHERE job_id = $1
    `, [jobId]);
        this.logger.debug(`Cleaned up staging data for job: ${jobId}`);
    }
}
exports.PromotionService = PromotionService;
//# sourceMappingURL=PromotionService.js.map