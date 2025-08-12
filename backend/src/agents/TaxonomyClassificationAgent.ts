import { BaseAgent, AgentContext, AgentConfig } from './BaseAgent'
import { QueueService } from '../services/queues/QueueService'
import { ClassificationService } from '../services/classification/ClassificationService'
import { PostgresService } from '../services/PostgresService'
import { Neo4jService } from '../services/Neo4jService'
import { TaxonomyService } from '../services/TaxonomyService'
import { v4 as uuidv4 } from 'uuid'

export interface TaxonomyRule {
  id: string;
  orgId: string;
  slotKey: string;
  matchPattern: string;
  fileType?: string;
  priority: number;
  enabled: boolean;
  conditions: ClassificationCondition[];
  metadata: any;
}

export interface ClassificationCondition {
  type: 'filename' | 'path' | 'size' | 'mime_type' | 'content';
  operator: 'matches' | 'contains' | 'equals' | 'greater_than' | 'less_than';
  value: string | number;
  caseSensitive?: boolean;
}

export interface ClassificationResult {
  slotKey: string;
  confidence: number;
  ruleId?: string;
  method: 'taxonomy' | 'ml' | 'default';
  metadata?: any;
}

export class TaxonomyClassificationAgent extends BaseAgent {
  private classificationService: ClassificationService;
  private postgresService: PostgresService;
  private neo4jService: Neo4jService;
  private taxonomyService: TaxonomyService;
  private taxonomyRules: Map<string, TaxonomyRule[]> = new Map();
  
  constructor(queueService: QueueService, config?: Partial<AgentConfig>) {
    super('taxonomy-classification-agent', queueService, {
      maxRetries: 2,
      retryDelay: 1500,
      healthCheckInterval: 30000,
      enableMonitoring: true,
      logLevel: 'info',
      ...config
    });
    
    this.classificationService = new ClassificationService(new PostgresService());
    this.postgresService = new PostgresService();
    this.neo4jService = new Neo4jService();
    this.taxonomyService = new TaxonomyService();
  }

  /**
   * Initializes the Taxonomy Classification Agent and registers queue workers
   */
  protected async onStart(): Promise<void> {
    this.logger.info('Starting TaxonomyClassificationAgent...');

    // Register classification worker
    this.queueService.registerWorker('file-classification', async (job) => {
      const context: AgentContext = { 
        orgId: job.data.orgId,
        sessionId: uuidv4()
      };

      await this.executeJob(
        'classifyFile',
        job.data,
        context,
        () => this.classifyFile(job.data)
      );
    });

    this.logger.info('TaxonomyClassificationAgent started successfully');
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping TaxonomyClassificationAgent...');
  }

  protected async onPause(): Promise<void> {
    this.logger.info('Pausing TaxonomyClassificationAgent...');
  }

  protected async onResume(): Promise<void> {
    this.logger.info('Resuming TaxonomyClassificationAgent...');
  }

