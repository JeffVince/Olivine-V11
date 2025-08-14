import { Neo4jService } from '../../../services/Neo4jService'
import { LlmService } from '../../../services/llm/LlmService'
import { NoveltyDetectionRequest, NoveltyResult } from '../types'

export class NoveltyAnalyzer {
  private neo4j: Neo4jService
  private llmService: LlmService

  constructor(neo4j: Neo4jService, llmService: LlmService) {
    this.neo4j = neo4j
    this.llmService = llmService
  }

  async checkEntityExists(entityId: string, orgId: string): Promise<boolean> {
    const query = `MATCH (e {id: $entity_id, org_id: $org_id}) RETURN count(e) > 0 as exists`
    const result = await this.neo4j.executeQuery(query, { entity_id: entityId, org_id: orgId }, orgId)
    return result.records[0]?.get('exists') || false
  }

  async getEntityTypeFrequency(entityType: string, orgId: string, projectId?: string): Promise<number> {
    const query = projectId
      ? `MATCH (e {org_id: $org_id, project_id: $project_id}) WHERE labels(e)[0] = $entity_type RETURN count(e) as frequency`
      : `MATCH (e {org_id: $org_id}) WHERE labels(e)[0] = $entity_type RETURN count(e) as frequency`
    const result = await this.neo4j.executeQuery(query, { entity_type: entityType, org_id: orgId, project_id: projectId }, orgId)
    return result.records[0]?.get('frequency') || 0
  }

  async getEntityHistory(entityId: string, entityType: string, orgId: string): Promise<any[]> {
    // Placeholder for provenance service integration
    return []
  }

  async analyzePropertyChanges(entityId: string, newProperties: Record<string, any>, entityHistory: any[], orgId: string): Promise<Array<{ property: string; oldValue?: any; newValue: any; changeType: 'added' | 'modified' | 'removed'; significance: number }>> {
    const changes: Array<{ property: string; oldValue?: any; newValue: any; changeType: 'added' | 'modified' | 'removed'; significance: number }> = []
    if (entityHistory.length === 0) {
      return Object.keys(newProperties).map(key => ({ property: key, newValue: newProperties[key], changeType: 'added' as const, significance: 0.6 }))
    }
    const latestVersion = entityHistory[entityHistory.length - 1]
    const oldProperties = latestVersion.props || {}
    for (const [key, newValue] of Object.entries(newProperties)) {
      if (!(key in oldProperties)) {
        changes.push({ property: key, newValue, changeType: 'added', significance: await this.calculatePropertySignificance(key, newValue, entityId, orgId) })
      } else if (JSON.stringify(oldProperties[key]) !== JSON.stringify(newValue)) {
        changes.push({ property: key, oldValue: oldProperties[key], newValue, changeType: 'modified', significance: await this.calculatePropertySignificance(key, newValue, entityId, orgId) })
      }
    }
    for (const key of Object.keys(oldProperties)) {
      if (!(key in newProperties)) {
        changes.push({ property: key, oldValue: oldProperties[key], newValue: undefined, changeType: 'removed', significance: 0.8 })
      }
    }
    return changes
  }

  private async calculatePropertySignificance(_property: string, _value: any, _entityId: string, _orgId: string): Promise<number> {
    return 0.5
  }

  async checkPatternDeviations(entityType: string, newProperties: Record<string, any>, orgId: string): Promise<Array<{ pattern: string; expected: any; actual: any; deviation_score: number }>> {
    const query = `
      MATCH (e {org_id: $org_id})
      WHERE labels(e)[0] = $entity_type
      RETURN 
        count(e) as entity_count,
        collect(e) as entities
    `
    const result = await this.neo4j.executeQuery(query, { org_id: orgId, entity_type: entityType }, orgId)
    const entities = result.records[0]?.get('entities') || []
    if (entities.length < 10) return []
    // Simplified deviation detection
    return []
  }

  async analyzeRelationshipChanges(entityId: string, orgId: string): Promise<any[]> {
    const query = `
      MATCH (e {id: $entity_id, org_id: $org_id})
      OPTIONAL MATCH (e)-[r]->(related)
      WITH e, collect({type: type(r), target: related.id, properties: properties(r)}) as outgoing
      OPTIONAL MATCH (e)<-[r]-(related)
      WITH e, outgoing, collect({type: type(r), source: related.id, properties: properties(r)}) as incoming
      RETURN { outgoing_relationships: outgoing, incoming_relationships: incoming, total_relationships: size(outgoing) + size(incoming) } as relationship_summary
    `
    await this.neo4j.executeQuery(query, { entity_id: entityId, org_id: orgId }, orgId)
    return []
  }

  calculateNoveltyScore(propertyChanges: any[], patternDeviations: any[], relationshipChanges: any[]): number {
    let score = 0
    const avgPropertySignificance = propertyChanges.length > 0 ? propertyChanges.reduce((sum, change) => sum + change.significance, 0) / propertyChanges.length : 0
    score += avgPropertySignificance * 0.4
    const avgDeviationScore = patternDeviations.length > 0 ? patternDeviations.reduce((sum, dev) => sum + dev.deviation_score, 0) / patternDeviations.length : 0
    score += avgDeviationScore * 0.4
    score += relationshipChanges.length > 0 ? 0.2 : 0
    return Math.min(score, 1.0)
  }

  determineNoveltyType(propertyChanges: any[], patternDeviations: any[], relationshipChanges: any[]): NoveltyResult['noveltyType'] {
    if (patternDeviations.length > 0) return 'pattern_deviation'
    if (relationshipChanges.length > 0) return 'relationship_change'
    if (propertyChanges.length > 0) return 'property_change'
    return 'none'
  }

  async generateReasoning(request: NoveltyDetectionRequest, propertyChanges: any[], patternDeviations: any[]): Promise<string> {
    const prompt = `Analyze the following entity changes and provide reasoning for why this might be novel or significant:\n\nEntity: ${request.entityType} (${request.entityId})\nProperty Changes: ${JSON.stringify(propertyChanges, null, 2)}\nPattern Deviations: ${JSON.stringify(patternDeviations, null, 2)}\n\nProvide a brief, clear explanation of what makes this change notable or significant.`
    try {
      const response = await this.llmService.complete([{ role: 'user', content: prompt }], { model: 'default', temperature: 0.3, maxTokens: 200 })
      return response
    } catch {
      return `Changes detected in ${propertyChanges.length} properties with ${patternDeviations.length} pattern deviations.`
    }
  }
}


