"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoveltyDetectionAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const Neo4jService_1 = require("../../services/Neo4jService");
const LlmService_1 = require("../../services/llm/LlmService");
const MockLlmProvider_1 = require("../../services/llm/MockLlmProvider");
const ProvenanceService_1 = require("../../services/provenance/ProvenanceService");
const NoveltyAnalyzer_1 = require("./analysis/NoveltyAnalyzer");
class NoveltyDetectionAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService) {
        super('novelty_detection_agent', queueService, { maxRetries: 3, retryDelay: 1000, healthCheckInterval: 30000, enableMonitoring: true, logLevel: 'info' });
        this.neo4j = new Neo4jService_1.Neo4jService();
        this.provenance = new ProvenanceService_1.ProvenanceService();
        this.llmService = new LlmService_1.LlmService(new MockLlmProvider_1.MockLlmProvider());
        this.analyzer = new NoveltyAnalyzer_1.NoveltyAnalyzer(this.neo4j, this.llmService);
    }
    async detectNovelty(request) {
        try {
            const entityExists = await this.analyzer.checkEntityExists(request.entityId, request.orgId);
            if (!entityExists) {
                return await this.handleNewEntity(request);
            }
            const entityHistory = await this.provenance.getEntityHistory(request.entityId, request.entityType, request.orgId);
            const propertyChanges = await this.analyzer.analyzePropertyChanges(request.entityId, request.newProperties, entityHistory, request.orgId);
            const patternDeviations = await this.analyzer.checkPatternDeviations(request.entityType, request.newProperties, request.orgId);
            const relationshipChanges = await this.analyzer.analyzeRelationshipChanges(request.entityId, request.orgId);
            const noveltyScore = this.analyzer.calculateNoveltyScore(propertyChanges, patternDeviations, relationshipChanges);
            const noveltyType = this.analyzer.determineNoveltyType(propertyChanges, patternDeviations, relationshipChanges);
            const reasoning = await this.analyzer.generateReasoning(request, propertyChanges, patternDeviations);
            const recommendations = await this.generateRecommendations(request, noveltyType, noveltyScore);
            return { isNovel: noveltyScore > 0.3, noveltyScore, noveltyType, detectedChanges: propertyChanges, reasoning, recommendations, alertLevel: this.determineAlertLevel(noveltyScore, noveltyType) };
        }
        catch (error) {
            console.error('Error detecting novelty:', error);
            return { isNovel: false, noveltyScore: 0, noveltyType: 'none', detectedChanges: [], reasoning: `Error analyzing novelty: ${error instanceof Error ? error.message : String(error)}`, alertLevel: 'none' };
        }
    }
    async handleNewEntity(request) {
        const entityTypeFrequency = await this.analyzer.getEntityTypeFrequency(request.entityType, request.orgId, request.context?.projectId);
        const noveltyScore = entityTypeFrequency < 5 ? 0.8 : 0.4;
        return {
            isNovel: true,
            noveltyScore,
            noveltyType: 'new_entity',
            detectedChanges: Object.keys(request.newProperties).map(key => ({ property: key, newValue: request.newProperties[key], changeType: 'added', significance: 0.7 })),
            reasoning: `New ${request.entityType} entity detected. This entity type has appeared ${entityTypeFrequency} times in this context.`,
            recommendations: ['Review entity properties for completeness', 'Ensure proper classification and relationships', 'Consider if this represents a new pattern or category'],
            alertLevel: noveltyScore > 0.7 ? 'warning' : 'info'
        };
    }
    determineAlertLevel(noveltyScore, _noveltyType) {
        if (noveltyScore > 0.8)
            return 'critical';
        if (noveltyScore > 0.6)
            return 'warning';
        if (noveltyScore > 0.3)
            return 'info';
        return 'none';
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
    getCapabilities() {
        return ['novelty_detection', 'pattern_analysis', 'change_detection', 'anomaly_detection', 'entity_analysis', 'relationship_analysis', 'statistical_analysis'];
    }
    getStatus() {
        return { name: this.name, running: this.running, paused: this.paused, error: this.lastError, startTime: this.startTime, lastActivity: this.lastActivity, processedJobs: this.processedJobs, failedJobs: this.failedJobs };
    }
    async onStart() { console.log(`${this.name} agent started`); }
    async onStop() { console.log(`${this.name} agent stopped`); }
    async onPause() { console.log(`${this.name} agent paused`); }
    async onResume() { console.log(`${this.name} agent resumed`); }
}
exports.NoveltyDetectionAgent = NoveltyDetectionAgent;
__exportStar(require("./types"), exports);
__exportStar(require("./analysis/NoveltyAnalyzer"), exports);
//# sourceMappingURL=index.js.map