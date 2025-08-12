import { BaseAgent, AgentStatus } from './BaseAgent';
import { ContentOntologyService } from '../services/ContentOntologyService';
import { Neo4jService } from '../services/Neo4jService';
import { LlmService } from '../services/llm/LlmService';
import { QueueService } from '../services/queues/QueueService';
import { MockLlmProvider } from '../services/llm/MockLlmProvider';
import { ProvenanceService } from '../services/provenance/ProvenanceService';

interface NoveltyDetectionRequest {
  entityId: string;
  entityType: string;
  newProperties: Record<string, any>;
  orgId: string;
  userId: string;
  context?: {
    projectId?: string;
    sourceId?: string;
    metadata?: Record<string, any>;
  };
}

interface NoveltyResult {
  isNovel: boolean;
  noveltyScore: number; // 0.0 to 1.0
  noveltyType: 'new_entity' | 'property_change' | 'relationship_change' | 'pattern_deviation' | 'none';
  detectedChanges: Array<{
    property: string;
    oldValue?: any;
    newValue: any;
    changeType: 'added' | 'modified' | 'removed';
    significance: number; // 0.0 to 1.0
  }>;
  reasoning: string;
  recommendations?: string[];
  alertLevel: 'none' | 'info' | 'warning' | 'critical';
}

interface NoveltyPattern {
  pattern_id: string;
  entity_type: string;
  pattern_type: 'frequency' | 'sequence' | 'relationship' | 'property_range';
  baseline_stats: Record<string, any>;
  threshold: number;
  created_at: Date;
  last_updated: Date;
}

export class NoveltyDetectionAgent extends BaseAgent {
  private neo4j: Neo4jService;
  private provenance: ProvenanceService;
  private llmService: LlmService;

  constructor(queueService: QueueService) {
    super('novelty_detection_agent', queueService, { 
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info'
    });
    this.neo4j = new Neo4jService();
    this.provenance = new ProvenanceService();
    this.llmService = new LlmService(new MockLlmProvider());
  }

  /**
   * Detect novelty in entity changes
   */
  async detectNovelty(request: NoveltyDetectionRequest): Promise<NoveltyResult> {
    try {
      // Step 1: Check if this is a completely new entity
      const entityExists = await this.checkEntityExists(request.entityId, request.orgId);
      
      if (!entityExists) {
        return await this.handleNewEntity(request);
      }

      // Step 2: Get entity history for comparison
      const entityHistory = await this.provenance.getEntityHistory(
        request.entityId, 
        request.entityType, 
        request.orgId
      );

      // Step 3: Analyze property changes
      const propertyChanges = await this.analyzePropertyChanges(
        request.entityId,
        request.newProperties,
        entityHistory,
        request.orgId
      );

      // Step 4: Check against established patterns
      const patternDeviations = await this.checkPatternDeviations(
        request.entityType,
        request.newProperties,
        request.orgId
      );

      // Step 5: Analyze relationship changes
      const relationshipChanges = await this.analyzeRelationshipChanges(
        request.entityId,
        request.orgId
      );

      // Step 6: Calculate overall novelty score
      const noveltyScore = this.calculateNoveltyScore(
        propertyChanges,
        patternDeviations,
        relationshipChanges
      );

      // Step 7: Determine novelty type and alert level
      const noveltyType = this.determineNoveltyType(propertyChanges, patternDeviations, relationshipChanges);
      const alertLevel = this.determineAlertLevel(noveltyScore, noveltyType);

      // Step 8: Generate reasoning and recommendations
      const reasoning = await this.generateReasoning(request, propertyChanges, patternDeviations);
      const recommendations = await this.generateRecommendations(request, noveltyType, noveltyScore);

      return {
        isNovel: noveltyScore > 0.3,
        noveltyScore,
        noveltyType,
        detectedChanges: propertyChanges,
        reasoning,
        recommendations,
        alertLevel
      };

    } catch (error) {
      console.error('Error detecting novelty:', error);
      return {
        isNovel: false,
        noveltyScore: 0,
        noveltyType: 'none',
        detectedChanges: [],
        reasoning: `Error analyzing novelty: ${error instanceof Error ? error.message : String(error)}`,
        alertLevel: 'none'
      };
    }
  }

  /**
   * Handle detection for completely new entities
   */
  private async handleNewEntity(request: NoveltyDetectionRequest): Promise<NoveltyResult> {
    // Check if this type of entity is common in this context
    const entityTypeFrequency = await this.getEntityTypeFrequency(
      request.entityType,
      request.orgId,
      request.context?.projectId
    );

    const noveltyScore = entityTypeFrequency < 5 ? 0.8 : 0.4; // High novelty for rare entity types

    return {
      isNovel: true,
      noveltyScore,
      noveltyType: 'new_entity',
      detectedChanges: Object.keys(request.newProperties).map(key => ({
        property: key,
        newValue: request.newProperties[key],
        changeType: 'added' as const,
        significance: 0.7
      })),
      reasoning: `New ${request.entityType} entity detected. This entity type has appeared ${entityTypeFrequency} times in this context.`,
      recommendations: [
        'Review entity properties for completeness',
        'Ensure proper classification and relationships',
        'Consider if this represents a new pattern or category'
      ],
      alertLevel: noveltyScore > 0.7 ? 'warning' : 'info'
    };
  }

