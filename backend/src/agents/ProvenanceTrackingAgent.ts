import { BaseAgent, AgentContext, AgentConfig } from './BaseAgent'
import { QueueService } from '../services/queues/QueueService'
import { ProvenanceService } from '../services/provenance/ProvenanceService'
import { Neo4jService } from '../services/Neo4jService'
import { CryptoService } from '../services/crypto/CryptoService'
import { v4 as uuidv4 } from 'uuid'
import { Record } from 'neo4j-driver'

export interface CommitInput {
  orgId: string;
  message: string;
  author: string;
  authorType: 'user' | 'agent' | 'system';
  parentCommitId?: string;
  branchName?: string;
  metadata?: any;
}

export interface ActionInput {
  actionType: string;
  tool: string;
  entityType: string;
  entityId: string;
  inputs: any;
  outputs: any;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

export interface VersionInput {
  orgId: string;
  entityId: string;
  entityType: string;
  properties: any;
  commitId: string;
}

export class ProvenanceTrackingAgent extends BaseAgent {
  private provenanceService: ProvenanceService;
  private neo4jService: Neo4jService;
  private cryptoService: CryptoService;

  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('provenance-tracking-agent', queueService, {
      maxRetries: 5, // Higher retry count for critical provenance data
      retryDelay: 1000,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    });

    this.provenanceService = new ProvenanceService();
    this.neo4jService = new Neo4jService();
    this.cryptoService = new CryptoService();
  }

