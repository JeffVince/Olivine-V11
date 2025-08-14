import { BaseAgent, AgentContext, AgentConfig } from '../BaseAgent'
import { QueueService } from '../../services/queues/QueueService'
import { ClassificationService } from '../../services/classification/ClassificationService'
import { PostgresService } from '../../services/PostgresService'
import { Neo4jService } from '../../services/Neo4jService'
import { TaxonomyService } from '../../services/TaxonomyService'
import { v4 as uuidv4 } from 'uuid'
import { TaxonomyRule, ClassificationCondition, ClassificationResult } from './types'
import { RuleEngine } from './classification/RuleEngine'
import { ClassificationRepository } from './graph/ClassificationRepository'

export class TaxonomyClassificationAgent extends BaseAgent {
  private classificationService: ClassificationService
  private postgresService: PostgresService
  private neo4jService: Neo4jService
  private taxonomyService: TaxonomyService
  private taxonomyRules: Map<string, TaxonomyRule[]> = new Map()
  private ruleEngine: RuleEngine
  private classificationRepo: ClassificationRepository

  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('taxonomy-classification-agent', queueService, {
      maxRetries: 2,
      retryDelay: 1500,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    })

    this.classificationService = new ClassificationService(new PostgresService())
    this.postgresService = new PostgresService()
    this.neo4jService = new Neo4jService()
    this.taxonomyService = new TaxonomyService()
    this.ruleEngine = new RuleEngine()
    this.classificationRepo = new ClassificationRepository(this.neo4jService)
  }

  /**
   * Initializes the Taxonomy Classification Agent and registers queue workers
   */
  protected async onStart(): Promise<void> {
    this.logger.info('Starting TaxonomyClassificationAgent...')

    // Register classification worker
    this.queueService.registerWorker('file-classification', async (job) => {
      const context: AgentContext = {
        orgId: job.data.orgId,
        sessionId: uuidv4()
      }

      await this.executeJob(
        'classifyFile',
        job.data,
        context,
        () => this.classifyFile(job.data)
      )
    })

    this.logger.info('TaxonomyClassificationAgent started successfully')
  }

  protected async onStop(): Promise<void> { this.logger.info('Stopping TaxonomyClassificationAgent...') }
  protected async onPause(): Promise<void> { this.logger.info('Pausing TaxonomyClassificationAgent...') }
  protected async onResume(): Promise<void> { this.logger.info('Resuming TaxonomyClassificationAgent...') }

  /**
   * Main file classification processing method
   */
  async classifyFile(jobData: any): Promise<ClassificationResult> {
    const { orgId, fileId, filePath, metadata } = jobData

    this.validateContext({ orgId })
    this.logger.info(`Classifying file: ${filePath}`, { orgId, fileId })

    try {
      // Load taxonomy rules for the organization
      await this.loadTaxonomyRules(orgId)

      // Get file data for classification
      const fileData = await this.getFileData(orgId, fileId, filePath, metadata)

      // Perform classification using rule-based engine
      const rules = this.taxonomyRules.get(orgId) || []
      let classificationResult = await this.ruleEngine.performRuleBasedClassification(rules, fileData)

      // If no rule matched, try ML-based classification
      if (classificationResult.slotKey === 'UNCLASSIFIED') {
        classificationResult = await this.performMLClassification(orgId, fileData)
      }

      // Persist classification as temporal EdgeFact via TaxonomyService
      await this.taxonomyService.applyClassification(
        fileId,
        {
          slot: classificationResult.slotKey,
          confidence: classificationResult.confidence,
          method: classificationResult.method === 'taxonomy' ? 'rule_based' : classificationResult.method === 'ml' ? 'ml_based' : 'manual',
          rule_id: classificationResult.ruleId,
          metadata: classificationResult.metadata
        },
        orgId,
        'system'
      )

      // Reflect status/metadata on File node (no convenience edges)
      await this.classificationRepo.updateFileClassification(fileId, {
        status: 'classified',
        confidence: classificationResult.confidence,
        method: classificationResult.method,
        metadata: classificationResult.metadata
      })

      // Create commit for classification action
      const commitId = await this.createCommit(
        orgId,
        `Classified file: ${filePath} as ${classificationResult.slotKey}`,
        {
          fileId,
          classification: classificationResult,
          method: classificationResult.method
        }
      )

      this.logger.info(`File classified successfully: ${filePath}`, {
        slotKey: classificationResult.slotKey,
        confidence: classificationResult.confidence,
        method: classificationResult.method
      })

      return classificationResult
    } catch (error) {
      this.logger.error(`Failed to classify file: ${filePath}`, error)
      throw error
    }
  }

  /**
   * Loads taxonomy rules for an organization
   */
  private async loadTaxonomyRules(orgId: string): Promise<void> {
    if (this.taxonomyRules.has(orgId)) {
      return
    }

    const query = `
      SELECT 
        tr.*,
        tp.name as profile_name
      FROM taxonomy_rules tr
      JOIN taxonomy_profiles tp ON tr.profile_id = tp.id
      WHERE tr.org_id = $1 AND tr.enabled = true AND tp.active = true
      ORDER BY tr.priority ASC
    `

    try {
      const result = await this.postgresService.executeQuery(query, [orgId])
      this.taxonomyRules.set(orgId, result.rows)
      this.logger.debug(`Loaded ${result.rows.length} taxonomy rules for org ${orgId}`)
    } catch (error) {
      this.logger.error(`Failed to load taxonomy rules for org ${orgId}`, error)
      this.taxonomyRules.set(orgId, [])
    }
  }

  /**
   * Gets file data needed for classification
   */
  private async getFileData(orgId: string, fileId: string, filePath: string, metadata: any): Promise<any> {
    if (metadata) {
      return {
        id: fileId,
        name: metadata.name,
        path: filePath,
        size: metadata.size,
        mimeType: metadata.mimeType,
        extractedText: '',
        metadata
      }
    }

    const query = `
      SELECT 
        id,
        name,
        path,
        size,
        mime_type,
        extracted_text,
        metadata
      FROM files
      WHERE id = $1 AND org_id = $2
    `

    const result = await this.postgresService.executeQuery(query, [fileId, orgId])

    if (result.rows.length === 0) {
      throw new Error(`File not found: ${fileId}`)
    }

    const file = result.rows[0]
    return {
      id: file.id,
      name: file.name,
      path: file.path,
      size: file.size,
      mimeType: file.mime_type,
      extractedText: file.extracted_text || '',
      metadata: file.metadata || {}
    }
  }

  // Rule evaluation delegated to RuleEngine

  /**
   * Evaluates if a rule matches the file data
   */
  // evaluateRule delegated to RuleEngine

  /**
   * Evaluates individual classification conditions
   */
  // evaluateCondition delegated to RuleEngine

  /**
   * Applies comparison operators for condition evaluation
   */
  // applyOperator delegated to RuleEngine

  /**
   * Calculates confidence score for rule-based classification
   */
  // calculateConfidence delegated to RuleEngine

  /**
   * Performs ML-based classification as fallback
   */
  private async performMLClassification(orgId: string, fileData: any): Promise<ClassificationResult> {
    try {
      const result = await this.classificationService.classify(orgId, {
        name: fileData.name || fileData.path.split('/').pop() || 'unknown',
        path: fileData.path,
        mimeType: fileData.mimeType,
        size: fileData.size,
        extractedText: fileData.extractedText
      })

      return {
        slotKey: result.slotKey || 'UNCLASSIFIED',
        confidence: result.confidence || 0.3,
        method: 'ml',
        metadata: {
          ruleId: result.ruleId,
          method: result.method
        }
      }
    } catch (error) {
      this.logger.error('ML classification failed, using default classification', error)

      return this.ruleEngine.getDefaultClassification(fileData)
    }
  }

  /**
   * Gets default classification based on file type
   */
  // getDefaultClassification delegated to RuleEngine

  /**
   * Updates file classification in Neo4j
   */
  // updateFileClassification delegated to ClassificationRepository
}

export * from './types'