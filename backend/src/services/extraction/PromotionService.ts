import { BaseService } from '../BaseService';
import { PostgresService } from '../PostgresService';
import { Neo4jService } from '../Neo4jService';
import { QueueService } from '../queues/QueueService';
import { v4 as uuidv4 } from 'uuid';

export interface PromotionJobData {
  jobId: string;
  orgId: string;
  actor: string;
  autoPromoted?: boolean;
  reviewNotes?: string;
}

export interface RollbackJobData {
  auditId: string;
  orgId: string;
  actor: string;
  reason: string;
}

export interface PromotionResult {
  nodesCreated: number;
  relationshipsCreated: number;
  commitId: string;
  auditId: string;
}

export interface RollbackResult {
  nodesRemoved: number;
  relationshipsRemoved: number;
  commitId: string;
}

/**
 * PromotionService handles the promotion of staged extraction results to the Neo4j graph
 * and manages rollback operations with full audit trails.
 */
export class PromotionService extends BaseService {
  private postgresService: PostgresService;
  private neo4jService: Neo4jService;
  private queueService: QueueService;

  constructor(
    postgresService: PostgresService,
    neo4jService: Neo4jService,
    queueService: QueueService
  ) {
    super('PromotionService');
    this.postgresService = postgresService;
    this.neo4jService = neo4jService;
    this.queueService = queueService;
  }

  /**
   * Process promotion job from queue
   */
  async processPromotionJob(jobData: PromotionJobData): Promise<PromotionResult> {
    const { jobId, orgId, actor, autoPromoted = false, reviewNotes } = jobData;
    
    this.logger.info(`Processing promotion job: ${jobId}`, { orgId, actor, autoPromoted });

    try {
      // Get extraction job details
      const jobDetails = await this.getExtractionJobDetails(jobId);
      if (!jobDetails) {
        throw new Error(`Extraction job not found: ${jobId}`);
      }

      // Get staged entities and links
      const stagedEntities = await this.getStagedEntities(jobId);
      const stagedLinks = await this.getStagedLinks(jobId);

      // Validate promotion rules
      await this.validatePromotionRules(orgId, stagedEntities, stagedLinks);

      // Start Neo4j transaction for promotion
      const session = this.neo4jService.getSession();
      const transaction = session.beginTransaction();

      try {
        // Create commit record for provenance
        const commitId = uuidv4();
        await this.createCommitRecord(transaction, commitId, orgId, actor, 'promotion', {
          jobId,
          entitiesCount: stagedEntities.length,
          linksCount: stagedLinks.length,
          autoPromoted,
          reviewNotes
        });

        // Promote entities to graph
        const entityMapping = await this.promoteEntities(transaction, stagedEntities, commitId, orgId);
        
        // Promote links to graph
        const relationshipsCreated = await this.promoteLinks(transaction, stagedLinks, entityMapping, commitId, orgId);

        // Update content cluster statistics
        await this.updateContentClusterStats(transaction, jobDetails.file_id, stagedEntities.length, relationshipsCreated);

        // Commit transaction
        await transaction.commit();

        // Create audit record
        const auditId = await this.createPromotionAudit(jobId, actor, 'promote', {
          stagedEntities: stagedEntities.length,
          stagedLinks: stagedLinks.length
        }, {
          nodesCreated: Object.keys(entityMapping).length,
          relationshipsCreated,
          commitId
        });

        // Update extraction job status
        await this.updateExtractionJobStatus(jobId, 'promoted', { 
          promotedAt: new Date().toISOString(),
          promotedBy: actor,
          auditId 
        });

        // Clean up staging data (optional - could be kept for audit)
        if (process.env.CLEANUP_STAGING_ON_PROMOTION === 'true') {
          await this.cleanupStagingData(jobId);
        }

        const result: PromotionResult = {
          nodesCreated: Object.keys(entityMapping).length,
          relationshipsCreated,
          commitId,
          auditId
        };

        this.logger.info(`Promotion completed: ${jobId}`, result as unknown);
        return result;

      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        await session.close();
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Promotion failed: ${jobId}`, { error: message });
      await this.updateExtractionJobStatus(jobId, 'promotion_failed', { error: message });
      throw error;
    }
  }

  /**
   * Process rollback job from queue
   */
  async processRollbackJob(jobData: RollbackJobData): Promise<RollbackResult> {
    const { auditId, orgId, actor, reason } = jobData;
    
    this.logger.info(`Processing rollback job: ${auditId}`, { orgId, actor, reason });

    try {
      // Get promotion audit details
      const auditDetails = await this.getPromotionAuditDetails(auditId);
      if (!auditDetails) {
        throw new Error(`Promotion audit not found: ${auditId}`);
      }

      // Get rollback operations from audit trail
      const rollbackOps = await this.getRollbackOperations(auditId);

      // Start Neo4j transaction for rollback
      const session = this.neo4jService.getSession();
      const transaction = session.beginTransaction();

      try {
        // Create commit record for rollback provenance
        const commitId = uuidv4();
        await this.createCommitRecord(transaction, commitId, orgId, actor, 'rollback', {
          originalAuditId: auditId,
          reason,
          rollbackOpsCount: rollbackOps.length
        });

        // Execute rollback operations
        let nodesRemoved = 0;
        let relationshipsRemoved = 0;

        for (const op of rollbackOps) {
          if (op.type === 'node_created') {
            await this.removeNode(transaction, op.nodeId);
            nodesRemoved++;
          } else if (op.type === 'relationship_created') {
            await this.removeRelationship(transaction, op.relationshipId);
            relationshipsRemoved++;
          }
        }

        // Update content cluster statistics
        const fileId = auditDetails.after_json?.fileId;
        if (fileId) {
          await this.updateContentClusterStats(transaction, fileId, -nodesRemoved, -relationshipsRemoved);
        }

        // Commit transaction
        await transaction.commit();

        // Create rollback audit record
        await this.createPromotionAudit(auditDetails.job_id, actor, 'rollback', {
          originalAuditId: auditId,
          reason
        }, {
          nodesRemoved,
          relationshipsRemoved,
          commitId
        });

        // Update extraction job status
        await this.updateExtractionJobStatus(auditDetails.job_id, 'rolled_back', {
          rolledBackAt: new Date().toISOString(),
          rolledBackBy: actor,
          rollbackReason: reason
        });

        const result: RollbackResult = {
          nodesRemoved,
          relationshipsRemoved,
          commitId
        };

        this.logger.info(`Rollback completed: ${auditId}`, result as unknown);
        return result;

      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        await session.close();
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Rollback failed: ${auditId}`, { error: message });
      throw error;
    }
  }

