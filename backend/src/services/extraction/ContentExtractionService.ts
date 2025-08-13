import { BaseService } from '../BaseService';
import { PostgresService } from '../PostgresService';
import { Neo4jService } from '../Neo4jService';
import { QueueService } from '../queues/QueueService';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { AgentRegistry } from '../../agents/extraction/AgentRegistry';
import { BaseExtractionAgent } from '../../agents/extraction/BaseExtractionAgent';

export interface ExtractionJobData {
  jobId: string;
  orgId: string;
  fileId: string;
  slot: string;
  parser: string;
  parserVersion: string;
  metadata: any;
}

export interface ExtractedEntity {
  kind: string;
  data: any;
  confidence: number;
  sourceOffset?: string;
}

export interface ExtractedLink {
  fromHash: string;
  toHash: string;
  relType: string;
  data: any;
  confidence: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  links: ExtractedLink[];
  metadata: any;
}

/**
 * ContentExtractionService handles the extraction of structured content from files
 * and manages the staging/promotion workflow for cluster processing.
 */
export class ContentExtractionService extends BaseService {
  private postgresService: PostgresService;
  private neo4jService: Neo4jService;
  private queueService: QueueService;
  private parsers: Map<string, any> = new Map();
  private agentRegistry: AgentRegistry;

  constructor(
    postgresService: PostgresService,
    neo4jService: Neo4jService,
    queueService: QueueService
  ) {
    super('ContentExtractionService');
    this.postgresService = postgresService;
    this.neo4jService = neo4jService;
    this.queueService = queueService;
    this.agentRegistry = new AgentRegistry();
    
    this.initializeParsers();
  }

