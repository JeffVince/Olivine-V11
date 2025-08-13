/**
 * Standardized Provenance Event Schemas for Cluster-Centric Processing
 * Based on cluster implementation.md section A3
 */

export interface BaseProvenanceEvent {
  id: string;
  type: string;
  orgId: string;
  timestamp: string; // ISO 8601
  agent: string;
  agentVersion: string;
  commitId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// ===== FILE INGESTION EVENTS =====

export interface FileIngestedEvent extends BaseProvenanceEvent {
  type: 'file.ingested';
  payload: {
    fileId: string;
    sourceId: string;
    projectId?: string;
    path: string;
    name: string;
    size: number;
    mimeType: string;
    checksum?: string;
    provider: 'dropbox' | 'gdrive' | 'supabase' | 'local';
    eventType: 'created' | 'updated' | 'deleted';
  };
}

export interface ClusterCreatedEvent extends BaseProvenanceEvent {
  type: 'cluster.created';
  payload: {
    clusterId: string;
    fileId: string;
    projectId?: string;
    status: 'empty' | 'extracting' | 'staged' | 'promoted';
    extractionMethod?: string;
  };
}

export interface SlotClassifiedEvent extends BaseProvenanceEvent {
  type: 'slot.classified';
  payload: {
    fileId: string;
    slotKey: string;
    confidence: number;
    method: 'rule-based' | 'ml' | 'manual';
    ruleId?: string;
    edgeFactId: string;
    previousSlots?: string[]; // For reclassification
  };
}

export interface SlotReclassifiedEvent extends BaseProvenanceEvent {
  type: 'slot.reclassified';
  payload: {
    fileId: string;
    addedSlots: string[];
    removedSlots: string[];
    confidence: number;
    method: 'rule-based' | 'ml' | 'manual';
    reason: string;
    edgeFactIds: string[];
  };
}

// ===== CONTENT EXTRACTION EVENTS =====

export interface ExtractionJobCreatedEvent extends BaseProvenanceEvent {
  type: 'extraction.job.created';
  payload: {
    jobId: string;
    fileId: string;
    clusterId: string;
    parserName: string;
    parserVersion: string;
    method: 'rule-based' | 'ml' | 'hybrid';
    dedupeKey: string;
    slots: string[];
  };
}

export interface ExtractionJobCompletedEvent extends BaseProvenanceEvent {
  type: 'extraction.job.completed';
  payload: {
    jobId: string;
    fileId: string;
    clusterId: string;
    status: 'completed' | 'failed';
    entitiesExtracted: number;
    linksExtracted: number;
    confidence: number;
    duration: number; // milliseconds
    errorMessage?: string;
  };
}

export interface ContentPromotedEvent extends BaseProvenanceEvent {
  type: 'content.promoted';
  payload: {
    jobId: string;
    clusterId: string;
    entitiesPromoted: number;
    linksPromoted: number;
    nodeIds: string[];
    relationshipIds: string[];
    promotedBy: string; // user ID or 'system'
    auditId: string;
  };
}

export interface ContentRolledBackEvent extends BaseProvenanceEvent {
  type: 'content.rolled_back';
  payload: {
    jobId: string;
    clusterId: string;
    auditId: string;
    entitiesRemoved: number;
    linksRemoved: number;
    rolledBackBy: string;
    reason: string;
  };
}

// ===== CROSS-LAYER LINKING EVENTS =====

export interface CrossLayerLinkCreatedEvent extends BaseProvenanceEvent {
  type: 'cross_layer.link.created';
  payload: {
    fromEntityId: string;
    fromEntityType: string;
    fromLayer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    toEntityId: string;
    toEntityType: string;
    toLayer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    relationshipType: string;
    edgeFactId?: string; // If temporal relationship
    confidence?: number;
    method: 'automatic' | 'manual' | 'inferred';
  };
}

export interface CrossLayerValidationEvent extends BaseProvenanceEvent {
  type: 'cross_layer.validation';
  payload: {
    validationType: 'consistency_check' | 'orphan_detection' | 'integrity_repair';
    entitiesValidated: number;
    violationsFound: number;
    violationsRepaired: number;
    violations: Array<{
      entityId: string;
      entityType: string;
      violationType: string;
      description: string;
      repaired: boolean;
    }>;
  };
}

// ===== WORKFLOW ORCHESTRATION EVENTS =====

export interface WorkflowStartedEvent extends BaseProvenanceEvent {
  type: 'workflow.started';
  payload: {
    workflowId: string;
    workflowDefinitionId: string;
    workflowName: string;
    triggerType: 'event' | 'schedule' | 'manual';
    triggerData: any;
    expectedSteps: string[];
  };
}

export interface WorkflowStepCompletedEvent extends BaseProvenanceEvent {
  type: 'workflow.step.completed';
  payload: {
    workflowId: string;
    stepId: string;
    agentType: string;
    jobType: string;
    status: 'completed' | 'failed' | 'skipped';
    duration: number;
    result?: any;
    errorMessage?: string;
    nextSteps: string[];
  };
}

export interface WorkflowCompletedEvent extends BaseProvenanceEvent {
  type: 'workflow.completed';
  payload: {
    workflowId: string;
    workflowDefinitionId: string;
    status: 'completed' | 'failed' | 'partial';
    totalDuration: number;
    stepsCompleted: number;
    stepsSkipped: number;
    stepsFailed: number;
    finalResults: Record<string, any>;
    errors: Record<string, string>;
  };
}

// ===== ENTITY LIFECYCLE EVENTS =====

export interface EntityCreatedEvent extends BaseProvenanceEvent {
  type: 'entity.created';
  payload: {
    entityId: string;
    entityType: string;
    layer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    properties: Record<string, any>;
    clusterId?: string;
    parentEntityId?: string;
    createdBy: string;
    creationMethod: 'extraction' | 'manual' | 'import' | 'system';
  };
}

export interface EntityUpdatedEvent extends BaseProvenanceEvent {
  type: 'entity.updated';
  payload: {
    entityId: string;
    entityType: string;
    layer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    changedProperties: Record<string, { from: any; to: any }>;
    updatedBy: string;
    updateReason: string;
    versionId: string;
  };
}

export interface EntityDeletedEvent extends BaseProvenanceEvent {
  type: 'entity.deleted';
  payload: {
    entityId: string;
    entityType: string;
    layer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    deletedBy: string;
    deletionReason: string;
    softDelete: boolean;
    cascadeDeleted: string[]; // IDs of related entities also deleted
  };
}

// ===== RELATIONSHIP EVENTS =====

export interface RelationshipCreatedEvent extends BaseProvenanceEvent {
  type: 'relationship.created';
  payload: {
    relationshipId: string;
    relationshipType: string;
    fromEntityId: string;
    fromEntityType: string;
    toEntityId: string;
    toEntityType: string;
    properties?: Record<string, any>;
    temporal: boolean;
    validFrom?: string;
    validTo?: string;
    createdBy: string;
  };
}

export interface RelationshipEndedEvent extends BaseProvenanceEvent {
  type: 'relationship.ended';
  payload: {
    relationshipId: string;
    relationshipType: string;
    fromEntityId: string;
    toEntityId: string;
    endedAt: string;
    endedBy: string;
    endReason: string;
    replacedBy?: string; // New relationship ID if replaced
  };
}

// ===== SYSTEM EVENTS =====

export interface SystemHealthCheckEvent extends BaseProvenanceEvent {
  type: 'system.health_check';
  payload: {
    checkType: 'consistency' | 'performance' | 'integrity' | 'security';
    status: 'healthy' | 'warning' | 'critical';
    metrics: Record<string, number>;
    issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      affectedEntities: string[];
      recommendedAction: string;
    }>;
  };
}