  /**
   * Get extraction job details
   */
  private async getExtractionJobDetails(jobId: string): Promise<any> {
    const result = await this.postgresService.query(`
      SELECT * FROM extraction_job WHERE id = $1
    `, [jobId]);

    return result.rows[0];
  }

  /**
   * Get staged entities for promotion
   */
  private async getStagedEntities(jobId: string): Promise<any[]> {
    const result = await this.postgresService.query(`
      SELECT * FROM extracted_entity_temp 
      WHERE job_id = $1 
      ORDER BY created_at
    `, [jobId]);

    return result.rows;
  }

  /**
   * Get staged links for promotion
   */
  private async getStagedLinks(jobId: string): Promise<any[]> {
    const result = await this.postgresService.query(`
      SELECT * FROM extracted_link_temp 
      WHERE job_id = $1 
      ORDER BY created_at
    `, [jobId]);

    return result.rows;
  }

  /**
   * Validate promotion rules and constraints
   */
  private async validatePromotionRules(orgId: string, entities: any[], links: any[]): Promise<void> {
    // Check for duplicate entities that would violate uniqueness constraints
    const entityGroups = new Map<string, any[]>();
    
    for (const entity of entities) {
      const key = `${entity.kind}:${JSON.stringify(entity.raw_json)}`;
      if (!entityGroups.has(key)) {
        entityGroups.set(key, []);
      }
      entityGroups.get(key)!.push(entity);
    }

    // Check for conflicts with existing graph data
    for (const [key, group] of entityGroups) {
      if (group.length > 1) {
        this.logger.warn(`Duplicate entities detected for promotion`, { key, count: group.length });
      }

      // Check if entity already exists in graph
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

    // Validate cross-layer relationships
    for (const link of links) {
      await this.validateCrossLayerLink(orgId, link);
    }
  }

  /**
   * Validate cross-layer relationship constraints
   */
  private async validateCrossLayerLink(orgId: string, link: any): Promise<void> {
    // Define allowed cross-layer relationships
    const allowedCrossLayerRels = [
      'SCHEDULED_ON', // Scene -> ShootDay
      'PORTRAYED_BY', // Character -> Talent
      'HAS_LOCATION', // Scene -> Location
      'FOR_SCENE',    // PurchaseOrder -> Scene
      'FOR_CREW'      // PurchaseOrder -> Crew
    ];

    if (!allowedCrossLayerRels.includes(link.rel_type)) {
      this.logger.warn(`Unknown cross-layer relationship type: ${link.rel_type}`);
    }
  }

  /**
   * Promote entities to Neo4j graph
   */
  private async promoteEntities(
    transaction: any,
    entities: any[],
    commitId: string,
    orgId: string
  ): Promise<Record<string, string>> {
    const entityMapping: Record<string, string> = {};

    for (const entity of entities) {
      const nodeId = uuidv4();
      const data = entity.raw_json;
      
      // Add standard properties
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

      // Create node with appropriate label
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

  /**
   * Promote links to Neo4j graph
   */
  private async promoteLinks(
    transaction: any,
    links: any[],
    entityMapping: Record<string, string>,
    commitId: string,
    orgId: string
  ): Promise<number> {
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

  /**
   * Update content cluster statistics
   */
  private async updateContentClusterStats(
    transaction: any,
    fileId: string,
    entitiesDelta: number,
    linksDelta: number
  ): Promise<void> {
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

    // Also update PostgreSQL staging record
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

  /**
   * Create commit record for provenance
   */
  private async createCommitRecord(
    transaction: any,
    commitId: string,
    orgId: string,
    actor: string,
    action: string,
    metadata: any
  ): Promise<void> {
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

  /**
   * Create promotion audit record
   */
  private async createPromotionAudit(
    jobId: string,
    actor: string,
    action: string,
    beforeJson: any,
    afterJson: any
  ): Promise<string> {
    const auditId = uuidv4();
    
    await this.postgresService.query(`
      INSERT INTO promotion_audit (id, job_id, actor, action, before_json, after_json, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [auditId, jobId, actor, action, JSON.stringify(beforeJson), JSON.stringify(afterJson)]);

    return auditId;
  }

  /**
   * Update extraction job status
   */
  private async updateExtractionJobStatus(jobId: string, status: string, metadata: any): Promise<void> {
    await this.postgresService.query(`
      UPDATE extraction_job 
      SET status = $2, metadata = metadata || $3
      WHERE id = $1
    `, [jobId, status, JSON.stringify(metadata)]);
  }

  /**
   * Get promotion audit details for rollback
   */
  private async getPromotionAuditDetails(auditId: string): Promise<any> {
    const result = await this.postgresService.query(`
      SELECT * FROM promotion_audit WHERE id = $1
    `, [auditId]);

    return result.rows[0];
  }

  /**
   * Get rollback operations from commit history
   */
  private async getRollbackOperations(auditId: string): Promise<any[]> {
    // This would query the Neo4j commit history to get reverse operations
    // For now, return mock operations
    return [
      { type: 'node_created', nodeId: 'mock-node-1' },
      { type: 'relationship_created', relationshipId: 'mock-rel-1' }
    ];
  }

  /**
   * Remove node during rollback
   */
  private async removeNode(transaction: any, nodeId: string): Promise<void> {
    const query = `
      MATCH (n {id: $nodeId})
      DETACH DELETE n
    `;

    await transaction.run(query, { nodeId });
  }

  /**
   * Remove relationship during rollback
   */
  private async removeRelationship(transaction: any, relationshipId: string): Promise<void> {
    const query = `
      MATCH ()-[r]-()
      WHERE id(r) = $relationshipId
      DELETE r
    `;

    await transaction.run(query, { relationshipId: parseInt(relationshipId) });
  }

  /**
   * Clean up staging data after successful promotion
   */
  private async cleanupStagingData(jobId: string): Promise<void> {
    await this.postgresService.query(`
      DELETE FROM extracted_entity_temp WHERE job_id = $1
    `, [jobId]);

    await this.postgresService.query(`
      DELETE FROM extracted_link_temp WHERE job_id = $1
    `, [jobId]);

    this.logger.debug(`Cleaned up staging data for job: ${jobId}`);
  }
}
