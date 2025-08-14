import { BaseAgent, AgentStatus } from '../BaseAgent'
import { Neo4jService } from '../../services/Neo4jService'
import { LlmService } from '../../services/llm/LlmService'
import { QueueService } from '../../services/queues/QueueService'
import { MockLlmProvider } from '../../services/llm/MockLlmProvider'
import { ProvenanceService } from '../../services/provenance/ProvenanceService'
import { NoveltyAnalyzer } from './analysis/NoveltyAnalyzer'
import { NoveltyDetectionRequest, NoveltyResult } from './types'

export class NoveltyDetectionAgent extends BaseAgent {
  private neo4j: Neo4jService
  private provenance: ProvenanceService
  private llmService: LlmService
  private analyzer: NoveltyAnalyzer

  constructor(queueService: QueueService) {
    super('novelty_detection_agent', queueService, { maxRetries: 3, retryDelay: 1000, healthCheckInterval: 30000, enableMonitoring: true, logLevel: 'info' })
    this.neo4j = new Neo4jService()
    this.provenance = new ProvenanceService()
    this.llmService = new LlmService(new MockLlmProvider())
    this.analyzer = new NoveltyAnalyzer(this.neo4j, this.llmService)
  }

  async detectNovelty(request: NoveltyDetectionRequest): Promise<NoveltyResult> {
    try {
      const entityExists = await this.analyzer.checkEntityExists(request.entityId, request.orgId)
      if (!entityExists) {
        return await this.handleNewEntity(request)
      }
      const entityHistory = await this.provenance.getEntityHistory(request.entityId, request.entityType, request.orgId)
      const propertyChanges = await this.analyzer.analyzePropertyChanges(request.entityId, request.newProperties, entityHistory, request.orgId)
      const patternDeviations = await this.analyzer.checkPatternDeviations(request.entityType, request.newProperties, request.orgId)
      const relationshipChanges = await this.analyzer.analyzeRelationshipChanges(request.entityId, request.orgId)
      const noveltyScore = this.analyzer.calculateNoveltyScore(propertyChanges, patternDeviations, relationshipChanges)
      const noveltyType = this.analyzer.determineNoveltyType(propertyChanges, patternDeviations, relationshipChanges)
      const reasoning = await this.analyzer.generateReasoning(request, propertyChanges, patternDeviations)
      const recommendations = await this.generateRecommendations(request, noveltyType, noveltyScore)
      return { isNovel: noveltyScore > 0.3, noveltyScore, noveltyType, detectedChanges: propertyChanges, reasoning, recommendations, alertLevel: this.determineAlertLevel(noveltyScore, noveltyType) }
    } catch (error) {
      console.error('Error detecting novelty:', error)
      return { isNovel: false, noveltyScore: 0, noveltyType: 'none', detectedChanges: [], reasoning: `Error analyzing novelty: ${error instanceof Error ? error.message : String(error)}`, alertLevel: 'none' }
    }
  }

  private async handleNewEntity(request: NoveltyDetectionRequest): Promise<NoveltyResult> {
    const entityTypeFrequency = await this.analyzer.getEntityTypeFrequency(request.entityType, request.orgId, request.context?.projectId)
    const noveltyScore = entityTypeFrequency < 5 ? 0.8 : 0.4
    return {
      isNovel: true,
      noveltyScore,
      noveltyType: 'new_entity',
      detectedChanges: Object.keys(request.newProperties).map(key => ({ property: key, newValue: request.newProperties[key], changeType: 'added' as const, significance: 0.7 })),
      reasoning: `New ${request.entityType} entity detected. This entity type has appeared ${entityTypeFrequency} times in this context.`,
      recommendations: ['Review entity properties for completeness', 'Ensure proper classification and relationships', 'Consider if this represents a new pattern or category'],
      alertLevel: noveltyScore > 0.7 ? 'warning' : 'info'
    }
  }

  private determineAlertLevel(noveltyScore: number, _noveltyType: string): NoveltyResult['alertLevel'] {
    if (noveltyScore > 0.8) return 'critical'
    if (noveltyScore > 0.6) return 'warning'
    if (noveltyScore > 0.3) return 'info'
    return 'none'
  }

  private async generateRecommendations(request: NoveltyDetectionRequest, noveltyType: string, noveltyScore: number): Promise<string[]> {
    const recommendations: string[] = []
    if (noveltyScore > 0.7) {
      recommendations.push('Review changes carefully for potential data quality issues')
      recommendations.push('Consider if this represents a new business pattern or requirement')
    }
    if (noveltyType === 'pattern_deviation') {
      recommendations.push('Investigate why this entity deviates from established patterns')
      recommendations.push('Update taxonomy rules if this represents a valid new pattern')
    }
    if (noveltyType === 'new_entity') {
      recommendations.push('Ensure all required properties are populated')
      recommendations.push('Verify entity relationships are properly established')
    }
    return recommendations
  }

  getCapabilities(): string[] {
    return ['novelty_detection','pattern_analysis','change_detection','anomaly_detection','entity_analysis','relationship_analysis','statistical_analysis']
  }

  getStatus(): AgentStatus {
    return { name: this.name, running: this.running, paused: this.paused, error: this.lastError, startTime: this.startTime, lastActivity: this.lastActivity, processedJobs: this.processedJobs, failedJobs: this.failedJobs }
  }

  protected async onStart(): Promise<void> { console.log(`${this.name} agent started`) }
  protected async onStop(): Promise<void> { console.log(`${this.name} agent stopped`) }
  protected async onPause(): Promise<void> { console.log(`${this.name} agent paused`) }
  protected async onResume(): Promise<void> { console.log(`${this.name} agent resumed`) }
}

export * from './types'
export * from './analysis/NoveltyAnalyzer'