export interface DataMigrationEvent extends BaseProvenanceEvent {
  type: 'data.migration';
  payload: {
    migrationId: string;
    migrationType: 'backfill' | 'schema_change' | 'data_repair';
    entitiesAffected: number;
    relationshipsAffected: number;
    duration: number;
    status: 'completed' | 'failed' | 'partial';
    errors?: string[];
  };
}

// ===== EVENT UNION TYPE =====

export type ProvenanceEvent = 
  | FileIngestedEvent
  | ClusterCreatedEvent
  | SlotClassifiedEvent
  | SlotReclassifiedEvent
  | ExtractionJobCreatedEvent
  | ExtractionJobCompletedEvent
  | ContentPromotedEvent
  | ContentRolledBackEvent
  | CrossLayerLinkCreatedEvent
  | CrossLayerValidationEvent
  | WorkflowStartedEvent
  | WorkflowStepCompletedEvent
  | WorkflowCompletedEvent
  | EntityCreatedEvent
  | EntityUpdatedEvent
  | EntityDeletedEvent
  | RelationshipCreatedEvent
  | RelationshipEndedEvent
  | SystemHealthCheckEvent
  | DataMigrationEvent;

// ===== EVENT FACTORY FUNCTIONS =====

export class ProvenanceEventFactory {
  static createFileIngestedEvent(
    orgId: string,
    agent: string,
    payload: FileIngestedEvent['payload'],
    commitId?: string
  ): FileIngestedEvent {
    return {
      id: this.generateEventId(),
      type: 'file.ingested',
      orgId,
      timestamp: new Date().toISOString(),
      agent,
      agentVersion: '1.0.0',
      commitId,
      payload
    };
  }

  static createClusterCreatedEvent(
    orgId: string,
    agent: string,
    payload: ClusterCreatedEvent['payload'],
    commitId?: string
  ): ClusterCreatedEvent {
    return {
      id: this.generateEventId(),
      type: 'cluster.created',
      orgId,
      timestamp: new Date().toISOString(),
      agent,
      agentVersion: '1.0.0',
      commitId,
      payload
    };
  }

  static createSlotClassifiedEvent(
    orgId: string,
    agent: string,
    payload: SlotClassifiedEvent['payload'],
    commitId?: string
  ): SlotClassifiedEvent {
    return {
      id: this.generateEventId(),
      type: 'slot.classified',
      orgId,
      timestamp: new Date().toISOString(),
      agent,
      agentVersion: '1.0.0',
      commitId,
      payload
    };
  }