  /**
   * Analyze changes in entity properties
   */
  private async analyzePropertyChanges(
    entityId: string,
    newProperties: Record<string, any>,
    entityHistory: any[],
    orgId: string
  ): Promise<Array<{
    property: string;
    oldValue?: any;
    newValue: any;
    changeType: 'added' | 'modified' | 'removed';
    significance: number;
  }>> {
    const changes: Array<{
      property: string;
      oldValue?: any;
      newValue: any;
      changeType: 'added' | 'modified' | 'removed';
      significance: number;
    }> = [];

    if (entityHistory.length === 0) {
      // No history - all properties are new
      return Object.keys(newProperties).map(key => ({
        property: key,
        newValue: newProperties[key],
        changeType: 'added' as const,
        significance: 0.6
      }));
    }

    const latestVersion = entityHistory[entityHistory.length - 1];
    const oldProperties = latestVersion.props || {};

    // Check for added and modified properties
    for (const [key, newValue] of Object.entries(newProperties)) {
      if (!(key in oldProperties)) {
        changes.push({
          property: key,
          newValue,
          changeType: 'added',
          significance: await this.calculatePropertySignificance(key, newValue, entityId, orgId)
        });
      } else if (JSON.stringify(oldProperties[key]) !== JSON.stringify(newValue)) {
        changes.push({
          property: key,
          oldValue: oldProperties[key],
          newValue,
          changeType: 'modified',
          significance: await this.calculatePropertySignificance(key, newValue, entityId, orgId)
        });
      }
    }

    // Check for removed properties
    for (const key of Object.keys(oldProperties)) {
      if (!(key in newProperties)) {
        changes.push({
          property: key,
          oldValue: oldProperties[key],
          newValue: undefined,
          changeType: 'removed',
          significance: 0.8 // Removals are generally significant
        });
      }
    }

    return changes;
  }

  /**
   * Check for deviations from established patterns
   */
  private async checkPatternDeviations(
    entityType: string,
    newProperties: Record<string, any>,
    orgId: string
  ): Promise<Array<{
    pattern: string;
    expected: any;
    actual: any;
    deviation_score: number;
  }>> {
    const query = `
      MATCH (e {org_id: $org_id})
      WHERE labels(e)[0] = $entity_type
      RETURN 
        count(e) as entity_count,
        collect(e) as entities
    `;

    const result = await this.neo4j.executeQuery(query, {
      org_id: orgId,
      entity_type: entityType
    }, orgId);

    const entities = result.records[0]?.get('entities') || [];
    
    if (entities.length < 10) {
      // Not enough data to establish patterns
      return [];
    }

    // Analyze patterns in existing entities
    const patterns = await this.analyzeEntityPatterns(entities, entityType);
    const deviations = [];

    for (const pattern of patterns) {
      const deviation = this.checkPatternDeviation(pattern, newProperties);
      if (deviation.deviation_score > 0.5) {
        deviations.push(deviation);
      }
    }

    return deviations;
  }

  /**
   * Analyze relationship changes
   */
  private async analyzeRelationshipChanges(entityId: string, orgId: string): Promise<any[]> {
    const query = `
      MATCH (e {id: $entity_id, org_id: $org_id})
      OPTIONAL MATCH (e)-[r]->(related)
      WITH e, collect({type: type(r), target: related.id, properties: properties(r)}) as outgoing
      OPTIONAL MATCH (e)<-[r]-(related)
      WITH e, outgoing, collect({type: type(r), source: related.id, properties: properties(r)}) as incoming
      
      RETURN {
        outgoing_relationships: outgoing,
        incoming_relationships: incoming,
        total_relationships: size(outgoing) + size(incoming)
      } as relationship_summary
    `;

    const result = await this.neo4j.executeQuery(query, {
      entity_id: entityId,
      org_id: orgId
    }, orgId);

    // For now, return empty array - full relationship analysis would be more complex
    return [];
  }

  /**
   * Calculate overall novelty score
   */
  private calculateNoveltyScore(
    propertyChanges: any[],
    patternDeviations: any[],
    relationshipChanges: any[]
  ): number {
    let score = 0;

    // Weight property changes
    const avgPropertySignificance = propertyChanges.length > 0 
      ? propertyChanges.reduce((sum, change) => sum + change.significance, 0) / propertyChanges.length
      : 0;
    score += avgPropertySignificance * 0.4;

    // Weight pattern deviations
    const avgDeviationScore = patternDeviations.length > 0
      ? patternDeviations.reduce((sum, dev) => sum + dev.deviation_score, 0) / patternDeviations.length
      : 0;
    score += avgDeviationScore * 0.4;

    // Weight relationship changes
    score += relationshipChanges.length > 0 ? 0.2 : 0;

    return Math.min(score, 1.0);
  }

