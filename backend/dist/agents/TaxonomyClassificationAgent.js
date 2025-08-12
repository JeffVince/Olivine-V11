"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxonomyClassificationAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const ClassificationService_1 = require("../services/classification/ClassificationService");
const PostgresService_1 = require("../services/PostgresService");
const Neo4jService_1 = require("../services/Neo4jService");
const TaxonomyService_1 = require("../services/TaxonomyService");
const uuid_1 = require("uuid");
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
    async onStop() {
        this.logger.info('Stopping TaxonomyClassificationAgent...');
    }
    async onPause() {
        this.logger.info('Pausing TaxonomyClassificationAgent...');
    }
    async onResume() {
        this.logger.info('Resuming TaxonomyClassificationAgent...');
    }
    async classifyFile(jobData) {
        const { orgId, fileId, filePath, metadata } = jobData;
        this.validateContext({ orgId });
        this.logger.info(`Classifying file: ${filePath}`, { orgId, fileId });
        try {
            await this.loadTaxonomyRules(orgId);
            const fileData = await this.getFileData(orgId, fileId, filePath, metadata);
            let classificationResult = await this.performRuleBasedClassification(orgId, fileData);
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
            await this.updateFileClassification(fileId, {
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
    async performRuleBasedClassification(orgId, fileData) {
        const rules = this.taxonomyRules.get(orgId) || [];
        for (const rule of rules) {
            if (await this.evaluateRule(rule, fileData)) {
                return {
                    slotKey: rule.slotKey,
                    confidence: await this.calculateConfidence(rule, fileData),
                    ruleId: rule.id,
                    method: 'taxonomy',
                    metadata: {
                        ruleName: rule.matchPattern,
                        priority: rule.priority
                    }
                };
            }
        }
        return {
            slotKey: 'UNCLASSIFIED',
            confidence: 0,
            ruleId: undefined,
            method: 'default'
        };
    }
    async evaluateRule(rule, fileData) {
        if (rule.fileType && !fileData.mimeType.startsWith(rule.fileType)) {
            return false;
        }
        for (const condition of rule.conditions) {
            if (!await this.evaluateCondition(condition, fileData)) {
                return false;
            }
        }
        return true;
    }
    async evaluateCondition(condition, fileData) {
        let fieldValue;
        switch (condition.type) {
            case 'filename':
                fieldValue = fileData.name;
                break;
            case 'path':
                fieldValue = fileData.path;
                break;
            case 'size':
                fieldValue = fileData.size;
                break;
            case 'mime_type':
                fieldValue = fileData.mimeType;
                break;
            case 'content':
                fieldValue = fileData.extractedText || '';
                break;
            default:
                this.logger.warn(`Unknown condition type: ${condition.type}`);
                return false;
        }
        return this.applyOperator(condition.operator, fieldValue, condition.value, condition.caseSensitive);
    }
    applyOperator(operator, fieldValue, conditionValue, caseSensitive = true) {
        if (fieldValue == null) {
            return false;
        }
        switch (operator) {
            case 'matches':
                const regex = new RegExp(conditionValue, caseSensitive ? 'g' : 'gi');
                return regex.test(String(fieldValue));
            case 'contains':
                const searchValue = caseSensitive ? String(conditionValue) : String(conditionValue).toLowerCase();
                const searchField = caseSensitive ? String(fieldValue) : String(fieldValue).toLowerCase();
                return searchField.includes(searchValue);
            case 'equals':
                return String(fieldValue) === String(conditionValue);
            case 'greater_than':
                return Number(fieldValue) > Number(conditionValue);
            case 'less_than':
                return Number(fieldValue) < Number(conditionValue);
            default:
                this.logger.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }
    async calculateConfidence(rule, fileData) {
        const totalConditions = rule.conditions.length;
        if (totalConditions === 0) {
            return 0.5;
        }
        let matchingConditions = 0;
        for (const condition of rule.conditions) {
            if (await this.evaluateCondition(condition, fileData)) {
                matchingConditions++;
            }
        }
        const baseConfidence = matchingConditions / totalConditions;
        const priorityBonus = Math.min(rule.priority / 100, 0.2);
        return Math.min(baseConfidence + priorityBonus, 1.0);
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
            return this.getDefaultClassification(fileData);
        }
    }
    getDefaultClassification(fileData) {
        const mimeType = fileData.mimeType;
        let slotKey = 'UNCLASSIFIED';
        let confidence = 0.3;
        if (mimeType.startsWith('image/')) {
            slotKey = 'IMAGES';
            confidence = 0.7;
        }
        else if (mimeType.startsWith('video/')) {
            slotKey = 'VIDEOS';
            confidence = 0.7;
        }
        else if (mimeType.startsWith('audio/')) {
            slotKey = 'AUDIO';
            confidence = 0.7;
        }
        else if (mimeType === 'application/pdf') {
            slotKey = 'DOCUMENTS';
            confidence = 0.6;
        }
        else if (mimeType.includes('document') || mimeType.includes('sheet')) {
            slotKey = 'DOCUMENTS';
            confidence = 0.6;
        }
        else if (mimeType.startsWith('text/')) {
            slotKey = 'TEXT_FILES';
            confidence = 0.6;
        }
        return {
            slotKey,
            confidence,
            method: 'default',
            metadata: {
                reason: 'MIME type based classification',
                mimeType
            }
        };
    }
    async updateFileClassification(fileId, classification) {
        const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.classification_status = $status,
        f.classification_confidence = $confidence,
        f.classification_method = $method,
        f.classification_metadata = $metadata,
        f.classified_at = datetime()
      RETURN f
    `;
        await this.neo4jService.run(query, {
            fileId,
            status: classification.status,
            confidence: classification.confidence,
            method: classification.method,
            metadata: JSON.stringify(classification.metadata || {})
        });
    }
}
exports.TaxonomyClassificationAgent = TaxonomyClassificationAgent;
//# sourceMappingURL=TaxonomyClassificationAgent.js.map