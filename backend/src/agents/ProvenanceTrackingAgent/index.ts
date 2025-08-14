import { BaseAgent, AgentContext, AgentConfig } from '../BaseAgent'
import { QueueService } from '../../services/queues/QueueService'
import { ProvenanceService } from '../../services/provenance/ProvenanceService'
import { Neo4jService } from '../../services/Neo4jService'
import { CryptoService } from '../../services/crypto/CryptoService'
import { v4 as uuidv4 } from 'uuid'
import { CommitInput, ActionInput, VersionInput } from './types'
import { CommitRepository } from './graph/CommitRepository'
import { ActionRepository } from './graph/ActionRepository'
import { VersionRepository } from './graph/VersionRepository'
import { CommitHandler } from './handlers/CommitHandler'
import { ActionHandler } from './handlers/ActionHandler'
import { VersionHandler } from './handlers/VersionHandler'
import { LegacyProvenanceHandler } from './handlers/LegacyProvenanceHandler'

export class ProvenanceTrackingAgent extends BaseAgent {
  private provenanceService: ProvenanceService
  private neo4jService: Neo4jService
  private cryptoService: CryptoService
  private commitRepo: CommitRepository
  private actionRepo: ActionRepository
  private versionRepo: VersionRepository
  private commitHandler: CommitHandler
  private actionHandler: ActionHandler
  private versionHandler: VersionHandler
  private legacyHandler: LegacyProvenanceHandler

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
    this.commitRepo = new CommitRepository(this.neo4jService)
    this.actionRepo = new ActionRepository(this.neo4jService)
    this.versionRepo = new VersionRepository(this.neo4jService)
    this.commitHandler = new CommitHandler(this.cryptoService, this.commitRepo)
    this.actionHandler = new ActionHandler(this.actionRepo, this.commitRepo)
    this.versionHandler = new VersionHandler(this.cryptoService, this.versionRepo)
    this.legacyHandler = new LegacyProvenanceHandler(this.commitHandler, this.actionHandler)
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
    const { orgId, message, author, authorType } = commitData
    this.validateContext({ orgId })
    this.logger.info(`Creating commit: ${message}`, { orgId, author, authorType })
    return this.commitHandler.createCommit(commitData)
  }

  async processCreateAction(actionData: { commitId: string; orgId: string; action: ActionInput }): Promise<string> {
    const { orgId, action } = actionData
    this.validateContext({ orgId })
    this.logger.debug(`Creating action: ${action.actionType}`, { commitId: actionData.commitId, entityId: action.entityId })
    return this.actionHandler.createAction(actionData)
  }

  async processCreateVersion(versionData: VersionInput): Promise<string> {
    const { orgId, entityId, entityType, commitId } = versionData
    this.validateContext({ orgId })
    this.logger.debug(`Creating version for ${entityType}: ${entityId}`, { commitId })
    return this.versionHandler.createVersion(versionData)
  }

  async processProvenance(provenanceData: any): Promise<any> {
    const { orgId, message, author } = provenanceData
    this.validateContext({ orgId })
    this.logger.info(`Processing legacy provenance: ${message}`, { orgId, author })
    return this.legacyHandler.process(provenanceData)
  }

  async validateCommit(commitId: string): Promise<boolean> {
    return this.commitHandler.validateCommit(commitId)
  }

  async getCommitHistory(orgId: string, branchName: string, limit = 50): Promise<any[]> {
    return this.commitRepo.getCommitHistory(orgId, branchName, limit)
  }

  async getEntityVersionHistory(orgId: string, entityId: string): Promise<any[]> {
    return this.versionRepo.getEntityVersionHistory(orgId, entityId)
  }

  // relationships and reads delegated to repositories
}

export * from './types'


