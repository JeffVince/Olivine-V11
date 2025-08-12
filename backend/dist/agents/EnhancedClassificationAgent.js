"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedClassificationAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const TaxonomyService_1 = require("../services/TaxonomyService");
const LlmService_1 = require("../services/llm/LlmService");
const Neo4jService_1 = require("../services/Neo4jService");
const MockLlmProvider_1 = require("../services/llm/MockLlmProvider");
class EnhancedClassificationAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService) {
        super('enhanced_classification_agent', queueService, {
            maxRetries: 3,
            retryDelay: 1000,
            healthCheckInterval: 30000,
            enableMonitoring: true,
            logLevel: 'info'
        });
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.llmService = new LlmService_1.LlmService(new MockLlmProvider_1.MockLlmProvider());
        this.neo4j = new Neo4jService_1.Neo4jService();
    }
    async classifyFile(request) {
        try {
            const ruleBasedClassifications = await this.taxonomyService.classifyFile(request.fileId, request.orgId);
            if (ruleBasedClassifications.length > 0 && ruleBasedClassifications[0].confidence >= 0.8) {
                const bestClassification = ruleBasedClassifications[0];
                await this.taxonomyService.applyClassification(request.fileId, bestClassification, request.orgId, request.userId);
                return {
                    fileId: request.fileId,
                    classifications: [bestClassification],
                    confidence: bestClassification.confidence,
                    method: 'rule_based',
                    reasoning: `High-confidence rule-based match for slot: ${bestClassification.slot}`,
                    success: true
                };
            }
            const aiClassification = await this.performAIClassification(request);
            if (aiClassification) {
                await this.taxonomyService.applyClassification(request.fileId, aiClassification, request.orgId, request.userId);
                return {
                    fileId: request.fileId,
                    classifications: [aiClassification],
                    confidence: aiClassification.confidence,
                    method: 'ml_based',
                    reasoning: `AI classification based on content analysis`,
                    success: true
                };
            }
            if (ruleBasedClassifications.length > 0) {
                const hybridClassification = await this.performHybridClassification(request, ruleBasedClassifications);
                if (hybridClassification) {
                    await this.taxonomyService.applyClassification(request.fileId, hybridClassification, request.orgId, request.userId);
                    return {
                        fileId: request.fileId,
                        classifications: [hybridClassification],
                        confidence: hybridClassification.confidence,
                        method: 'hybrid',
                        reasoning: `Hybrid classification combining rule-based and AI analysis`,
                        success: true
                    };
                }
            }
            return {
                fileId: request.fileId,
                classifications: [],
                confidence: 0,
                method: 'rule_based',
                reasoning: 'No suitable classification found',
                success: false,
                error: 'Unable to classify file with sufficient confidence'
            };
        }
        catch (error) {
            console.error('Error classifying file:', error);
            return {
                fileId: request.fileId,
                classifications: [],
                confidence: 0,
                method: 'rule_based',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async performAIClassification(request) {
        try {
            const canonicalSlots = await this.taxonomyService.getCanonicalSlots(request.orgId);
            const slotDescriptions = canonicalSlots.map(slot => `- ${slot.key}: ${slot.description} (Category: ${slot.category})`).join('\n');
            const prompt = `
        You are a file classification expert for a film production company. 
        
        Analyze the following file and determine which canonical slot it belongs to.
        
        File Information:
        - Name: ${request.fileName}
        - Path: ${request.filePath}
        - MIME Type: ${request.mimeType}
        - Size: ${request.size} bytes
        ${request.extractedText ? `- Content Preview: ${request.extractedText.substring(0, 1000)}...` : ''}
        
        Available Canonical Slots:
        ${slotDescriptions}
        
        Based on the file name, path, content, and context, determine:
        1. Which canonical slot this file belongs to (use the exact slot key)
        2. Your confidence level (0.0 to 1.0)
        3. Brief reasoning for your classification
        
        Respond with a JSON object in this format:
        {
          "slot": "SLOT_KEY",
          "confidence": 0.85,
          "reasoning": "This appears to be a shooting script based on the filename and content structure."
        }
        
        If you cannot classify the file with reasonable confidence (>0.5), respond with:
        {
          "slot": null,
          "confidence": 0.0,
          "reasoning": "Unable to determine appropriate classification."
        }
      `;
            const response = await this.llmService.complete([{ role: 'user', content: prompt }], {
                model: 'default',
                temperature: 0.1,
                maxTokens: 500
            });
            const result = JSON.parse(response);
            if (result.slot && result.confidence > 0.5) {
                return {
                    slot: result.slot,
                    confidence: result.confidence,
                    method: 'ml_based',
                    metadata: {
                        reasoning: result.reasoning,
                        ai_model: 'llm_classification'
                    }
                };
            }
            return null;
        }
        catch (error) {
            console.error('Error in AI classification:', error);
            return null;
        }
    }
    async performHybridClassification(request, ruleBasedClassifications) {
        try {
            const topRuleClassification = ruleBasedClassifications[0];
            const prompt = `
        You are validating a file classification made by rule-based system.
        
        File Information:
        - Name: ${request.fileName}
        - Path: ${request.filePath}
        - MIME Type: ${request.mimeType}
        ${request.extractedText ? `- Content Preview: ${request.extractedText.substring(0, 500)}...` : ''}
        
        Rule-based Classification:
        - Slot: ${topRuleClassification.slot}
        - Confidence: ${topRuleClassification.confidence}
        
        Please validate this classification and provide:
        1. Whether you agree with the classification (true/false)
        2. Your confidence in the classification (0.0 to 1.0)
        3. Any adjustments or alternative suggestions
        
        Respond with JSON:
        {
          "agrees": true,
          "confidence": 0.9,
          "reasoning": "The rule-based classification appears correct based on filename patterns."
        }
      `;
            const response = await this.llmService.complete([{ role: 'user', content: prompt }], {
                model: 'default',
                temperature: 0.1,
                maxTokens: 300
            });
            const validation = JSON.parse(response);
            if (validation.agrees && validation.confidence > 0.6) {
                return {
                    slot: topRuleClassification.slot,
                    confidence: Math.min(validation.confidence, topRuleClassification.confidence),
                    method: 'ml_based',
                    metadata: {
                        original_rule_confidence: topRuleClassification.confidence,
                        ai_validation_confidence: validation.confidence,
                        reasoning: validation.reasoning,
                        method: 'hybrid'
                    }
                };
            }
            return null;
        }
        catch (error) {
            console.error('Error in hybrid classification:', error);
            return null;
        }
    }
    async batchClassifyFiles(requests) {
        const results = [];
        const batchSize = 5;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(request => this.classifyFile(request));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + batchSize < requests.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return results;
    }
    async analyzeClassificationPerformance(orgId) {
        try {
            const query = `
        MATCH (f:File {org_id: $org_id})
        OPTIONAL MATCH (f)<-[:FROM]-(ef:EdgeFact {type: 'CLASSIFIED_AS', valid_to: null})-[:TO]->(cs:CanonicalSlot)
        
        WITH 
          count(f) as total_files,
          count(ef) as classified_files,
          collect(DISTINCT cs.key) as used_slots,
          collect(DISTINCT ef.props.method) as classification_methods,
          avg(ef.props.confidence) as avg_confidence
        
        RETURN {
          total_files: total_files,
          classified_files: classified_files,
          classification_rate: toFloat(classified_files) / toFloat(total_files),
          used_slots: used_slots,
          classification_methods: classification_methods,
          avg_confidence: avg_confidence,
          unclassified_files: total_files - classified_files
        } as performance_stats
      `;
            const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
            return result.records[0]?.get('performance_stats') || {};
        }
        catch (error) {
            console.error('Error analyzing classification performance:', error);
            return { error: error instanceof Error ? error.message : String(error) };
        }
    }
    getCapabilities() {
        return [
            'file_classification',
            'rule_based_classification',
            'ai_classification',
            'hybrid_classification',
            'batch_processing',
            'performance_analysis',
            'taxonomy_integration'
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
exports.EnhancedClassificationAgent = EnhancedClassificationAgent;
//# sourceMappingURL=EnhancedClassificationAgent.js.map