  static createCrossLayerLinkCreatedEvent(
    orgId: string,
    agent: string,
    payload: CrossLayerLinkCreatedEvent['payload'],
    commitId?: string
  ): CrossLayerLinkCreatedEvent {
    return {
      id: this.generateEventId(),
      type: 'cross_layer.link.created',
      orgId,
      timestamp: new Date().toISOString(),
      agent,
      agentVersion: '1.0.0',
      commitId,
      payload
    };
  }

  static createWorkflowStartedEvent(
    orgId: string,
    agent: string,
    payload: WorkflowStartedEvent['payload'],
    commitId?: string
  ): WorkflowStartedEvent {
    return {
      id: this.generateEventId(),
      type: 'workflow.started',
      orgId,
      timestamp: new Date().toISOString(),
      agent,
      agentVersion: '1.0.0',
      commitId,
      payload
    };
  }

  static createEntityCreatedEvent(
    orgId: string,
    agent: string,
    payload: EntityCreatedEvent['payload'],
    commitId?: string
  ): EntityCreatedEvent {
    return {
      id: this.generateEventId(),
      type: 'entity.created',
      orgId,
      timestamp: new Date().toISOString(),
      agent,
      agentVersion: '1.0.0',
      commitId,
      payload
    };
  }

  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ===== EVENT VALIDATION SCHEMAS =====

export const EventValidationSchemas = {
  'file.ingested': {
    type: 'object',
    required: ['fileId', 'sourceId', 'path', 'name', 'mimeType', 'provider', 'eventType'],
    properties: {
      fileId: { type: 'string' },
      sourceId: { type: 'string' },
      projectId: { type: 'string' },
      path: { type: 'string' },
      name: { type: 'string' },
      size: { type: 'number', minimum: 0 },
      mimeType: { type: 'string' },
      checksum: { type: 'string' },
      provider: { enum: ['dropbox', 'gdrive', 'supabase', 'local'] },
      eventType: { enum: ['created', 'updated', 'deleted'] }
    }
  },
  
  'cluster.created': {
    type: 'object',
    required: ['clusterId', 'fileId', 'status'],
    properties: {
      clusterId: { type: 'string' },
      fileId: { type: 'string' },
      projectId: { type: 'string' },
      status: { enum: ['empty', 'extracting', 'staged', 'promoted'] },
      extractionMethod: { type: 'string' }
    }
  },
  
  'slot.classified': {
    type: 'object',
    required: ['fileId', 'slotKey', 'confidence', 'method', 'edgeFactId'],
    properties: {
      fileId: { type: 'string' },
      slotKey: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      method: { enum: ['rule-based', 'ml', 'manual'] },
      ruleId: { type: 'string' },
      edgeFactId: { type: 'string' },
      previousSlots: { type: 'array', items: { type: 'string' } }
    }
  },
  
  'cross_layer.link.created': {
    type: 'object',
    required: ['fromEntityId', 'fromEntityType', 'fromLayer', 'toEntityId', 'toEntityType', 'toLayer', 'relationshipType', 'method'],
    properties: {
      fromEntityId: { type: 'string' },
      fromEntityType: { type: 'string' },
      fromLayer: { enum: ['IRL', 'Idea', 'Ops', 'Provenance'] },
      toEntityId: { type: 'string' },
      toEntityType: { type: 'string' },
      toLayer: { enum: ['IRL', 'Idea', 'Ops', 'Provenance'] },
      relationshipType: { type: 'string' },
      edgeFactId: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      method: { enum: ['automatic', 'manual', 'inferred'] }
    }
  }
};

// ===== EVENT PROCESSOR INTERFACE =====

export interface EventProcessor {
  processEvent(event: ProvenanceEvent): Promise<void>;
  getEventHistory(orgId: string, entityId?: string, eventTypes?: string[]): Promise<ProvenanceEvent[]>;
  validateEvent(event: ProvenanceEvent): boolean;
}

// ===== COMMIT INTEGRATION =====

export interface CommitEventPayload {
  events: ProvenanceEvent[];
  summary: string;
  affectedEntities: string[];
  affectedRelationships: string[];
}

export function createCommitWithEvents(
  orgId: string,
  message: string,
  author: string,
  events: ProvenanceEvent[]
): CommitEventPayload {
  const affectedEntities = new Set<string>();
  const affectedRelationships = new Set<string>();
  
  events.forEach(event => {
    // Extract affected entities and relationships from event payloads
    if ('entityId' in event.payload) {
      affectedEntities.add(event.payload.entityId as string);
    }
    if ('fileId' in event.payload) {
      affectedEntities.add(event.payload.fileId as string);
    }
    if ('clusterId' in event.payload) {
      affectedEntities.add(event.payload.clusterId as string);
    }
    if ('relationshipId' in event.payload) {
      affectedRelationships.add(event.payload.relationshipId as string);
    }
  });

  return {
    events,
    summary: `${events.length} events: ${events.map(e => e.type).join(', ')}`,
    affectedEntities: Array.from(affectedEntities),
    affectedRelationships: Array.from(affectedRelationships)
  };
}
