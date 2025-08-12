# Agent System Implementation
## Deterministic Automations with Full Audit Trail Integration

### 1. Agent Architecture Overview

#### 1.1 Core Principles

**Deterministic Processing**
- Agents perform predictable, repeatable operations based on inputs and current state
- All agent actions are logged as part of the provenance system
- Agent behavior can be replayed and audited through commit history

**Multi-Tenant Isolation**
- Agents operate within strict tenant boundaries
- Each agent execution is associated with a specific organization context
- Agent configurations are stored per-organization

**Version-Controlled Operations**
- Agent actions create new versions of entities rather than modifying existing ones
- All agent operations are grouped into commits for audit trail integrity
- Branching allows for safe experimentation with agent behaviors

**Extensible Framework**
- Agent system supports multiple types of agents (classification, content analysis, workflow)
- Agents can be chained together to form complex processing pipelines
- New agent types can be added without modifying core infrastructure

### 2. Agent Types Implementation

#### 2.1 File Steward Agent

**Core File Processing Agent**
```typescript
export class FileStewardAgent {
  private neo4jService: Neo4jService;
  private classificationService: ClassificationService;
  private extractionService: ContentExtractionService;
  private eventQueue: Queue;

  constructor(
    neo4jService: Neo4jService,
    classificationService: ClassificationService,
    extractionService: ContentExtractionService,
    eventQueue: Queue
  ) {
    this.neo4jService = neo4jService;
    this.classificationService = classificationService;
    this.extractionService = extractionService;
    this.eventQueue = eventQueue;
  }

  /**
   * Processes sync events and updates the knowledge graph
   */
  async processSyncEvent(eventData: SyncJobData): Promise<void> {
    const { orgId, sourceId, eventType, resourcePath, eventData: rawEventData } = eventData;

    try {
      // Create commit for this operation
      const commitId = await this.createCommit(orgId, {
        message: `File sync: ${eventType} ${resourcePath}`,
        author: 'file-steward-agent',
        authorType: 'agent'
      });

      switch (eventType) {
        case 'file_created':
          await this.handleFileCreated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'file_updated':
          await this.handleFileUpdated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'file_deleted':
          await this.handleFileDeleted(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'folder_created':
          await this.handleFolderCreated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'folder_updated':
          await this.handleFolderUpdated(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
        case 'folder_deleted':
          await this.handleFolderDeleted(orgId, sourceId, resourcePath, rawEventData, commitId);
          break;
      }

      // Mark sync event as processed
      await this.markSyncEventProcessed(eventData);

    } catch (error) {
      console.error('Error processing sync event:', error);
      await this.handleSyncError(eventData, error);
      throw error;
    }
  }

  /**
   * Handles file creation events
   */
  private async handleFileCreated(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    eventData: any, 
    commitId: string
  ): Promise<void> {
    // Extract file metadata from event data
    const fileMetadata = this.extractFileMetadata(eventData);
    
    // Create or update file node in Neo4j
    const fileId = await this.upsertFileNode(orgId, sourceId, resourcePath, fileMetadata, commitId);

    // Create parent folder relationships
    await this.ensureFolderHierarchy(orgId, sourceId, resourcePath, commitId);

    // Queue for classification
    await this.eventQueue.add('classify-file', {
      orgId,
      fileId,
      filePath: resourcePath,
      sourceId,
      commitId
    });

    // Queue for content extraction if applicable
    if (this.shouldExtractContent(fileMetadata.mimeType)) {
      await this.eventQueue.add('extract-content', {
        orgId,
        fileId,
        filePath: resourcePath,
        sourceId,
        commitId
      });
    }
  }

  /**
   * Handles file update events
   */
  private async handleFileUpdated(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    eventData: any, 
    commitId: string
  ): Promise<void> {
    const fileMetadata = this.extractFileMetadata(eventData);
    
    // Get existing file node
    const existingFile = await this.getFileNode(orgId, sourceId, resourcePath);
    
    if (!existingFile) {
      // File doesn't exist in graph, treat as creation
      await this.handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId);
      return;
    }

    // Create version record for the update
    await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);

    // Update file node with new metadata
    await this.updateFileNode(existingFile.id, fileMetadata, commitId);

    // Re-classify if content changed significantly
    if (this.hasSignificantChanges(existingFile.properties, fileMetadata)) {
      await this.eventQueue.add('classify-file', {
        orgId,
        fileId: existingFile.id,
        filePath: resourcePath,
        sourceId,
        commitId
      });
    }
  }

  /**
   * Handles file deletion events
   */
  private async handleFileDeleted(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    eventData: any, 
    commitId: string
  ): Promise<void> {
    const existingFile = await this.getFileNode(orgId, sourceId, resourcePath);
    
    if (!existingFile) {
      console.warn(`File not found for deletion: ${resourcePath}`);
      return;
    }

    // Create version record before deletion
    await this.createEntityVersion(existingFile.id, 'File', existingFile.properties, commitId);

    // Soft delete by setting deleted flag and end-dating relationships
    await this.softDeleteFileNode(existingFile.id, commitId);

    // Clean up orphaned folder nodes if needed
    await this.cleanupOrphanedFolders(orgId, sourceId, resourcePath, commitId);
  }

  /**
   * Creates or updates file node in Neo4j
   */
  private async upsertFileNode(
    orgId: string, 
    sourceId: string, 
    resourcePath: string, 
    metadata: any, 
    commitId: string
  ): Promise<string> {
    const query = `
      MERGE (f:File {org_id: $orgId, source_id: $sourceId, path: $path})
      ON CREATE SET 
        f.id = randomUUID(),
        f.created_at = datetime(),
        f.db_id = $dbId
      SET 
        f.name = $name,
        f.size = $size,
        f.mime_type = $mimeType,
        f.checksum = $checksum,
        f.updated_at = datetime(),
        f.modified = datetime($modified),
        f.metadata = $metadata
      RETURN f.id as fileId
    `;

    const result = await this.neo4jService.run(query, {
      orgId,
      sourceId,
      path: resourcePath,
      dbId: metadata.dbId,
      name: metadata.name,
      size: metadata.size,
      mimeType: metadata.mimeType,
      checksum: metadata.checksum,
      modified: metadata.modified,
      metadata: JSON.stringify(metadata.extra || {})
    });

    const fileId = result.records[0].get('fileId');

    // Create action record
    await this.createAction(commitId, {
      actionType: 'upsert_file',
      tool: 'file-steward-agent',
      entityType: 'File',
      entityId: fileId,
      inputs: { orgId, sourceId, resourcePath, metadata },
      outputs: { fileId },
      status: 'success'
    });

    return fileId;
  }

  /**
   * Ensures folder hierarchy exists in the graph
   */
  private async ensureFolderHierarchy(
    orgId: string, 
    sourceId: string, 
    filePath: string, 
    commitId: string
  ): Promise<void> {
    const pathParts = filePath.split('/').filter(part => part.length > 0);
    pathParts.pop(); // Remove filename

    let currentPath = '';
    let parentId: string | null = null;

    for (const folderName of pathParts) {
      currentPath += `/${folderName}`;
      
      const folderId = await this.upsertFolderNode(
        orgId, 
        sourceId, 
        currentPath, 
        folderName, 
        parentId, 
        commitId
      );

      // Create parent-child relationship
      if (parentId) {
        await this.createFolderRelationship(parentId, folderId, 'CONTAINS', commitId);
      }

      parentId = folderId;
    }

    // Create file-to-folder relationship
    if (parentId) {
      const fileId = await this.getFileIdByPath(orgId, sourceId, filePath);
      if (fileId) {
        await this.createFolderRelationship(parentId, fileId, 'CONTAINS', commitId);
      }
    }
  }

  /**
   * Extracts standardized metadata from provider-specific event data
   */
  private extractFileMetadata(eventData: any): any {
    // Handle different provider formats
    if (eventData.entry) {
      // Dropbox format
      return {
        name: eventData.entry.name,
        size: eventData.entry.size,
        mimeType: this.inferMimeType(eventData.entry.name),
        checksum: eventData.entry.content_hash,
        modified: eventData.entry.server_modified,
        dbId: eventData.entry.id,
        extra: {
          provider: 'dropbox',
          rev: eventData.entry.rev,
          pathDisplay: eventData.entry.path_display
        }
      };
    } else if (eventData.file) {
      // Google Drive format
      return {
        name: eventData.file.name,
        size: parseInt(eventData.file.size) || 0,
        mimeType: eventData.file.mimeType,
        checksum: eventData.file.md5Checksum,
        modified: eventData.file.modifiedTime,
        dbId: eventData.file.id,
        extra: {
          provider: 'gdrive',
          version: eventData.file.version,
          webViewLink: eventData.file.webViewLink
        }
      };
    } else {
      // Supabase format
      return {
        name: eventData.name,
        size: eventData.size,
        mimeType: eventData.mime_type,
        checksum: eventData.checksum,
        modified: eventData.modified,
        dbId: eventData.id,
        extra: {
          provider: 'supabase',
          bucket: eventData.bucket_id
        }
      };
    }
  }

  /**
   * Determines if content extraction should be performed
   */
  private shouldExtractContent(mimeType: string): boolean {
    const extractableMimeTypes = [
      'application/pdf',
      'text/plain',
      'text/html',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    return extractableMimeTypes.includes(mimeType);
  }

  /**
   * Determines if file changes are significant enough to trigger re-classification
   */
  private hasSignificantChanges(oldMetadata: any, newMetadata: any): boolean {
    // Check if name changed (might affect classification)
    if (oldMetadata.name !== newMetadata.name) {
      return true;
    }

    // Check if size changed significantly (>10% change)
    const sizeChange = Math.abs(oldMetadata.size - newMetadata.size) / oldMetadata.size;
    if (sizeChange > 0.1) {
      return true;
    }

    // Check if modification time is recent (within last hour)
    const modifiedTime = new Date(newMetadata.modified);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (modifiedTime > oneHourAgo) {
      return true;
    }

    return false;
  }

  private async createCommit(orgId: string, commitData: any): Promise<string> {
    // Implementation for creating commit records
    // This will be detailed in the versioning section
    return 'commit-id-placeholder';
  }

  private async createAction(commitId: string, actionData: any): Promise<void> {
    // Implementation for creating action records
    // This will be detailed in the provenance section
  }
}
```