  /**
   * Initializes the Provenance Tracking Agent and registers queue workers
   */
  protected async onStart(): Promise<void> {
    this.logger.info('Starting ProvenanceTrackingAgent...');

    // Register commit creation worker
    this.queueService.registerWorker('create-commit', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'createCommit',
        job.data,
        context,
        () => this.processCreateCommit(job.data)
      );
    });

    // Register action creation worker
    this.queueService.registerWorker('create-action', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'createAction',
        job.data,
        context,
        () => this.processCreateAction(job.data)
      );
    });

    // Register entity versioning worker
    this.queueService.registerWorker('create-version', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'createVersion',
        job.data,
        context,
        () => this.processCreateVersion(job.data)
      );
    });

    // Register legacy provenance worker for backward compatibility
    this.queueService.registerWorker('provenance', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'provenance',
        job.data,
        context,
        () => this.processProvenance(job.data)
      );
    });

    this.logger.info('ProvenanceTrackingAgent started successfully');
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping ProvenanceTrackingAgent...');
  }

  protected async onPause(): Promise<void> {
    this.logger.info('Pausing ProvenanceTrackingAgent...');
  }

  protected async onResume(): Promise<void> {
    this.logger.info('Resuming ProvenanceTrackingAgent...');
  }

  /**
   * Creates a new commit with cryptographic signature
   */
  async processCreateCommit(commitData: CommitInput): Promise<string> {
    const { orgId, message, author, authorType, parentCommitId, branchName, metadata } = commitData;
    
    this.validateContext({ orgId });
    this.logger.info(`Creating commit: ${message}`, { orgId, author, authorType });

    try {
      const commitId = uuidv4();
      const createdAt = new Date().toISOString();
      
      // Create commit content for signing
      const commitContent = {
        id: commitId,
        orgId,
        message,
        author,
        authorType,
        createdAt,
        parentCommitId: parentCommitId || null,
        branchName: branchName || 'main',
        metadata: metadata || {}
      };
      
      // Generate cryptographic signature
      const signature = this.cryptoService.sign(JSON.stringify(commitContent));
      
      // Store commit in Neo4j
      const query = `
        CREATE (c:Commit {
          id: $commitId,
          org_id: $orgId,
          message: $message,
          author: $author,
          author_type: $authorType,
          created_at: datetime($createdAt),
          parent_commit_id: $parentCommitId,
          branch_name: $branchName,
          signature: $signature,
          metadata: $metadataJson
        })
        RETURN c.id as commitId
      `;
      
      await this.neo4jService.run(query, {
        commitId,
        orgId,
        message,
        author,
        authorType,
        createdAt,
        parentCommitId: parentCommitId || null,
        branchName: branchName || 'main',
        signature,
        metadataJson: JSON.stringify(metadata || {})
      });

      // Create parent relationship if this isn't the first commit
      if (parentCommitId) {
        await this.createCommitParentRelationship(parentCommitId, commitId, orgId);
      }

      this.logger.info(`Commit created successfully: ${commitId}`, { message, author });
      return commitId;

    } catch (error) {
      this.logger.error(`Failed to create commit: ${message}`, error);
      throw error;
    }
  }

  /**
   * Creates a new action associated with a commit
   */
  async processCreateAction(actionData: { commitId: string; orgId: string; action: ActionInput }): Promise<string> {
    const { commitId, orgId, action } = actionData;
    
    this.validateContext({ orgId });
    this.logger.debug(`Creating action: ${action.actionType}`, { commitId, entityId: action.entityId });

    try {
      const actionId = uuidv4();
      const createdAt = new Date().toISOString();

      const query = `
        CREATE (a:Action {
          id: $actionId,
          commit_id: $commitId,
          action_type: $actionType,
          tool: $tool,
          entity_type: $entityType,
          entity_id: $entityId,
          inputs: $inputs,
          outputs: $outputs,
          status: $status,
          error_message: $errorMessage,
          created_at: datetime($createdAt)
        })
        RETURN a.id as actionId
      `;

      await this.neo4jService.run(query, {
        actionId,
        commitId,
        actionType: action.actionType,
        tool: action.tool,
        entityType: action.entityType,
        entityId: action.entityId,
        inputs: JSON.stringify(action.inputs),
        outputs: JSON.stringify(action.outputs),
        status: action.status,
        errorMessage: action.errorMessage || null,
        createdAt
      });

      // Create relationship between commit and action
      await this.createCommitActionRelationship(commitId, actionId, orgId);

      this.logger.debug(`Action created successfully: ${actionId}`);
      return actionId;

    } catch (error) {
      this.logger.error(`Failed to create action: ${action.actionType}`, error);
      throw error;
    }
  }

  /**
   * Creates a version record for an entity
   */
  async processCreateVersion(versionData: VersionInput): Promise<string> {
    const { orgId, entityId, entityType, properties, commitId } = versionData;
    
    this.validateContext({ orgId });
    this.logger.debug(`Creating version for ${entityType}: ${entityId}`, { commitId });

    try {
      const versionId = uuidv4();
      const createdAt = new Date().toISOString();
      
      // Create content hash for deduplication
      const contentHash = this.cryptoService.hash(JSON.stringify(properties));
      
      // Check if version with same content already exists
      const existingVersionId = await this.getExistingVersion(orgId, entityId, contentHash);
      
      if (existingVersionId) {
        this.logger.debug(`Version with same content already exists: ${existingVersionId}`);
        return existingVersionId;
      }
      
      // Store version in Neo4j
      const query = `
        CREATE (v:Version {
          id: $versionId,
          org_id: $orgId,
          entity_id: $entityId,
          entity_type: $entityType,
          properties: $properties,
          commit_id: $commitId,
          created_at: datetime($createdAt),
          content_hash: $contentHash
        })
        RETURN v.id as versionId
      `;
      
      await this.neo4jService.run(query, {
        versionId,
        orgId,
        entityId,
        entityType,
        properties: JSON.stringify(properties),
        commitId,
        createdAt,
        contentHash
      });

      // Create relationship between entity and version
      await this.createEntityVersionRelationship(entityId, versionId, orgId);

      this.logger.debug(`Version created successfully: ${versionId}`);
      return versionId;

    } catch (error) {
      this.logger.error(`Failed to create version for ${entityType}: ${entityId}`, error);
      throw error;
    }
  }

  /**
   * Legacy provenance worker for backward compatibility
   */
  async processProvenance(provenanceData: any): Promise<any> {
    const { orgId, message, author, authorType, actions } = provenanceData;
    
    this.validateContext({ orgId });
    this.logger.info(`Processing legacy provenance: ${message}`, { orgId, author });

    try {
      // Create commit using new system
      const commitId = await this.processCreateCommit({
        orgId,
        message,
        author,
        authorType,
        branchName: 'main'
      });

      // Create actions if provided
      if (Array.isArray(actions)) {
        for (const action of actions) {
          await this.processCreateAction({
            commitId,
            orgId,
            action
          });
        }
      }

      return { commitId };
      
    } catch (error) {
      this.logger.error(`Failed to process legacy provenance: ${message}`, error);
      throw error;
    }
  }

  /**
   * Validates commit integrity using cryptographic signature
   */
  async validateCommit(commitId: string): Promise<boolean> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      RETURN c
    `;
    
    const result = await this.neo4jService.run(query, { commitId });
    
    if (result.records.length === 0) {
      throw new Error(`Commit not found: ${commitId}`);
    }
    
    const commit = result.records[0].get('c').properties;
    
    // Recreate commit content for verification
    const commitContent = {
      id: commit.id,
      orgId: commit.org_id,
      message: commit.message,
      author: commit.author,
      authorType: commit.author_type,
      createdAt: commit.created_at,
      parentCommitId: commit.parent_commit_id,
      branchName: commit.branch_name,
      metadata: JSON.parse(commit.metadata || '{}')
    };
    
    return this.cryptoService.verify(JSON.stringify(commitContent), commit.signature);
  }

  /**
   * Retrieves commit history for a branch
   */
  async getCommitHistory(orgId: string, branchName: string, limit: number = 50): Promise<any[]> {
    const query = `
      MATCH (c:Commit {org_id: $orgId, branch_name: $branchName})
      OPTIONAL MATCH (c)<-[:PART_OF]-(a:Action)
      RETURN c, collect(a) as actions
      ORDER BY c.created_at DESC
      LIMIT $limit
    `;
    
    const result = await this.neo4jService.run(query, { orgId, branchName, limit });
    
    return result.records.map((record: Record) => {
      const commit = record.get('c').properties;
      const actions = record.get('actions').map((action: any) => action.properties);
      
      return {
        id: commit.id,
        orgId: commit.org_id,
        message: commit.message,
        author: commit.author,
        authorType: commit.author_type,
        createdAt: commit.created_at,
        parentCommitId: commit.parent_commit_id,
        branchName: commit.branch_name,
        signature: commit.signature,
        metadata: JSON.parse(commit.metadata || '{}'),
        actions
      };
    });
  }

  /**
   * Gets version history for an entity
   */
  async getEntityVersionHistory(orgId: string, entityId: string): Promise<any[]> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId})
      OPTIONAL MATCH (c:Commit {id: v.commit_id})
      RETURN v, c
      ORDER BY v.created_at DESC
    `;
    
    const result = await this.neo4jService.run(query, { orgId, entityId });
    
    return result.records.map((record: Record) => {
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
   * Checks if a version with the same content already exists
   */
  private async getExistingVersion(orgId: string, entityId: string, contentHash: string): Promise<string | null> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId, content_hash: $contentHash})
      RETURN v.id as versionId
      LIMIT 1
    `;
    
    const result = await this.neo4jService.run(query, { orgId, entityId, contentHash });
    
    return result.records.length > 0 ? result.records[0].get('versionId') : null;
  }

  /**
   * Creates parent-child relationship between commits
   */
  private async createCommitParentRelationship(parentCommitId: string, childCommitId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (parent:Commit {id: $parentCommitId, org_id: $orgId})
      MATCH (child:Commit {id: $childCommitId, org_id: $orgId})
      CREATE (parent)-[:PARENT_OF {org_id: $orgId, created_at: datetime()}]->(child)
    `;
    
    await this.neo4jService.run(query, { parentCommitId, childCommitId, orgId });
  }

  /**
   * Creates relationship between commit and action
   */
  private async createCommitActionRelationship(commitId: string, actionId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      MATCH (a:Action {id: $actionId})
      CREATE (c)-[:CONTAINS {org_id: $orgId, created_at: datetime()}]->(a)
    `;
    
    await this.neo4jService.run(query, { commitId, actionId, orgId });
  }

  /**
   * Creates relationship between entity and version
   */
  private async createEntityVersionRelationship(entityId: string, versionId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (v:Version {id: $versionId, org_id: $orgId})
      OPTIONAL MATCH (e {id: $entityId, org_id: $orgId})
      WHERE e:File OR e:Content OR e:Project OR e:Task OR e:Resource
      CREATE (e)-[:HAS_VERSION {org_id: $orgId, created_at: datetime()}]->(v)
    `;
    
    await this.neo4jService.run(query, { entityId, versionId, orgId });
  }
}


