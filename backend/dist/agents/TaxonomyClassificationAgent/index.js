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
exports.TaxonomyClassificationAgent = void 0;
const BaseAgent_1 = require("../BaseAgent");
const ClassificationService_1 = require("../../services/classification/ClassificationService");
const PostgresService_1 = require("../../services/PostgresService");
const Neo4jService_1 = require("../../services/Neo4jService");
const TaxonomyService_1 = require("../../services/TaxonomyService");
const uuid_1 = require("uuid");
const RuleEngine_1 = require("./classification/RuleEngine");
const ClassificationRepository_1 = require("./graph/ClassificationRepository");
class TaxonomyClassificationAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService, config) {
        super('taxonomy-classification-agent', queueService, {
            maxRetries: 2,
            retryDelay: 1500,
            healthCheckInterval: 30000,
            enableMonitoring: true,
            logLevel: 'info',
            ...config
        });
        this.taxonomyRules = new Map();
        this.classificationService = new ClassificationService_1.ClassificationService(new PostgresService_1.PostgresService());
        this.postgresService = new PostgresService_1.PostgresService();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.ruleEngine = new RuleEngine_1.RuleEngine();
        this.classificationRepo = new ClassificationRepository_1.ClassificationRepository(this.neo4jService);
    }
    async onStart() {
        this.logger.info('Starting TaxonomyClassificationAgent...');
        this.queueService.registerWorker('file-classification', async (job) => {
            const context = {
                orgId: job.data.orgId,
                sessionId: (0, uuid_1.v4)()
            };
            await this.executeJob('classifyFile', job.data, context, () => this.classifyFile(job.data));
        });
        this.logger.info('TaxonomyClassificationAgent started successfully');
    }
    async onStop() { this.logger.info('Stopping TaxonomyClassificationAgent...'); }
    async onPause() { this.logger.info('Pausing TaxonomyClassificationAgent...'); }
    async onResume() { this.logger.info('Resuming TaxonomyClassificationAgent...'); }
    async classifyFile(jobData) {
        const { orgId, fileId, filePath, metadata } = jobData;
        this.validateContext({ orgId });
        this.logger.info(`Classifying file: ${filePath}`, { orgId, fileId });
        try {
            await this.loadTaxonomyRules(orgId);
            const fileData = await this.getFileData(orgId, fileId, filePath, metadata);
            const rules = this.taxonomyRules.get(orgId) || [];
            let classificationResult = await this.ruleEngine.performRuleBasedClassification(rules, fileData);
            if (classificationResult.slotKey === 'UNCLASSIFIED') {
                classificationResult = await this.performMLClassification(orgId, fileData);
            }
            await this.taxonomyService.applyClassification(fileId, {
                slot: classificationResult.slotKey,
                confidence: classificationResult.confidence,
                method: classificationResult.method === 'taxonomy' ? 'rule_based' : classificationResult.method === 'ml' ? 'ml_based' : 'manual',
                rule_id: classificationResult.ruleId,
                metadata: classificationResult.metadata
            }, orgId, 'system');
            await this.classificationRepo.updateFileClassification(fileId, {
                status: 'classified',
                confidence: classificationResult.confidence,
                method: classificationResult.method,
                metadata: classificationResult.metadata
            });
            const commitId = await this.createCommit(orgId, `Classified file: ${filePath} as ${classificationResult.slotKey}`, {
                fileId,
                classification: classificationResult,
                method: classificationResult.method
            });
            this.logger.info(`File classified successfully: ${filePath}`, {
                slotKey: classificationResult.slotKey,
                confidence: classificationResult.confidence,
                method: classificationResult.method
            });
            return classificationResult;
        }
        catch (error) {
            this.logger.error(`Failed to classify file: ${filePath}`, error);
            throw error;
        }
    }
    async loadTaxonomyRules(orgId) {
        if (this.taxonomyRules.has(orgId)) {
            return;
        }
        const query = `
      SELECT 
        tr.*,
        tp.name as profile_name
      FROM taxonomy_rules tr
      JOIN taxonomy_profiles tp ON tr.profile_id = tp.id
      WHERE tr.org_id = $1 AND tr.enabled = true AND tp.active = true
      ORDER BY tr.priority ASC
    `;
        try {
            const result = await this.postgresService.executeQuery(query, [orgId]);
            this.taxonomyRules.set(orgId, result.rows);
            this.logger.debug(`Loaded ${result.rows.length} taxonomy rules for org ${orgId}`);
        }
        catch (error) {
            this.logger.error(`Failed to load taxonomy rules for org ${orgId}`, error);
            this.taxonomyRules.set(orgId, []);
        }
    }
    async getFileData(orgId, fileId, filePath, metadata) {
        if (metadata) {
            return {
                id: fileId,
                name: metadata.name,
                path: filePath,
                size: metadata.size,
                mimeType: metadata.mimeType,
                extractedText: '',
                metadata
            };
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
    `;
        const result = await this.postgresService.executeQuery(query, [fileId, orgId]);
        if (result.rows.length === 0) {
            throw new Error(`File not found: ${fileId}`);
        }
        const file = result.rows[0];
        return {
            id: file.id,
            name: file.name,
            path: file.path,
            size: file.size,
            mimeType: file.mime_type,
            extractedText: file.extracted_text || '',
            metadata: file.metadata || {}
        };
    }
    async performMLClassification(orgId, fileData) {
        try {
            const result = await this.classificationService.classify(orgId, {
                name: fileData.name || fileData.path.split('/').pop() || 'unknown',
                path: fileData.path,
                mimeType: fileData.mimeType,
                size: fileData.size,
                extractedText: fileData.extractedText
            });
            return {
                slotKey: result.slotKey || 'UNCLASSIFIED',
                confidence: result.confidence || 0.3,
                method: 'ml',
                metadata: {
                    ruleId: result.ruleId,
                    method: result.method
                }
            };
        }
        catch (error) {
            this.logger.error('ML classification failed, using default classification', error);
            return this.ruleEngine.getDefaultClassification(fileData);
        }
    }
}
exports.TaxonomyClassificationAgent = TaxonomyClassificationAgent;
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map