#### 2.2 Classification Agent

**Taxonomy-Based Classification Agent**
```typescript
export interface TaxonomyRule {
  id: string;
  orgId: string;
  slotKey: string;
  matchPattern: string;
  fileType?: string;
  priority: number;
  enabled: boolean;
  conditions: ClassificationCondition[];
}

export interface ClassificationCondition {
  type: 'filename' | 'path' | 'size' | 'mime_type' | 'content';
  operator: 'matches' | 'contains' | 'equals' | 'greater_than' | 'less_than';
  value: string | number;
  caseSensitive?: boolean;
}

export class TaxonomyClassificationAgent {
  private rules: Map<string, TaxonomyRule[]> = new Map();

  /**
   * Loads taxonomy rules for an organization
   */
  async loadTaxonomyRules(orgId: string): Promise<void> {
    const query = `
      SELECT tr.*, tp.name as profile_name
      FROM taxonomy_rules tr
      JOIN taxonomy_profiles tp ON tr.profile_id = tp.id
      WHERE tr.org_id = $1 AND tr.enabled = true AND tp.active = true
      ORDER BY tr.priority ASC
    `;
    
    const result = await this.database.query(query, [orgId]);
    this.rules.set(orgId, result.rows);
  }

  /**
   * Classifies a file based on taxonomy rules
   */
  async classifyFile(orgId: string, fileData: any): Promise<ClassificationResult> {
    const rules = this.rules.get(orgId) || [];
    
    for (const rule of rules) {
      if (await this.evaluateRule(rule, fileData)) {
        return {
          slotKey: rule.slotKey,
          confidence: this.calculateConfidence(rule, fileData),
          ruleId: rule.id,
          method: 'taxonomy'
        };
      }
    }

    return {
      slotKey: 'UNCLASSIFIED',
      confidence: 0,
      ruleId: null,
      method: 'default'
    };
  }

  /**
   * Evaluates if a rule matches the file data
   */
  private async evaluateRule(rule: TaxonomyRule, fileData: any): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, fileData)) {
        return false;
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
    switch (operator) {
      case 'matches':
        const regex = new RegExp(conditionValue, caseSensitive ? 'g' : 'gi');
        return regex.test(fieldValue);
      case 'contains':
        const searchValue = caseSensitive ? conditionValue : conditionValue.toLowerCase();
        const searchField = caseSensitive ? fieldValue : fieldValue.toLowerCase();
        return searchField.includes(searchValue);
      case 'equals':
        return fieldValue === conditionValue;
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      default:
        return false;
    }
  }

  /**
   * Calculates confidence score for classification
   */
  private calculateConfidence(rule: TaxonomyRule, fileData: any): number {
    // Simple confidence calculation based on number of matching conditions
    const totalConditions = rule.conditions.length;
    let matchingConditions = 0;

    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, fileData)) {
        matchingConditions++;
      }
    }

    return matchingConditions / totalConditions;
  }
}
```