  /**
   * Main file classification processing method
   */
  async classifyFile(jobData: any): Promise<ClassificationResult> {
    const { orgId, fileId, filePath, metadata } = jobData;
    
    this.validateContext({ orgId });
    this.logger.info(`Classifying file: ${filePath}`, { orgId, fileId });

    try {
      // Load taxonomy rules for the organization
      await this.loadTaxonomyRules(orgId);

      // Get file data for classification
      const fileData = await this.getFileData(orgId, fileId, filePath, metadata);

      // Perform classification using rule-based engine
      let classificationResult = await this.performRuleBasedClassification(orgId, fileData);

      // If no rule matched, try ML-based classification
      if (classificationResult.slotKey === 'UNCLASSIFIED') {
        classificationResult = await this.performMLClassification(orgId, fileData);
      }

      // Persist classification as temporal EdgeFact via TaxonomyService
      await this.taxonomyService.applyClassification(
        fileId,
        {
          slot: classificationResult.slotKey,
          confidence: classificationResult.confidence,
          method: classificationResult.method === 'taxonomy' ? 'rule_based' : classificationResult.method === 'ml' ? 'ml_based' : 'manual',
          rule_id: classificationResult.ruleId,
          metadata: classificationResult.metadata
        },
        orgId,
        'system'
      );

      // Reflect status/metadata on File node (no convenience edges)
      await this.updateFileClassification(fileId, {
        status: 'classified',
        confidence: classificationResult.confidence,
        method: classificationResult.method,
        metadata: classificationResult.metadata
      });

      // Create commit for classification action
      const commitId = await this.createCommit(
        orgId,
        `Classified file: ${filePath} as ${classificationResult.slotKey}`,
        { 
          fileId, 
          classification: classificationResult,
          method: classificationResult.method
        }
      );

      this.logger.info(`File classified successfully: ${filePath}`, { 
        slotKey: classificationResult.slotKey,
        confidence: classificationResult.confidence,
        method: classificationResult.method
      });

      return classificationResult;
    } catch (error) {
      this.logger.error(`Failed to classify file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Loads taxonomy rules for an organization
   */
  private async loadTaxonomyRules(orgId: string): Promise<void> {
    if (this.taxonomyRules.has(orgId)) {
      return; // Rules already loaded
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
    } catch (error) {
      this.logger.error(`Failed to load taxonomy rules for org ${orgId}`, error);
      this.taxonomyRules.set(orgId, []); // Set empty array to avoid repeated failures
    }
  }

  /**
   * Gets file data needed for classification
   */
  private async getFileData(orgId: string, fileId: string, filePath: string, metadata: any): Promise<any> {
    // If metadata is provided (from FileStewardAgent), use it
    if (metadata) {
      return {
        id: fileId,
        name: metadata.name,
        path: filePath,
        size: metadata.size,
        mimeType: metadata.mimeType,
        extractedText: '', // Will be populated if available
        metadata
      };
    }

    // Otherwise, fetch from database
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

  /**
   * Performs rule-based classification using taxonomy rules
   */
  private async performRuleBasedClassification(orgId: string, fileData: any): Promise<ClassificationResult> {
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

  /**
   * Evaluates if a rule matches the file data
   */
  private async evaluateRule(rule: TaxonomyRule, fileData: any): Promise<boolean> {
    // If rule has specific file type restriction, check it first
    if (rule.fileType && !fileData.mimeType.startsWith(rule.fileType)) {
      return false;
    }

    // Evaluate all conditions in the rule
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, fileData)) {
        return false; // All conditions must match
      }
    }

    return true;
  }

  /**
   * Evaluates individual classification conditions
   */
  private async evaluateCondition(condition: ClassificationCondition, fileData: any): Promise<boolean> {
    let fieldValue: any;

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

  /**
   * Applies comparison operators for condition evaluation
   */
  private applyOperator(
    operator: string,
    fieldValue: any,
    conditionValue: any,
    caseSensitive: boolean = true
  ): boolean {
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

  /**
   * Calculates confidence score for rule-based classification
   */
  private async calculateConfidence(rule: TaxonomyRule, fileData: any): Promise<number> {
    const totalConditions = rule.conditions.length;
    if (totalConditions === 0) {
      return 0.5; // Default confidence for simple pattern rules
    }

    let matchingConditions = 0;

    for (const condition of rule.conditions) {
      if (await this.evaluateCondition(condition, fileData)) {
        matchingConditions++;
      }
    }

    // Base confidence from condition matches
    const baseConfidence = matchingConditions / totalConditions;

    // Adjust confidence based on rule priority (higher priority = higher confidence)
    const priorityBonus = Math.min(rule.priority / 100, 0.2); // Up to 20% bonus

    return Math.min(baseConfidence + priorityBonus, 1.0);
  }

  /**
   * Performs ML-based classification as fallback
   */
  private async performMLClassification(orgId: string, fileData: any): Promise<ClassificationResult> {
    try {
      // Use the existing classification service for ML-based classification
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
    } catch (error) {
      this.logger.error('ML classification failed, using default classification', error);
      
      // Return default classification based on MIME type
      return this.getDefaultClassification(fileData);
    }
  }

  /**
   * Gets default classification based on file type
   */
  private getDefaultClassification(fileData: any): ClassificationResult {
    const mimeType = fileData.mimeType;

    let slotKey = 'UNCLASSIFIED';
    let confidence = 0.3;

    // Basic classification based on MIME type
    if (mimeType.startsWith('image/')) {
      slotKey = 'IMAGES';
      confidence = 0.7;
    } else if (mimeType.startsWith('video/')) {
      slotKey = 'VIDEOS';
      confidence = 0.7;
    } else if (mimeType.startsWith('audio/')) {
      slotKey = 'AUDIO';
      confidence = 0.7;
    } else if (mimeType === 'application/pdf') {
      slotKey = 'DOCUMENTS';
      confidence = 0.6;
    } else if (mimeType.includes('document') || mimeType.includes('sheet')) {
      slotKey = 'DOCUMENTS';
      confidence = 0.6;
    } else if (mimeType.startsWith('text/')) {
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

  /**
   * Updates file classification in Neo4j
   */
  private async updateFileClassification(
    fileId: string,
    classification: { status: string; confidence: number; method?: string; metadata?: any }
  ): Promise<void> {
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