  /**
   * Determine novelty type
   */
  private determineNoveltyType(
    propertyChanges: any[],
    patternDeviations: any[],
    relationshipChanges: any[]
  ): 'new_entity' | 'property_change' | 'relationship_change' | 'pattern_deviation' | 'none' {
    if (patternDeviations.length > 0) return 'pattern_deviation';
    if (relationshipChanges.length > 0) return 'relationship_change';
    if (propertyChanges.length > 0) return 'property_change';
    return 'none';
  }

  /**
   * Determine alert level based on novelty score and type
   */
  private determineAlertLevel(
    noveltyScore: number, 
    noveltyType: string
  ): 'none' | 'info' | 'warning' | 'critical' {
    if (noveltyScore > 0.8) return 'critical';
    if (noveltyScore > 0.6) return 'warning';
    if (noveltyScore > 0.3) return 'info';
    return 'none';
  }

  /**
   * Generate reasoning using LLM
   */
  private async generateReasoning(
    request: NoveltyDetectionRequest,
    propertyChanges: any[],
    patternDeviations: any[]
  ): Promise<string> {
    const prompt = `
      Analyze the following entity changes and provide reasoning for why this might be novel or significant:
      
      Entity: ${request.entityType} (${request.entityId})
      Property Changes: ${JSON.stringify(propertyChanges, null, 2)}
      Pattern Deviations: ${JSON.stringify(patternDeviations, null, 2)}
      
      Provide a brief, clear explanation of what makes this change notable or significant.
    `;

    try {
      const response = await this.llmService.complete([{ role: 'user', content: prompt }], {
        model: 'default',
        temperature: 0.3,
        maxTokens: 200
      });
      return response;
    } catch (error) {
      return `Changes detected in ${propertyChanges.length} properties with ${patternDeviations.length} pattern deviations.`;
    }
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    request: NoveltyDetectionRequest,
    noveltyType: string,
    noveltyScore: number
  ): Promise<string[]> {
    const recommendations = [];

    if (noveltyScore > 0.7) {
      recommendations.push('Review changes carefully for potential data quality issues');
      recommendations.push('Consider if this represents a new business pattern or requirement');
    }

    if (noveltyType === 'pattern_deviation') {
      recommendations.push('Investigate why this entity deviates from established patterns');
      recommendations.push('Update taxonomy rules if this represents a valid new pattern');
    }

    if (noveltyType === 'new_entity') {
      recommendations.push('Ensure all required properties are populated');
      recommendations.push('Verify entity relationships are properly established');
    }

    return recommendations;
  }

  // Helper methods (simplified implementations)
  
  private async checkEntityExists(entityId: string, orgId: string): Promise<boolean> {
    const query = `MATCH (e {id: $entity_id, org_id: $org_id}) RETURN count(e) > 0 as exists`;
    const result = await this.neo4j.executeQuery(query, { entity_id: entityId, org_id: orgId }, orgId);
    return result.records[0]?.get('exists') || false;
  }

  private async getEntityTypeFrequency(entityType: string, orgId: string, projectId?: string): Promise<number> {
    const query = projectId 
      ? `MATCH (e {org_id: $org_id, project_id: $project_id}) WHERE labels(e)[0] = $entity_type RETURN count(e) as frequency`
      : `MATCH (e {org_id: $org_id}) WHERE labels(e)[0] = $entity_type RETURN count(e) as frequency`;
    
    const result = await this.neo4j.executeQuery(query, { 
      entity_type: entityType, 
      org_id: orgId, 
      project_id: projectId 
    }, orgId);
    
    return result.records[0]?.get('frequency') || 0;
  }

  private async calculatePropertySignificance(property: string, value: any, entityId: string, orgId: string): Promise<number> {
    // Simplified significance calculation
    // In a full implementation, this would analyze property importance, rarity, etc.
    return 0.5;
  }

  private async analyzeEntityPatterns(entities: any[], entityType: string): Promise<any[]> {
    // Simplified pattern analysis
    // In a full implementation, this would use statistical analysis to find patterns
    return [];
  }

  private checkPatternDeviation(pattern: any, newProperties: Record<string, any>): any {
    // Simplified deviation check
    return {
      pattern: pattern.name || 'unknown',
      expected: pattern.expected || 'unknown',
      actual: newProperties,
      deviation_score: 0.3
    };
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): string[] {
    return [
      'novelty_detection',
      'pattern_analysis',
      'change_detection',
      'anomaly_detection',
      'entity_analysis',
      'relationship_analysis',
      'statistical_analysis'
    ];
  }

  /**
   * Get agent status
   */
  getStatus(): AgentStatus {
    return {
      name: this.name,
      running: this.running,
      paused: this.paused,
      error: this.lastError,
      startTime: this.startTime,
      lastActivity: this.lastActivity,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs
    }
  }

  protected async onStart(): Promise<void> {
    // Implementation for starting the agent
    console.log(`${this.name} agent started`);
  }

  protected async onStop(): Promise<void> {
    // Implementation for stopping the agent
    console.log(`${this.name} agent stopped`);
  }

  protected async onPause(): Promise<void> {
    // Implementation for pausing the agent
    console.log(`${this.name} agent paused`);
  }

  protected async onResume(): Promise<void> {
    // Implementation for resuming the agent
    console.log(`${this.name} agent resumed`);
  }
}