#### 2.3 Content Analysis Agent

**Content Analysis and Metadata Extraction Agent**
```typescript
export class ContentAnalysisAgent {
  private neo4jService: Neo4jService;
  private nlpService: NLPService;
  private metadataExtractor: MetadataExtractor;

  constructor(neo4jService: Neo4jService, nlpService: NLPService, metadataExtractor: MetadataExtractor) {
    this.neo4jService = neo4jService;
    this.nlpService = nlpService;
    this.metadataExtractor = metadataExtractor;
  }

  /**
   * Analyzes content and extracts metadata
   */
  async analyzeContent(orgId: string, contentId: string): Promise<void> {
    // Get content data
    const content = await this.getContent(orgId, contentId);
    
    // Create commit for this operation
    const commitId = await this.createCommit(orgId, {
      message: `Content analysis: ${content.title}`,
      author: 'content-analysis-agent',
      authorType: 'agent'
    });
    
    try {
      // Extract metadata
      const metadata = await this.extractMetadata(content);
      
      // Perform NLP analysis
      const nlpResults = await this.performNLPAnalysis(content);
      
      // Update content with analysis results
      await this.updateContentWithAnalysis(orgId, contentId, metadata, nlpResults, commitId);
      
      // Create action record
      await this.createAction(commitId, {
        actionType: 'analyze_content',
        tool: 'content-analysis-agent',
        entityType: 'Content',
        entityId: contentId,
        inputs: { orgId, contentId },
        outputs: { metadata, nlpResults },
        status: 'success'
      });
      
    } catch (error) {
      // Create error action record
      await this.createAction(commitId, {
        actionType: 'analyze_content',
        tool: 'content-analysis-agent',
        entityType: 'Content',
        entityId: contentId,
        inputs: { orgId, contentId },
        outputs: {},
        status: 'failed',
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  /**
   * Gets content data from Neo4j
   */
  private async getContent(orgId: string, contentId: string): Promise<any> {
    const query = `
      MATCH (c:Content {id: $contentId, org_id: $orgId, current: true})
      RETURN c
    `;
    
    const result = await this.neo4jService.run(query, { contentId, orgId });
    
    if (result.records.length === 0) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    return result.records[0].get('c').properties;
  }

  /**
   * Extracts metadata from content
   */
  private async extractMetadata(content: any): Promise<any> {
    // Extract basic metadata based on content type
    switch (content.content_type) {
      case 'script':
        return await this.metadataExtractor.extractScriptMetadata(content);
      case 'storyboard':
        return await this.metadataExtractor.extractStoryboardMetadata(content);
      case 'asset':
        return await this.metadataExtractor.extractAssetMetadata(content);
      default:
        return {};
    }
  }

  /**
   * Performs NLP analysis on content
   */
  private async performNLPAnalysis(content: any): Promise<NLPAnalysisResult> {
    // Perform different NLP analyses based on content type
    switch (content.content_type) {
      case 'script':
        return await this.nlpService.analyzeScript(content);
      case 'storyboard':
        return await this.nlpService.analyzeStoryboard(content);
      case 'asset':
        return await this.nlpService.analyzeAssetDescription(content);
      default:
        return {
          entities: [],
          topics: [],
          sentiment: 0,
          keywords: [],
          summary: ''
        };
    }
  }

  /**
   * Updates content with analysis results
   */
  private async updateContentWithAnalysis(
    orgId: string,
    contentId: string,
    metadata: any,
    nlpResults: NLPAnalysisResult,
    commitId: string
  ): Promise<void> {
    // Get current content version
    const currentContent = await this.getContent(orgId, contentId);
    
    // Create version record of current state
    await this.createEntityVersion(contentId, 'Content', currentContent, commitId);
    
    // Merge analysis results with existing metadata
    const updatedMetadata = {
      ...currentContent.metadata,
      ...metadata,
      nlp: nlpResults
    };
    
    // Update content node
    const query = `
      MATCH (c:Content {id: $contentId, org_id: $orgId})
      SET c.metadata = $metadata,
          c.updated_at = datetime()
      RETURN c
    `;
    
    await this.neo4jService.run(query, {
      contentId,
      orgId,
      metadata: JSON.stringify(updatedMetadata)
    });
  }

  private async createCommit(orgId: string, commitData: any): Promise<string> {
    // Implementation for creating commit records
    return 'commit-id-placeholder';
  }

  private async createAction(commitId: string, actionData: any): Promise<void> {
    // Implementation for creating action records
  }

  private async createEntityVersion(entityId: string, entityType: string, properties: any, commitId: string): Promise<void> {
    // Implementation for creating version records
  }
}
```

