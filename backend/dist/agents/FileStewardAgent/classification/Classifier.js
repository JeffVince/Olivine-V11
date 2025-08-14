"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Classifier = void 0;
const path_1 = __importDefault(require("path"));
const ClassificationService_1 = require("../../../services/classification/ClassificationService");
const TaxonomyService_1 = require("../../../services/TaxonomyService");
class Classifier {
    constructor(postgres, neo4j) {
        this.classificationService = new ClassificationService_1.ClassificationService(postgres);
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.postgres = postgres;
        this.neo4j = neo4j;
    }
    async createSlotEdgeFact(fileId, slot, confidence, ruleId, orgId) {
        const query = `
      MATCH (f:File {id: $fileId})
      CREATE (ef:EdgeFact {
        id: randomUUID(),
        type: 'FILLS_SLOT',
        slot: $slot,
        confidence: $confidence,
        ruleId: $ruleId,
        method: 'taxonomy_rule',
        orgId: $orgId,
        createdAt: datetime(),
        validFrom: datetime(),
        validTo: null
      })
      CREATE (f)<-[:FILLS_SLOT]-(ef)
      RETURN ef.id as edgeFactId
    `;
        await this.neo4j.run(query, { fileId, slot, confidence, ruleId, orgId });
    }
    async classifyAndApply(params) {
        const { orgId, fileId, filePath, metadata, fileContent, classificationRepo } = params;
        const result = await this.classificationService.classify(orgId, {
            name: path_1.default.basename(filePath),
            path: filePath,
            mimeType: metadata?.mimeType,
            size: metadata?.size,
            extractedText: fileContent
        });
        const taxonomyClassification = {
            slot: result.slotKey,
            confidence: result.confidence,
            method: result.method === 'taxonomy' ? 'rule_based' : 'ml_based',
            rule_id: result.ruleId || undefined,
            metadata: {}
        };
        await this.taxonomyService.applyClassification(fileId, taxonomyClassification, orgId, 'system');
        await classificationRepo.updateFileClassification(fileId, {
            status: 'classified',
            confidence: result.confidence,
            metadata: { method: result.method, ruleId: result.ruleId, slotKey: result.slotKey }
        });
        return result;
    }
    async performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata) {
        const slots = [];
        try {
            try {
                const classifications = await this.taxonomyService.classifyFile(fileId, orgId);
                for (const c of classifications) {
                    if (!slots.includes(c.slot))
                        slots.push(c.slot);
                    await this.createSlotEdgeFact(fileId, c.slot, c.confidence ?? 0.7, c.rule_id || 'taxonomy', orgId);
                }
            }
            catch { }
            if (slots.length === 0) {
                const rules = await this.getApplicableTaxonomyRules(orgId, fileMetadata);
                for (const rule of rules) {
                    const confidence = this.calculateRuleConfidence(rule, fileMetadata, resourcePath);
                    const minConf = rule.min_confidence ?? (rule.minConfidence ?? 0);
                    if (confidence >= minConf) {
                        slots.push(rule.slot);
                        await this.createSlotEdgeFact(fileId, rule.slot, confidence, rule.id, orgId);
                    }
                }
            }
            const fileName = path_1.default.basename(resourcePath).toLowerCase();
            if ((fileName.endsWith('.fdx') || fileName.includes('script')) && !slots.includes('SCRIPT_PRIMARY')) {
                slots.push('SCRIPT_PRIMARY');
                await this.createSlotEdgeFact(fileId, 'SCRIPT_PRIMARY', 0.9, 'filename_heuristic', orgId);
            }
            if (slots.length === 0) {
                const fallbackSlot = this.getFallbackSlot(fileMetadata.mimeType);
                if (fallbackSlot) {
                    slots.push(fallbackSlot);
                    await this.createSlotEdgeFact(fileId, fallbackSlot, 0.5, 'fallback', orgId);
                }
            }
            return slots;
        }
        catch {
            return [];
        }
    }
    async getApplicableTaxonomyRules(orgId, fileMetadata) {
        const result = await this.postgres.query(`
      SELECT * FROM parser_registry 
      WHERE org_id = $1 
      AND (mime_type = $2 OR mime_type = '*/*')
      AND enabled = true
      ORDER BY min_confidence DESC
    `, [orgId, fileMetadata.mimeType]);
        return result.rows;
    }
    calculateRuleConfidence(rule, fileMetadata, resourcePath) {
        let confidence = 0.7;
        if (rule.mime_type === fileMetadata.mimeType)
            confidence += 0.2;
        const fileName = path_1.default.basename(resourcePath).toLowerCase();
        if (rule.slot === 'SCRIPT_PRIMARY' && (fileName.includes('script') || fileName.endsWith('.fdx')))
            confidence += 0.1;
        if (rule.slot === 'BUDGET_MASTER' && fileMetadata.size > 100000)
            confidence += 0.05;
        return Math.min(confidence, 1.0);
    }
    getFallbackSlot(mimeType) {
        const fallbackMap = {
            'application/pdf': 'DOCUMENT_GENERAL',
            'image/jpeg': 'MEDIA_IMAGE',
            'image/png': 'MEDIA_IMAGE',
            'video/mp4': 'MEDIA_VIDEO',
            'audio/mpeg': 'MEDIA_AUDIO',
            'text/plain': 'DOCUMENT_TEXT'
        };
        return fallbackMap[mimeType] || 'FILE_UNCLASSIFIED';
    }
}
exports.Classifier = Classifier;
//# sourceMappingURL=Classifier.js.map