  /**
   * Initialize available parsers
   */
  private initializeParsers(): void {
    // Register built-in parsers
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

  /**
   * Process extraction job from queue
   */
  async processExtractionJob(jobData: ExtractionJobData): Promise<void> {
    const { jobId, orgId, fileId, slot, parser, parserVersion, metadata } = jobData;
    
    this.logger.info(`Processing extraction job: ${jobId}`, { orgId, fileId, slot, parser });

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running');

      // Get file content for extraction
      const fileContent = await this.getFileContent(fileId);
      
      // Default to built-in parser path (AI agent integration not enabled in this build)
      let extractionResult: ExtractionResult;
      const parserInstance = this.parsers.get(parser);
      if (!parserInstance) {
        throw new Error(`Parser not found: ${parser}`);
      }
      extractionResult = await parserInstance.extract(fileContent, metadata);
      
      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(extractionResult);

      // Store extracted entities in staging
      await this.storeExtractedEntities(jobId, extractionResult.entities);
      
      // Store extracted links in staging
      await this.storeExtractedLinks(jobId, extractionResult.links);

      // Update job with completion status
      await this.updateJobStatus(jobId, 'completed', {
        entitiesCount: extractionResult.entities.length,
        linksCount: extractionResult.links.length,
        confidence: overallConfidence,
        metadata: extractionResult.metadata
      });

      // Check if auto-promotion is enabled and confidence is high enough
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

    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Extraction job failed: ${jobId}`, { error: message });
      await this.updateJobStatus(jobId, 'failed', { error: message });
      throw error;
    }
  }

  /**
   * Store extracted entities in staging table
   */
  private async storeExtractedEntities(jobId: string, entities: ExtractedEntity[]): Promise<void> {
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

  /**
   * Store extracted links in staging table
   */
  private async storeExtractedLinks(jobId: string, links: ExtractedLink[]): Promise<void> {
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

  /**
   * Update extraction job status
   */
  private async updateJobStatus(jobId: string, status: string, metadata?: any): Promise<void> {
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

  /**
   * Calculate hash for entity deduplication
   */
  private calculateEntityHash(entity: ExtractedEntity): string {
    const normalized = {
      kind: entity.kind,
      data: this.normalizeEntityData(entity.data)
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  /**
   * Normalize entity data for consistent hashing
   */
  private normalizeEntityData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const normalized: any = {};
    const keys = Object.keys(data).sort();
    
    for (const key of keys) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') {
        continue; // Skip temporal/identity fields for hashing
      }
      normalized[key] = this.normalizeEntityData(data[key]);
    }
    
    return normalized;
  }

  /**
   * Calculate overall confidence from extraction results
   */
  private calculateOverallConfidence(result: ExtractionResult): number {
    if (result.entities.length === 0 && result.links.length === 0) {
      return 0;
    }
    
    const entityConfidence = result.entities.reduce((sum: number, entity: ExtractedEntity) => sum + entity.confidence, 0) / result.entities.length;
    const linkConfidence = result.links.reduce((sum: number, link: ExtractedLink) => sum + link.confidence, 0) / result.links.length;
    
    if (result.entities.length === 0) return linkConfidence;
    if (result.links.length === 0) return entityConfidence;
    
    return (entityConfidence + linkConfidence) / 2;
  }

  /**
   * Get extraction agent for a slot if available and enabled
   */
  private getExtractionAgent(slot: string, mimeType: string, orgId: string): BaseExtractionAgent | null {
    // For now, we'll use a simple feature flag check
    // In a real implementation, this would check the organization's feature flags
    const orgFeatureFlags = {
      'ai_extraction_script': true  // Enable AI extraction for script slot by default for testing
    };
    
    // Check if an agent is registered and enabled for this slot
    if (this.agentRegistry.isAgentEnabled(slot, mimeType, orgFeatureFlags)) {
      return this.agentRegistry.getAgent(slot, mimeType);
    }
    
    return null;
  }

  /**
   * Convert agent extraction result to the format expected by the extraction service
   */
  private convertAgentResult(agentResult: any): ExtractionResult {
    // Convert entities
    const entities: ExtractedEntity[] = agentResult.entities.map((entity: any) => ({
      kind: entity.type,
      data: entity.properties,
      confidence: entity.confidence,
      sourceOffset: entity.provenance?.trace_id
    }));
    
    // Convert links
    const links: ExtractedLink[] = agentResult.links.map((link: any) => ({
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

  /**
   * Check if extraction should be auto-promoted
   */
  private async shouldAutoPromote(orgId: string, slot: string, confidence: number): Promise<boolean> {
    const result = await this.postgresService.query(`
      SELECT min_confidence, feature_flag 
      FROM parser_registry 
      WHERE org_id = $1 AND slot = $2 AND enabled = true
      LIMIT 1
    `, [orgId, slot]);

    if (result.rows.length === 0) return false;
    
    const { min_confidence, feature_flag } = result.rows[0];
    return feature_flag && confidence >= min_confidence;
  }

  /**
   * Get file content for extraction
   */
  private async getFileContent(fileId: string): Promise<any> {
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

  // ========================================
  // PARSER IMPLEMENTATIONS
  // ========================================

  /**
   * Extract content from script files (PDF, Fountain, FDX)
   */
  private async extractScriptContent(fileContent: any, metadata: any): Promise<ExtractionResult> {
    const entities: ExtractedEntity[] = [];
    const links: ExtractedLink[] = [];

    // Mock script parsing - in production this would use actual parsers
    const text = fileContent.text || '';
    const lines = text.split('\n');
    
    let currentScene: any = null;
    const characters = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect scene headers (simplified)
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
      
      // Detect character names (simplified)
      if (line.match(/^[A-Z][A-Z\s]+$/)) {
        const characterName = line.trim();
        if (characterName.length > 1 && characterName.length < 50) {
          characters.add(characterName);
        }
      }
    }

    // Add final scene
    if (currentScene) {
      entities.push({
        kind: 'Scene',
        data: currentScene,
        confidence: 0.9,
        sourceOffset: `line:${lines.length}`
      });
    }

    // Add characters
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

  /**
   * Extract content from budget files (Excel, CSV)
   */
  private async extractBudgetContent(fileContent: any, metadata: any): Promise<ExtractionResult> {
    const entities: ExtractedEntity[] = [];
    const links: ExtractedLink[] = [];

    // Mock budget parsing - in production this would parse actual spreadsheet data
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

  /**
   * Extract content from call sheet files
   */
  private async extractCallSheetContent(fileContent: any, metadata: any): Promise<ExtractionResult> {
    const entities: ExtractedEntity[] = [];
    const links: ExtractedLink[] = [];

    // Mock call sheet parsing
    const text = fileContent.text || '';
    
    // Extract shoot day information
    const shootDayMatch = text.match(/shoot\s+day\s*:?\s*(\d+)/i);
    if (shootDayMatch) {
      entities.push({
        kind: 'ShootDay',
        data: {
          dayNumber: parseInt(shootDayMatch[1]),
          date: new Date().toISOString().split('T')[0], // Mock date
          location: 'Studio A', // Mock location
          callTime: '06:00'
        },
        confidence: 0.9
      });
    }

    // Extract crew roles
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

  // ========================================
  // HELPER METHODS
  // ========================================

  private extractLocation(sceneLine: string): string {
    const match = sceneLine.match(/(INT\.|EXT\.)\s+(.+?)\s*-/i);
    return match ? match[2].trim() : '';
  }

  private extractTimeOfDay(sceneLine: string): string {
    const match = sceneLine.match(/-\s*(DAY|NIGHT|DAWN|DUSK)/i);
    return match ? match[1].toUpperCase() : 'DAY';
  }

  private getDepartmentForRole(role: string): string {
    const departmentMap: Record<string, string> = {
      'Director': 'Direction',
      'DP': 'Camera',
      'Gaffer': 'Lighting',
      'Script Supervisor': 'Script'
    };
    return departmentMap[role] || 'General';
  }
}