### 3. Agent Orchestration System

#### 3.1 Agent Registry

**Agent Registration and Management**
```typescript
export interface AgentConfig {
  id: string;
  orgId: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  schedule?: string;
  triggerEvents?: string[];
  parameters: any;
  createdAt: string;
  updatedAt: string;
}

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private configs: Map<string, AgentConfig> = new Map();

  /**
   * Registers a new agent type
   */
  registerAgent(agentType: string, agentClass: new () => Agent): void {
    this.agents.set(agentType, new agentClass());
  }

  /**
   * Loads agent configurations for an organization
   */
  async loadAgentConfigs(orgId: string): Promise<void> {
    const query = `
      SELECT * FROM agent_configs
      WHERE org_id = $1 AND enabled = true
    `;
    
    const result = await this.database.query(query, [orgId]);
    
    for (const row of result.rows) {
      this.configs.set(row.id, {
        id: row.id,
        orgId: row.org_id,
        name: row.name,
        description: row.description,
        type: row.type,
        enabled: row.enabled,
        schedule: row.schedule,
        triggerEvents: row.trigger_events ? JSON.parse(row.trigger_events) : [],
        parameters: row.parameters ? JSON.parse(row.parameters) : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }
  }

  /**
   * Gets agent configuration by ID
   */
  getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.configs.get(agentId);
  }

  /**
   * Gets agent instance by type
   */
  getAgent(agentType: string): Agent | undefined {
    return this.agents.get(agentType);
  }

  /**
   * Executes an agent with provided configuration
   */
  async executeAgent(agentId: string, inputs: any): Promise<AgentExecutionResult> {
    const config = this.getAgentConfig(agentId);
    
    if (!config) {
      throw new Error(`Agent configuration not found: ${agentId}`);
    }
    
    const agent = this.getAgent(config.type);
    
    if (!agent) {
      throw new Error(`Agent type not registered: ${config.type}`);
    }
    
    // Merge inputs with configuration parameters
    const executionInputs = {
      ...config.parameters,
      ...inputs
    };
    
    // Execute agent
    return await agent.execute(executionInputs);
  }
}
```

