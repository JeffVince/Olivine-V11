export interface BaseProvenanceEvent {
    id: string;
    type: string;
    orgId: string;
    timestamp: string;
    agent: string;
    agentVersion: string;
    commitId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}
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
        previousSlots?: string[];
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
        duration: number;
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
        promotedBy: string;
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
        edgeFactId?: string;
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
        changedProperties: Record<string, {
            from: any;
            to: any;
        }>;
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
        cascadeDeleted: string[];
    };
}
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
        replacedBy?: string;
    };
}
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
export type ProvenanceEvent = FileIngestedEvent | ClusterCreatedEvent | SlotClassifiedEvent | SlotReclassifiedEvent | ExtractionJobCreatedEvent | ExtractionJobCompletedEvent | ContentPromotedEvent | ContentRolledBackEvent | CrossLayerLinkCreatedEvent | CrossLayerValidationEvent | WorkflowStartedEvent | WorkflowStepCompletedEvent | WorkflowCompletedEvent | EntityCreatedEvent | EntityUpdatedEvent | EntityDeletedEvent | RelationshipCreatedEvent | RelationshipEndedEvent | SystemHealthCheckEvent | DataMigrationEvent;
export declare class ProvenanceEventFactory {
    static createFileIngestedEvent(orgId: string, agent: string, payload: FileIngestedEvent['payload'], commitId?: string): FileIngestedEvent;
    static createClusterCreatedEvent(orgId: string, agent: string, payload: ClusterCreatedEvent['payload'], commitId?: string): ClusterCreatedEvent;
    static createSlotClassifiedEvent(orgId: string, agent: string, payload: SlotClassifiedEvent['payload'], commitId?: string): SlotClassifiedEvent;
    static createCrossLayerLinkCreatedEvent(orgId: string, agent: string, payload: CrossLayerLinkCreatedEvent['payload'], commitId?: string): CrossLayerLinkCreatedEvent;
    static createWorkflowStartedEvent(orgId: string, agent: string, payload: WorkflowStartedEvent['payload'], commitId?: string): WorkflowStartedEvent;
    static createEntityCreatedEvent(orgId: string, agent: string, payload: EntityCreatedEvent['payload'], commitId?: string): EntityCreatedEvent;
    private static generateEventId;
}
export declare const EventValidationSchemas: {
    'file.ingested': {
        type: string;
        required: string[];
        properties: {
            fileId: {
                type: string;
            };
            sourceId: {
                type: string;
            };
            projectId: {
                type: string;
            };
            path: {
                type: string;
            };
            name: {
                type: string;
            };
            size: {
                type: string;
                minimum: number;
            };
            mimeType: {
                type: string;
            };
            checksum: {
                type: string;
            };
            provider: {
                enum: string[];
            };
            eventType: {
                enum: string[];
            };
        };
    };
    'cluster.created': {
        type: string;
        required: string[];
        properties: {
            clusterId: {
                type: string;
            };
            fileId: {
                type: string;
            };
            projectId: {
                type: string;
            };
            status: {
                enum: string[];
            };
            extractionMethod: {
                type: string;
            };
        };
    };
    'slot.classified': {
        type: string;
        required: string[];
        properties: {
            fileId: {
                type: string;
            };
            slotKey: {
                type: string;
            };
            confidence: {
                type: string;
                minimum: number;
                maximum: number;
            };
            method: {
                enum: string[];
            };
            ruleId: {
                type: string;
            };
            edgeFactId: {
                type: string;
            };
            previousSlots: {
                type: string;
                items: {
                    type: string;
                };
            };
        };
    };
    'cross_layer.link.created': {
        type: string;
        required: string[];
        properties: {
            fromEntityId: {
                type: string;
            };
            fromEntityType: {
                type: string;
            };
            fromLayer: {
                enum: string[];
            };
            toEntityId: {
                type: string;
            };
            toEntityType: {
                type: string;
            };
            toLayer: {
                enum: string[];
            };
            relationshipType: {
                type: string;
            };
            edgeFactId: {
                type: string;
            };
            confidence: {
                type: string;
                minimum: number;
                maximum: number;
            };
            method: {
                enum: string[];
            };
        };
    };
};
export interface EventProcessor {
    processEvent(event: ProvenanceEvent): Promise<void>;
    getEventHistory(orgId: string, entityId?: string, eventTypes?: string[]): Promise<ProvenanceEvent[]>;
    validateEvent(event: ProvenanceEvent): boolean;
}
export interface CommitEventPayload {
    events: ProvenanceEvent[];
    summary: string;
    affectedEntities: string[];
    affectedRelationships: string[];
}
export declare function createCommitWithEvents(orgId: string, message: string, author: string, events: ProvenanceEvent[]): CommitEventPayload;
//# sourceMappingURL=ProvenanceEvents.d.ts.map