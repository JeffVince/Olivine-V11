"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentExtractionService = void 0;
const BaseService_1 = require("../BaseService");
const crypto_1 = __importDefault(require("crypto"));
const AgentRegistry_1 = require("../../agents/extraction/AgentRegistry");
class ContentExtractionService extends BaseService_1.BaseService {
    constructor(postgresService, neo4jService, queueService) {
        super('ContentExtractionService');
        this.parsers = new Map();
        this.postgresService = postgresService;
        this.neo4jService = neo4jService;
        this.queueService = queueService;
        this.agentRegistry = new AgentRegistry_1.AgentRegistry();
        this.initializeParsers();
    }
    initializeParsers() {
        this.parsers.set('script-parser-v1', {
            name: 'script-parser-v1',
            version: '1.0.0',
            supportedMimeTypes: ['application/pdf', 'text/plain', 'application/x-fountain'],
            extract: this.extractScriptContent.bind(this)
        });
        this.parsers.set('budget-parser-v1', {
            name: 'budget-parser-v1',
            version: '1.0.0',
            supportedMimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
            extract: this.extractBudgetContent.bind(this)
        });
        this.parsers.set('callsheet-parser-v1', {
            name: 'callsheet-parser-v1',
            version: '1.0.0',
            supportedMimeTypes: ['application/pdf', 'text/plain'],
            extract: this.extractCallSheetContent.bind(this)
        });
    }
    async processExtractionJob(jobData) {
        const { jobId, orgId, fileId, slot, parser, parserVersion, metadata } = jobData;
        this.logger.info(`Processing extraction job: ${jobId}`, { orgId, fileId, slot, parser });
        try {
            await this.updateJobStatus(jobId, 'running');
            const fileContent = await this.getFileContent(fileId);
            let extractionResult;
            const parserInstance = this.parsers.get(parser);
            if (!parserInstance) {
                throw new Error(`Parser not found: ${parser}`);
            }
            extractionResult = await parserInstance.extract(fileContent, metadata);
            const overallConfidence = this.calculateOverallConfidence(extractionResult);
            await this.storeExtractedEntities(jobId, extractionResult.entities);
            await this.storeExtractedLinks(jobId, extractionResult.links);
            await this.updateJobStatus(jobId, 'completed', {
                entitiesCount: extractionResult.entities.length,
                linksCount: extractionResult.links.length,
                confidence: overallConfidence,
                metadata: extractionResult.metadata
            });
            const shouldAutoPromote = await this.shouldAutoPromote(orgId, slot, overallConfidence);
            if (shouldAutoPromote) {
                await this.queueService.addJob('content-promotion', 'promote-extraction', {
                    jobId,
                    orgId,
                    actor: 'system',
                    autoPromoted: true
                });
            }
            this.logger.info(`Extraction job completed: ${jobId}`, {
                entitiesCount: extractionResult.entities.length,
                linksCount: extractionResult.links.length,
                confidence: overallConfidence
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.error(`Extraction job failed: ${jobId}`, { error: message });
            await this.updateJobStatus(jobId, 'failed', { error: message });
            throw error;
        }
    }
    async storeExtractedEntities(jobId, entities) {
        for (const entity of entities) {
            const hash = this.calculateEntityHash(entity);
            await this.postgresService.query(`
        INSERT INTO extracted_entity_temp (job_id, kind, raw_json, hash, confidence, source_offset)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (job_id, hash) DO UPDATE SET
          raw_json = EXCLUDED.raw_json,
          confidence = EXCLUDED.confidence,
          source_offset = EXCLUDED.source_offset
      `, [jobId, entity.kind, JSON.stringify(entity.data), hash, entity.confidence, entity.sourceOffset]);
        }
    }
    async storeExtractedLinks(jobId, links) {
        for (const link of links) {
            await this.postgresService.query(`
        INSERT INTO extracted_link_temp (job_id, from_hash, to_hash, rel_type, raw_json, confidence)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (job_id, from_hash, to_hash, rel_type) DO UPDATE SET
          raw_json = EXCLUDED.raw_json,
          confidence = EXCLUDED.confidence
      `, [jobId, link.fromHash, link.toHash, link.relType, JSON.stringify(link.data), link.confidence]);
        }
    }
    async updateJobStatus(jobId, status, metadata) {
        const updateFields = ['status = $2'];
        const values = [jobId, status];
        if (status === 'completed' || status === 'failed') {
            updateFields.push('completed_at = NOW()');
        }
        if (metadata) {
            updateFields.push(`metadata = $${values.length + 1}`);
            values.push(JSON.stringify(metadata));
        }
        await this.postgresService.query(`
      UPDATE extraction_job 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `, values);
    }
    calculateEntityHash(entity) {
        const normalized = {
            kind: entity.kind,
            data: this.normalizeEntityData(entity.data)
        };
        return crypto_1.default.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    }
    normalizeEntityData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        const normalized = {};
        const keys = Object.keys(data).sort();
        for (const key of keys) {
            if (key === 'id' || key === 'createdAt' || key === 'updatedAt') {
                continue;
            }
            normalized[key] = this.normalizeEntityData(data[key]);
        }
        return normalized;
    }
    calculateOverallConfidence(result) {
        if (result.entities.length === 0 && result.links.length === 0) {
            return 0;
        }
        const entityConfidence = result.entities.reduce((sum, entity) => sum + entity.confidence, 0) / result.entities.length;
        const linkConfidence = result.links.reduce((sum, link) => sum + link.confidence, 0) / result.links.length;
        if (result.entities.length === 0)
            return linkConfidence;
        if (result.links.length === 0)
            return entityConfidence;
        return (entityConfidence + linkConfidence) / 2;
    }
    getExtractionAgent(slot, mimeType, orgId) {
        const orgFeatureFlags = {
            'ai_extraction_script': true
        };
        if (this.agentRegistry.isAgentEnabled(slot, mimeType, orgFeatureFlags)) {
            return this.agentRegistry.getAgent(slot, mimeType);
        }
        return null;
    }
    convertAgentResult(agentResult) {
        const entities = agentResult.entities.map((entity) => ({
            kind: entity.type,
            data: entity.properties,
            confidence: entity.confidence,
            sourceOffset: entity.provenance?.trace_id
        }));
        const links = agentResult.links.map((link) => ({
            fromHash: this.calculateEntityHash({
                kind: link.sourceType,
                data: { id: link.sourceId },
                confidence: link.confidence
            }),
            toHash: this.calculateEntityHash({
                kind: link.targetType,
                data: { id: link.targetId },
                confidence: link.confidence
            }),
            relType: link.relationshipType,
            data: link.properties,
            confidence: link.confidence
        }));
        return {
            entities,
            links,
            metadata: agentResult.metadata
        };
    }
    async shouldAutoPromote(orgId, slot, confidence) {
        const result = await this.postgresService.query(`
      SELECT min_confidence, feature_flag 
      FROM parser_registry 
      WHERE org_id = $1 AND slot = $2 AND enabled = true
      LIMIT 1
    `, [orgId, slot]);
        if (result.rows.length === 0)
            return false;
        const { min_confidence, feature_flag } = result.rows[0];
        return feature_flag && confidence >= min_confidence;
    }
    async getFileContent(fileId) {
        const result = await this.neo4jService.run(`
      MATCH (f:File {id: $fileId})
      RETURN f.extracted_text as text, f.content_metadata as metadata, f.path as path
    `, { fileId });
        if (result.records.length === 0) {
            throw new Error(`File not found: ${fileId}`);
        }
        const record = result.records[0];
        return {
            text: record.get('text'),
            metadata: JSON.parse(record.get('metadata') || '{}'),
            path: record.get('path')
        };
    }
    async extractScriptContent(fileContent, metadata) {
        const entities = [];
        const links = [];
        const text = fileContent.text || '';
        const lines = text.split('\n');
        let currentScene = null;
        const characters = new Set();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.match(/^(INT\.|EXT\.)/i)) {
                if (currentScene) {
                    entities.push({
                        kind: 'Scene',
                        data: currentScene,
                        confidence: 0.9,
                        sourceOffset: `line:${i}`
                    });
                }
                currentScene = {
                    number: entities.filter(e => e.kind === 'Scene').length + 1,
                    heading: line,
                    location: this.extractLocation(line),
                    timeOfDay: this.extractTimeOfDay(line),
                    description: ''
                };
            }
            if (line.match(/^[A-Z][A-Z\s]+$/)) {
                const characterName = line.trim();
                if (characterName.length > 1 && characterName.length < 50) {
                    characters.add(characterName);
                }
            }
        }
        if (currentScene) {
            entities.push({
                kind: 'Scene',
                data: currentScene,
                confidence: 0.9,
                sourceOffset: `line:${lines.length}`
            });
        }
        for (const characterName of characters) {
            entities.push({
                kind: 'Character',
                data: {
                    name: characterName,
                    description: ''
                },
                confidence: 0.8
            });
        }
        return {
            entities,
            links,
            metadata: {
                parser: 'script-parser-v1',
                sceneCount: entities.filter(e => e.kind === 'Scene').length,
                characterCount: entities.filter(e => e.kind === 'Character').length
            }
        };
    }
    async extractBudgetContent(fileContent, metadata) {
        const entities = [];
        const links = [];
        const mockBudgetItems = [
            { category: 'Above-the-Line', item: 'Director Fee', amount: 50000 },
            { category: 'Above-the-Line', item: 'Producer Fee', amount: 75000 },
            { category: 'Below-the-Line', item: 'Camera Equipment', amount: 25000 },
            { category: 'Below-the-Line', item: 'Lighting Equipment', amount: 15000 }
        ];
        for (let i = 0; i < mockBudgetItems.length; i++) {
            const item = mockBudgetItems[i];
            entities.push({
                kind: 'BudgetLineItem',
                data: {
                    category: item.category,
                    description: item.item,
                    amount: item.amount,
                    lineNumber: i + 1
                },
                confidence: 0.95,
                sourceOffset: `row:${i + 2}`
            });
        }
        return {
            entities,
            links,
            metadata: {
                parser: 'budget-parser-v1',
                totalAmount: mockBudgetItems.reduce((sum, item) => sum + item.amount, 0),
                lineItemCount: mockBudgetItems.length
            }
        };
    }
    async extractCallSheetContent(fileContent, metadata) {
        const entities = [];
        const links = [];
        const text = fileContent.text || '';
        const shootDayMatch = text.match(/shoot\s+day\s*:?\s*(\d+)/i);
        if (shootDayMatch) {
            entities.push({
                kind: 'ShootDay',
                data: {
                    dayNumber: parseInt(shootDayMatch[1]),
                    date: new Date().toISOString().split('T')[0],
                    location: 'Studio A',
                    callTime: '06:00'
                },
                confidence: 0.9
            });
        }
        const crewRoles = ['Director', 'DP', 'Gaffer', 'Script Supervisor'];
        for (const role of crewRoles) {
            entities.push({
                kind: 'CrewRole',
                data: {
                    role: role,
                    department: this.getDepartmentForRole(role),
                    callTime: '06:00'
                },
                confidence: 0.8
            });
        }
        return {
            entities,
            links,
            metadata: {
                parser: 'callsheet-parser-v1',
                shootDayCount: entities.filter(e => e.kind === 'ShootDay').length,
                crewRoleCount: entities.filter(e => e.kind === 'CrewRole').length
            }
        };
    }
    extractLocation(sceneLine) {
        const match = sceneLine.match(/(INT\.|EXT\.)\s+(.+?)\s*-/i);
        return match ? match[2].trim() : '';
    }
    extractTimeOfDay(sceneLine) {
        const match = sceneLine.match(/-\s*(DAY|NIGHT|DAWN|DUSK)/i);
        return match ? match[1].toUpperCase() : 'DAY';
    }
    getDepartmentForRole(role) {
        const departmentMap = {
            'Director': 'Direction',
            'DP': 'Camera',
            'Gaffer': 'Lighting',
            'Script Supervisor': 'Script'
        };
        return departmentMap[role] || 'General';
    }
}
exports.ContentExtractionService = ContentExtractionService;
//# sourceMappingURL=ContentExtractionService.js.map