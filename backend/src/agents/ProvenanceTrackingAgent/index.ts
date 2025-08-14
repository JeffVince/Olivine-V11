import { BaseAgent, AgentContext, AgentConfig } from '../BaseAgent'
import { QueueService } from '../../services/queues/QueueService'
import { ProvenanceService } from '../../services/provenance/ProvenanceService'
import { Neo4jService } from '../../services/Neo4jService'
import { CryptoService } from '../../services/crypto/CryptoService'
import { v4 as uuidv4 } from 'uuid'
import { Record } from 'neo4j-driver'
import { CommitInput, ActionInput, VersionInput } from './types'

export class ProvenanceTrackingAgent extends BaseAgent {
  private provenanceService: ProvenanceService
  private neo4jService: Neo4jService
  private cryptoService: CryptoService

  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('provenance-tracking-agent', queueService, {
      maxRetries: 5,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    })

    this.provenanceService = new ProvenanceService()
    this.neo4jService = new Neo4jService()
    this.cryptoService = new CryptoService()
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting ProvenanceTrackingAgent...')

    this.queueService.registerWorker('create-commit', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('createCommit', job.data, context, () => this.processCreateCommit(job.data))
    })

    this.queueService.registerWorker('create-action', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('createAction', job.data, context, () => this.processCreateAction(job.data))
    })

    this.queueService.registerWorker('create-version', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('createVersion', job.data, context, () => this.processCreateVersion(job.data))
    })

    this.queueService.registerWorker('provenance', async (job) => {
      const context: AgentContext = { orgId: job.data.orgId, sessionId: uuidv4() }
      await this.executeJob('provenance', job.data, context, () => this.processProvenance(job.data))
    })

    this.logger.info('ProvenanceTrackingAgent started successfully')
  }

  protected async onStop(): Promise<void> { this.logger.info('Stopping ProvenanceTrackingAgent...') }
  protected async onPause(): Promise<void> { this.logger.info('Pausing ProvenanceTrackingAgent...') }
  protected async onResume(): Promise<void> { this.logger.info('Resuming ProvenanceTrackingAgent...') }

  async processCreateCommit(commitData: CommitInput): Promise<string> {
    const { orgId, message, author, authorType, parentCommitId, branchName, metadata } = commitData
    this.validateContext({ orgId })
    this.logger.info(`Creating commit: ${message}`, { orgId, author, authorType })
    try {
      const commitId = uuidv4()
      const createdAt = new Date().toISOString()
      const commitContent = { id: commitId, orgId, message, author, authorType, createdAt, parentCommitId: parentCommitId || null, branchName: branchName || 'main', metadata: metadata || {} }
      const signature = this.cryptoService.sign(JSON.stringify(commitContent))
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
      `
      await this.neo4jService.run(query, { commitId, orgId, message, author, authorType, createdAt, parentCommitId: parentCommitId || null, branchName: branchName || 'main', signature, metadataJson: JSON.stringify(metadata || {}) })
      if (parentCommitId) { await this.createCommitParentRelationship(parentCommitId, commitId, orgId) }
      this.logger.info(`Commit created successfully: ${commitId}`, { message, author })
      return commitId
    } catch (error) {
      this.logger.error(`Failed to create commit: ${message}`, error)
      throw error
    }
  }

  async processCreateAction(actionData: { commitId: string; orgId: string; action: ActionInput }): Promise<string> {
    const { commitId, orgId, action } = actionData
    this.validateContext({ orgId })
    this.logger.debug(`Creating action: ${action.actionType}`, { commitId, entityId: action.entityId })
    try {
      const actionId = uuidv4()
      const createdAt = new Date().toISOString()
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
      `
      await this.neo4jService.run(query, { actionId, commitId, actionType: action.actionType, tool: action.tool, entityType: action.entityType, entityId: action.entityId, inputs: JSON.stringify(action.inputs), outputs: JSON.stringify(action.outputs), status: action.status, errorMessage: action.errorMessage || null, createdAt })
      await this.createCommitActionRelationship(commitId, actionId, orgId)
      this.logger.debug(`Action created successfully: ${actionId}`)
      return actionId
    } catch (error) {
      this.logger.error(`Failed to create action: ${action.actionType}`, error)
      throw error
    }
  }

  async processCreateVersion(versionData: VersionInput): Promise<string> {
    const { orgId, entityId, entityType, properties, commitId } = versionData
    this.validateContext({ orgId })
    this.logger.debug(`Creating version for ${entityType}: ${entityId}`, { commitId })
    try {
      const versionId = uuidv4()
      const createdAt = new Date().toISOString()
      const contentHash = this.cryptoService.hash(JSON.stringify(properties))
      const existingVersionId = await this.getExistingVersion(orgId, entityId, contentHash)
      if (existingVersionId) {
        this.logger.debug(`Version with same content already exists: ${existingVersionId}`)
        return existingVersionId
      }
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
      `
      await this.neo4jService.run(query, { versionId, orgId, entityId, entityType, properties: JSON.stringify(properties), commitId, createdAt, contentHash })
      await this.createEntityVersionRelationship(entityId, versionId, orgId)
      this.logger.debug(`Version created successfully: ${versionId}`)
      return versionId
    } catch (error) {
      this.logger.error(`Failed to create version for ${entityType}: ${entityId}`, error)
      throw error
    }
  }

  async processProvenance(provenanceData: any): Promise<any> {
    const { orgId, message, author, authorType, actions } = provenanceData
    this.validateContext({ orgId })
    this.logger.info(`Processing legacy provenance: ${message}`, { orgId, author })
    try {
      const commitId = await this.processCreateCommit({ orgId, message, author, authorType, branchName: 'main' })
      if (Array.isArray(actions)) {
        for (const action of actions) {
          await this.processCreateAction({ commitId, orgId, action })
        }
      }
      return { commitId }
    } catch (error) {
      this.logger.error(`Failed to process legacy provenance: ${message}`, error)
      throw error
    }
  }

  async validateCommit(commitId: string): Promise<boolean> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      RETURN c
    `
    const result = await this.neo4jService.run(query, { commitId })
    if (result.records.length === 0) { throw new Error(`Commit not found: ${commitId}`) }
    const commit = result.records[0].get('c').properties
    const commitContent = { id: commit.id, orgId: commit.org_id, message: commit.message, author: commit.author, authorType: commit.author_type, createdAt: commit.created_at, parentCommitId: commit.parent_commit_id, branchName: commit.branch_name, metadata: JSON.parse(commit.metadata || '{}') }
    return this.cryptoService.verify(JSON.stringify(commitContent), commit.signature)
  }

  async getCommitHistory(orgId: string, branchName: string, limit = 50): Promise<any[]> {
    const query = `
      MATCH (c:Commit {org_id: $orgId, branch_name: $branchName})
      OPTIONAL MATCH (c)<-[:PART_OF]-(a:Action)
      RETURN c, collect(a) as actions
      ORDER BY c.created_at DESC
      LIMIT $limit
    `
    const result = await this.neo4jService.run(query, { orgId, branchName, limit })
    return result.records.map((record: Record) => {
      const commit = record.get('c').properties
      const actions = record.get('actions').map((action: any) => action.properties)
      return { id: commit.id, orgId: commit.org_id, message: commit.message, author: commit.author, authorType: commit.author_type, createdAt: commit.created_at, parentCommitId: commit.parent_commit_id, branchName: commit.branch_name, signature: commit.signature, metadata: JSON.parse(commit.metadata || '{}'), actions }
    })
  }

  async getEntityVersionHistory(orgId: string, entityId: string): Promise<any[]> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId})
      OPTIONAL MATCH (c:Commit {id: v.commit_id})
      RETURN v, c
      ORDER BY v.created_at DESC
    `
    const result = await this.neo4jService.run(query, { orgId, entityId })
    return result.records.map((record: Record) => {
      const version = record.get('v').properties
      const commit = record.get('c')?.properties
      return { id: version.id, orgId: version.org_id, entityId: version.entity_id, entityType: version.entity_type, properties: JSON.parse(version.properties), commitId: version.commit_id, createdAt: version.created_at, contentHash: version.content_hash, commit: commit ? { id: commit.id, message: commit.message, author: commit.author, createdAt: commit.created_at } : null }
    })
  }

  private async getExistingVersion(orgId: string, entityId: string, contentHash: string): Promise<string | null> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId, content_hash: $contentHash})
      RETURN v.id as versionId
      LIMIT 1
    `
    const result = await this.neo4jService.run(query, { orgId, entityId, contentHash })
    return result.records.length > 0 ? result.records[0].get('versionId') : null
  }

  private async createCommitParentRelationship(parentCommitId: string, childCommitId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (parent:Commit {id: $parentCommitId, org_id: $orgId})
      MATCH (child:Commit {id: $childCommitId, org_id: $orgId})
      CREATE (parent)-[:PARENT_OF {org_id: $orgId, created_at: datetime()}]->(child)
    `
    await this.neo4jService.run(query, { parentCommitId, childCommitId, orgId })
  }

  private async createCommitActionRelationship(commitId: string, actionId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      MATCH (a:Action {id: $actionId})
      CREATE (c)-[:CONTAINS {org_id: $orgId, created_at: datetime()}]->(a)
    `
    await this.neo4jService.run(query, { commitId, actionId, orgId })
  }

  private async createEntityVersionRelationship(entityId: string, versionId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (v:Version {id: $versionId, org_id: $orgId})
      OPTIONAL MATCH (e {id: $entityId, org_id: $orgId})
      WHERE e:File OR e:Content OR e:Project OR e:Task OR e:Resource
      CREATE (e)-[:HAS_VERSION {org_id: $orgId, created_at: datetime()}]->(v)
    `
    await this.neo4jService.run(query, { entityId, versionId, orgId })
  }
}

export * from './types'


