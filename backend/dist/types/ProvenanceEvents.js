"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventValidationSchemas = exports.ProvenanceEventFactory = void 0;
exports.createCommitWithEvents = createCommitWithEvents;
class ProvenanceEventFactory {
    static createFileIngestedEvent(orgId, agent, payload, commitId) {
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
    static createClusterCreatedEvent(orgId, agent, payload, commitId) {
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
    static createSlotClassifiedEvent(orgId, agent, payload, commitId) {
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
    static createCrossLayerLinkCreatedEvent(orgId, agent, payload, commitId) {
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
    static createWorkflowStartedEvent(orgId, agent, payload, commitId) {
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
    static createEntityCreatedEvent(orgId, agent, payload, commitId) {
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
    static generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ProvenanceEventFactory = ProvenanceEventFactory;
exports.EventValidationSchemas = {
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
function createCommitWithEvents(orgId, message, author, events) {
    const affectedEntities = new Set();
    const affectedRelationships = new Set();
    events.forEach(event => {
        if ('entityId' in event.payload) {
            affectedEntities.add(event.payload.entityId);
        }
        if ('fileId' in event.payload) {
            affectedEntities.add(event.payload.fileId);
        }
        if ('clusterId' in event.payload) {
            affectedEntities.add(event.payload.clusterId);
        }
        if ('relationshipId' in event.payload) {
            affectedRelationships.add(event.payload.relationshipId);
        }
    });
    return {
        events,
        summary: `${events.length} events: ${events.map(e => e.type).join(', ')}`,
        affectedEntities: Array.from(affectedEntities),
        affectedRelationships: Array.from(affectedRelationships)
    };
}
//# sourceMappingURL=ProvenanceEvents.js.map