#### 3.2 Agent Execution Pipeline

**Agent Pipeline Orchestration**
```typescript
export class AgentPipeline {
  private agentRegistry: AgentRegistry;
  private eventQueue: Queue;
  private neo4jService: Neo4jService;

  constructor(agentRegistry: AgentRegistry, eventQueue: Queue, neo4jService: Neo4jService) {
    this.agentRegistry = agentRegistry;
    this.eventQueue = eventQueue;
    this.neo4jService = neo4jService;
  }

  /**
   * Creates and executes an agent pipeline
   */
  async executePipeline(orgId: string, pipelineConfig: PipelineConfig): Promise<PipelineExecutionResult> {
    const { name, agents, inputs } = pipelineConfig;
    
    // Create commit for the entire pipeline execution
    const commitId = await this.createCommit(orgId, {
      message: `Execute agent pipeline: ${name}`,
      author: 'agent-pipeline',
      authorType: 'system'
    });
    
    const results: AgentExecutionResult[] = [];
    
    try {
      // Execute each agent in sequence
      for (const agentConfig of agents) {
        const agentResult = await this.executeAgentInPipeline(
          orgId, 
          agentConfig.agentId, 
          agentConfig.inputs || inputs,
          commitId
        );
        
        results.push(agentResult);
        
        // If agent specifies outputs to pass to next agent, merge them
        if (agentResult.outputs && agentConfig.passOutputs) {
          inputs = { ...inputs, ...agentResult.outputs };
        }
      }
      
      // Create action record for pipeline execution
      await this.createAction(commitId, {
        actionType: 'execute_pipeline',
        tool: 'agent-pipeline',
        entityType: 'Pipeline',
        entityId: pipelineConfig.id,
        inputs: pipelineConfig,
        outputs: { results },
        status: 'success'
      });
      
      return {
        pipelineId: pipelineConfig.id,
        commitId,
        results,
        status: 'success'
      };
      
    } catch (error) {
      // Create error action record
      await this.createAction(commitId, {
        actionType: 'execute_pipeline',
        tool: 'agent-pipeline',
        entityType: 'Pipeline',
        entityId: pipelineConfig.id,
        inputs: pipelineConfig,
        outputs: { results },
        status: 'failed',
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  /**
   * Executes a single agent within a pipeline
   */
  private async executeAgentInPipeline(
    orgId: string,
    agentId: string,
    inputs: any,
    commitId: string
  ): Promise<AgentExecutionResult> {
    try {
      // Add orgId to inputs if not present
      const agentInputs = { ...inputs, orgId };
      
      // Execute agent
      const result = await this.agentRegistry.executeAgent(agentId, agentInputs);
      
      // Create action record for agent execution
      await this.createAction(commitId, {
        actionType: 'execute_agent',
        tool: result.agentType,
        entityType: result.entityType,
        entityId: result.entityId,
        inputs: agentInputs,
        outputs: result.outputs,
        status: 'success'
      });
      
      return result;
      
    } catch (error) {
      // Create error action record
      await this.createAction(commitId, {
        actionType: 'execute_agent',
        tool: 'unknown',
        entityType: 'Agent',
        entityId: agentId,
        inputs,
        outputs: {},
        status: 'failed',
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  private async createCommit(orgId: string, commitData: any): Promise<string> {
    // Implementation for creating commit records
    return 'commit-id-placeholder';
  }

  private async createAction(commitId: string, actionData: any): Promise<void> {
    // Implementation for creating action records
  }
}
```

