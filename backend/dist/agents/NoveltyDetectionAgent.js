"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoveltyDetectionAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const Neo4jService_1 = require("../services/Neo4jService");
const LlmService_1 = require("../services/llm/LlmService");
const MockLlmProvider_1 = require("../services/llm/MockLlmProvider");
const ProvenanceService_1 = require("../services/provenance/ProvenanceService");
class NoveltyDetectionAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService) {
        super('novelty_detection_agent', queueService, {
            maxRetries: 3,
            retryDelay: 1000,
            healthCheckInterval: 30000,
            enableMonitoring: true,
            logLevel: 'info'
        });
        this.neo4j = new Neo4jService_1.Neo4jService();
        this.provenance = new ProvenanceService_1.ProvenanceService();
        this.llmService = new LlmService_1.LlmService(new MockLlmProvider_1.MockLlmProvider());
    }
    async detectNovelty(request) {
        try {
            const entityExists = await this.checkEntityExists(request.entityId, request.orgId);
            if (!entityExists) {
                return await this.handleNewEntity(request);
            }
            const entityHistory = await this.provenance.getEntityHistory(request.entityId, request.entityType, request.orgId);
            const propertyChanges = await this.analyzePropertyChanges(request.entityId, request.newProperties, entityHistory, request.orgId);
            const patternDeviations = await this.checkPatternDeviations(request.entityType, request.newProperties, request.orgId);
            const relationshipChanges = await this.analyzeRelationshipChanges(request.entityId, request.orgId);
            const noveltyScore = this.calculateNoveltyScore(propertyChanges, patternDeviations, relationshipChanges);
            const noveltyType = this.determineNoveltyType(propertyChanges, patternDeviations, relationshipChanges);
            const alertLevel = this.determineAlertLevel(noveltyScore, noveltyType);
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
        }
        catch (error) {
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
    async handleNewEntity(request) {
        const entityTypeFrequency = await this.getEntityTypeFrequency(request.entityType, request.orgId, request.context?.projectId);
        const noveltyScore = entityTypeFrequency < 5 ? 0.8 : 0.4;
        return {
            isNovel: true,
            noveltyScore,
            noveltyType: 'new_entity',
            detectedChanges: Object.keys(request.newProperties).map(key => ({
                property: key,
                newValue: request.newProperties[key],
                changeType: 'added',
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
    async analyzePropertyChanges(entityId, newProperties, entityHistory, orgId) {
        const changes = [];
        if (entityHistory.length === 0) {
            return Object.keys(newProperties).map(key => ({
                property: key,
                newValue: newProperties[key],
                changeType: 'added',
                significance: 0.6
            }));
        }
        const latestVersion = entityHistory[entityHistory.length - 1];
        const oldProperties = latestVersion.props || {};
        for (const [key, newValue] of Object.entries(newProperties)) {
            if (!(key in oldProperties)) {
                changes.push({
                    property: key,
                    newValue,
                    changeType: 'added',
                    significance: await this.calculatePropertySignificance(key, newValue, entityId, orgId)
                });
            }
            else if (JSON.stringify(oldProperties[key]) !== JSON.stringify(newValue)) {
                changes.push({
                    property: key,
                    oldValue: oldProperties[key],
                    newValue,
                    changeType: 'modified',
                    significance: await this.calculatePropertySignificance(key, newValue, entityId, orgId)
                });
            }
        }
        for (const key of Object.keys(oldProperties)) {
            if (!(key in newProperties)) {
                changes.push({
                    property: key,
                    oldValue: oldProperties[key],
                    newValue: undefined,
                    changeType: 'removed',
                    significance: 0.8
                });
            }
        }
        return changes;
    }
    async checkPatternDeviations(entityType, newProperties, orgId) {
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
            return [];
        }
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
    async analyzeRelationshipChanges(entityId, orgId) {
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
        return [];
    }
    calculateNoveltyScore(propertyChanges, patternDeviations, relationshipChanges) {
        let score = 0;
        const avgPropertySignificance = propertyChanges.length > 0
            ? propertyChanges.reduce((sum, change) => sum + change.significance, 0) / propertyChanges.length
            : 0;
        score += avgPropertySignificance * 0.4;
        const avgDeviationScore = patternDeviations.length > 0
            ? patternDeviations.reduce((sum, dev) => sum + dev.deviation_score, 0) / patternDeviations.length
            : 0;
        score += avgDeviationScore * 0.4;
        score += relationshipChanges.length > 0 ? 0.2 : 0;
        return Math.min(score, 1.0);
    }
    determineNoveltyType(propertyChanges, patternDeviations, relationshipChanges) {
        if (patternDeviations.length > 0)
            return 'pattern_deviation';
        if (relationshipChanges.length > 0)
            return 'relationship_change';
        if (propertyChanges.length > 0)
            return 'property_change';
        return 'none';
    }
    determineAlertLevel(noveltyScore, noveltyType) {
        if (noveltyScore > 0.8)
            return 'critical';
        if (noveltyScore > 0.6)
            return 'warning';
        if (noveltyScore > 0.3)
            return 'info';
        return 'none';
    }
    async generateReasoning(request, propertyChanges, patternDeviations) {
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
        }
        catch (error) {
            return `Changes detected in ${propertyChanges.length} properties with ${patternDeviations.length} pattern deviations.`;
        }
    }
    async generateRecommendations(request, noveltyType, noveltyScore) {
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
    async checkEntityExists(entityId, orgId) {
        const query = `MATCH (e {id: $entity_id, org_id: $org_id}) RETURN count(e) > 0 as exists`;
        const result = await this.neo4j.executeQuery(query, { entity_id: entityId, org_id: orgId }, orgId);
        return result.records[0]?.get('exists') || false;
    }
    async getEntityTypeFrequency(entityType, orgId, projectId) {
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
    async calculatePropertySignificance(property, value, entityId, orgId) {
        return 0.5;
    }
    async analyzeEntityPatterns(entities, entityType) {
        return [];
    }
    checkPatternDeviation(pattern, newProperties) {
        return {
            pattern: pattern.name || 'unknown',
            expected: pattern.expected || 'unknown',
            actual: newProperties,
            deviation_score: 0.3
        };
    }
    getCapabilities() {
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
    getStatus() {
        return {
            name: this.name,
            running: this.running,
            paused: this.paused,
            error: this.lastError,
            startTime: this.startTime,
            lastActivity: this.lastActivity,
            processedJobs: this.processedJobs,
            failedJobs: this.failedJobs
        };
    }
    async onStart() {
        console.log(`${this.name} agent started`);
    }
    async onStop() {
        console.log(`${this.name} agent stopped`);
    }
    async onPause() {
        console.log(`${this.name} agent paused`);
    }
    async onResume() {
        console.log(`${this.name} agent resumed`);
    }
}
exports.NoveltyDetectionAgent = NoveltyDetectionAgent;
//# sourceMappingURL=NoveltyDetectionAgent.js.map