### 4. Agent Monitoring and Control

#### 4.1 Agent Health Monitoring

**Agent Status Tracking**
```typescript
export interface AgentStatus {
  agentId: string;
  orgId: string;
  status: 'running' | 'idle' | 'error' | 'disabled';
  lastExecution: string;
  lastError?: string;
  executionCount: number;
  successCount: number;
  errorCount: number;
  averageExecutionTime: number;
}

export class AgentMonitor {
  private status: Map<string, AgentStatus> = new Map();
  private neo4jService: Neo4jService;

  constructor(neo4jService: Neo4jService) {
    this.neo4jService = neo4jService;
  }

  /**
   * Updates agent status after execution
   */
  async updateAgentStatus(
    agentId: string,
    orgId: string,
    executionStatus: 'success' | 'error',
    executionTime: number,
    error?: string
  ): Promise<void> {
    const statusKey = `${orgId}:${agentId}`;
    let agentStatus = this.status.get(statusKey);
    
    if (!agentStatus) {
      agentStatus = {
        agentId,
        orgId,
        status: 'idle',
        lastExecution: new Date().toISOString(),
        executionCount: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0
      };
      this.status.set(statusKey, agentStatus);
    }
    
    // Update counters
    agentStatus.executionCount++;
    agentStatus.lastExecution = new Date().toISOString();
    
    if (executionStatus === 'success') {
      agentStatus.status = 'idle';
      agentStatus.successCount++;
    } else {
      agentStatus.status = 'error';
      agentStatus.errorCount++;
      agentStatus.lastError = error;
    }
    
    // Update average execution time
    agentStatus.averageExecutionTime = (
      (agentStatus.averageExecutionTime * (agentStatus.executionCount - 1)) + executionTime
    ) / agentStatus.executionCount;
    
    // Store status in database
    await this.storeAgentStatus(agentStatus);
  }

  /**
   * Stores agent status in Neo4j
   */
  private async storeAgentStatus(status: AgentStatus): Promise<void> {
    const query = `
      MERGE (a:AgentStatus {agent_id: $agentId, org_id: $orgId})
      ON CREATE SET 
        a.id = randomUUID(),
        a.created_at = datetime()
      SET
        a.status = $status,
        a.last_execution = datetime($lastExecution),
        a.last_error = $lastError,
        a.execution_count = $executionCount,
        a.success_count = $successCount,
        a.error_count = $errorCount,
        a.average_execution_time = $averageExecutionTime,
        a.updated_at = datetime()
    `;
    
    await this.neo4jService.run(query, {
      agentId: status.agentId,
      orgId: status.orgId,
      status: status.status,
      lastExecution: status.lastExecution,
      lastError: status.lastError || null,
      executionCount: status.executionCount,
      successCount: status.successCount,
      errorCount: status.errorCount,
      averageExecutionTime: status.averageExecutionTime
    });
  }

  /**
   * Gets agent status
   */
  async getAgentStatus(orgId: string, agentId: string): Promise<AgentStatus> {
    const statusKey = `${orgId}:${agentId}`;
    const cachedStatus = this.status.get(statusKey);
    
    if (cachedStatus) {
      return cachedStatus;
    }
    
    const query = `
      MATCH (a:AgentStatus {agent_id: $agentId, org_id: $orgId})
      RETURN a
    `;
    
    const result = await this.neo4jService.run(query, { agentId, orgId });
    
    if (result.records.length === 0) {
      throw new Error(`Agent status not found: ${agentId}`);
    }
    
    const statusNode = result.records[0].get('a').properties;
    
    const agentStatus: AgentStatus = {
      agentId: statusNode.agent_id,
      orgId: statusNode.org_id,
      status: statusNode.status,
      lastExecution: statusNode.last_execution,
      lastError: statusNode.last_error,
      executionCount: statusNode.execution_count,
      successCount: statusNode.success_count,
      errorCount: statusNode.error_count,
      averageExecutionTime: statusNode.average_execution_time
    };
    
    this.status.set(statusKey, agentStatus);
    return agentStatus;
  }
}
```

This implementation provides a comprehensive agent system with deterministic processing, tenant isolation, version-controlled operations, and extensible framework. The system includes multiple agent types (File Steward, Classification, Content Analysis) and a robust orchestration pipeline for executing complex workflows.
