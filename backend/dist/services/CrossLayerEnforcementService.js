"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossLayerEnforcementService = void 0;
const ProvenanceEvents_1 = require("../types/ProvenanceEvents");
const uuid_1 = require("uuid");
class CrossLayerEnforcementService {
    constructor(neo4jService, postgresService) {
        this.rules = new Map();
        this.neo4jService = neo4jService;
        this.postgresService = postgresService;
        this.initializeDefaultRules();
    }
    initializeDefaultRules() {
        const defaultRules = [
            {
                id: 'scene-shootday-link',
                name: 'Scene to ShootDay Link',
                description: 'Every scheduled Scene must link to a ShootDay',
                fromLayer: 'Idea',
                fromEntityType: 'Scene',
                toLayer: 'IRL',
                toEntityType: 'ShootDay',
                relationshipType: 'SCHEDULED_ON',
                required: false,
                cardinality: 'N:1',
                validationQuery: `
          MATCH (s:Scene {status: 'scheduled'})
          WHERE NOT EXISTS((s)-[:SCHEDULED_ON]->(:ShootDay))
          RETURN s.id as entityId, 'Scene' as entityType, 
                 'missing_shootday_link' as violationType,
                 'Scheduled scene missing ShootDay link' as description
        `,
                repairQuery: `
          MATCH (s:Scene {id: $entityId})
          MATCH (sd:ShootDay {project_id: s.project_id})
          WHERE NOT EXISTS((s)-[:SCHEDULED_ON]->(:ShootDay))
          WITH s, sd
          ORDER BY sd.date
          LIMIT 1
          CREATE (s)-[:SCHEDULED_ON]->(sd)
          RETURN 'auto_linked_to_earliest_shootday' as repairAction
        `,
                enabled: true
            },
            {
                id: 'character-talent-link',
                name: 'Character to Talent Link',
                description: 'Every cast Character must link to a Talent',
                fromLayer: 'Idea',
                fromEntityType: 'Character',
                toLayer: 'IRL',
                toEntityType: 'Talent',
                relationshipType: 'PORTRAYED_BY',
                required: false,
                cardinality: 'N:1',
                validationQuery: `
          MATCH (c:Character {castingStatus: 'cast'})
          WHERE NOT EXISTS((c)-[:PORTRAYED_BY]->(:Talent))
          RETURN c.id as entityId, 'Character' as entityType,
                 'missing_talent_link' as violationType,
                 'Cast character missing Talent link' as description
        `,
                enabled: true
            },
            {
                id: 'scene-location-link',
                name: 'Scene to Location Link',
                description: 'Scenes with location requirements must link to Location entities',
                fromLayer: 'Idea',
                fromEntityType: 'Scene',
                toLayer: 'IRL',
                toEntityType: 'Location',
                relationshipType: 'HAS_LOCATION',
                required: false,
                cardinality: 'N:1',
                validationQuery: `
          MATCH (s:Scene)
          WHERE s.location IS NOT NULL AND s.location <> ''
          AND NOT EXISTS((s)-[:HAS_LOCATION]->(:Location))
          RETURN s.id as entityId, 'Scene' as entityType,
                 'missing_location_link' as violationType,
                 'Scene with location text missing Location entity link' as description
        `,
                repairQuery: `
          MATCH (s:Scene {id: $entityId})
          WHERE s.location IS NOT NULL
          MERGE (l:Location {name: s.location, project_id: s.project_id, org_id: s.org_id})
          ON CREATE SET l.id = randomUUID(), l.type = 'unknown', l.createdAt = datetime()
          CREATE (s)-[:HAS_LOCATION]->(l)
          RETURN 'created_location_from_scene_text' as repairAction
        `,
                enabled: true
            },
            {
                id: 'scene-budget-link',
                name: 'Scene to Budget Link',
                description: 'Scenes should link to relevant Budget line items',
                fromLayer: 'Idea',
                fromEntityType: 'Scene',
                toLayer: 'Ops',
                toEntityType: 'Budget',
                relationshipType: 'BUDGETED_BY',
                required: false,
                cardinality: 'N:N',
                validationQuery: `
          MATCH (s:Scene), (b:Budget {project_id: s.project_id})
          WHERE NOT EXISTS((s)-[:BUDGETED_BY]->(b))
          AND b.status = 'active'
          RETURN s.id as entityId, 'Scene' as entityType,
                 'missing_budget_link' as violationType,
                 'Scene not linked to project budget' as description
        `,
                enabled: true
            },
            {
                id: 'purchaseorder-scene-link',
                name: 'PurchaseOrder to Scene Link',
                description: 'PurchaseOrders with scene references must link to Scene entities',
                fromLayer: 'Ops',
                fromEntityType: 'PurchaseOrder',
                toLayer: 'Idea',
                toEntityType: 'Scene',
                relationshipType: 'FOR_SCENE',
                required: false,
                cardinality: 'N:N',
                validationQuery: `
          MATCH (po:PurchaseOrder)
          WHERE po.scene_id IS NOT NULL AND po.scene_id <> ''
          AND NOT EXISTS((po)-[:FOR_SCENE]->(:Scene))
          RETURN po.id as entityId, 'PurchaseOrder' as entityType,
                 'missing_scene_link' as violationType,
                 'PurchaseOrder with scene_id missing Scene link' as description
        `,
                repairQuery: `
          MATCH (po:PurchaseOrder {id: $entityId})
          MATCH (s:Scene {project_id: po.project_id})
          WHERE po.scene_id IS NOT NULL 
          AND (s.number = po.scene_id OR s.id = po.scene_id)
          CREATE (po)-[:FOR_SCENE]->(s)
          RETURN 'linked_po_to_scene_by_id' as repairAction
        `,
                enabled: true
            },
            {
                id: 'talent-purchaseorder-link',
                name: 'Talent to PurchaseOrder Link',
                description: 'Talent with associated costs should link to PurchaseOrders',
                fromLayer: 'Ops',
                fromEntityType: 'PurchaseOrder',
                toLayer: 'IRL',
                toEntityType: 'Talent',
                relationshipType: 'FOR_TALENT',
                required: false,
                cardinality: 'N:N',
                validationQuery: `
          MATCH (po:PurchaseOrder)
          WHERE po.crew_role IS NOT NULL AND po.crew_role <> ''
          AND po.crew_role CONTAINS 'actor'
          AND NOT EXISTS((po)-[:FOR_TALENT]->(:Talent))
          RETURN po.id as entityId, 'PurchaseOrder' as entityType,
                 'missing_talent_link' as violationType,
                 'Actor PurchaseOrder missing Talent link' as description
        `,
                enabled: true
            },
            {
                id: 'shootday-purchaseorder-link',
                name: 'ShootDay to PurchaseOrder Link',
                description: 'ShootDays should link to associated PurchaseOrders',
                fromLayer: 'IRL',
                fromEntityType: 'ShootDay',
                toLayer: 'Ops',
                toEntityType: 'PurchaseOrder',
                relationshipType: 'HAS_PURCHASE_ORDERS',
                required: false,
                cardinality: '1:N',
                validationQuery: `
          MATCH (sd:ShootDay), (po:PurchaseOrder {project_id: sd.project_id})
          WHERE po.needed_date IS NOT NULL
          AND date(po.needed_date) = date(sd.date)
          AND NOT EXISTS((sd)-[:HAS_PURCHASE_ORDERS]->(po))
          RETURN sd.id as entityId, 'ShootDay' as entityType,
                 'missing_purchase_order_link' as violationType,
                 'ShootDay missing link to same-date PurchaseOrders' as description
        `,
                repairQuery: `
          MATCH (sd:ShootDay {id: $entityId})
          MATCH (po:PurchaseOrder {project_id: sd.project_id})
          WHERE po.needed_date IS NOT NULL
          AND date(po.needed_date) = date(sd.date)
          CREATE (sd)-[:HAS_PURCHASE_ORDERS]->(po)
          RETURN 'linked_shootday_to_same_date_pos' as repairAction
        `,
                enabled: true
            },
            {
                id: 'compliance-scene-link',
                name: 'ComplianceRule to Scene Link',
                description: 'ComplianceRules should link to applicable Scenes',
                fromLayer: 'Ops',
                fromEntityType: 'ComplianceRule',
                toLayer: 'Idea',
                toEntityType: 'Scene',
                relationshipType: 'APPLIES_TO_SCENE',
                required: false,
                cardinality: 'N:N',
                validationQuery: `
          MATCH (cr:ComplianceRule), (s:Scene {project_id: cr.project_id})
          WHERE cr.category = 'location' 
          AND s.location IS NOT NULL
          AND NOT EXISTS((cr)-[:APPLIES_TO_SCENE]->(s))
          RETURN cr.id as entityId, 'ComplianceRule' as entityType,
                 'missing_scene_application' as violationType,
                 'Location compliance rule not applied to scenes' as description
        `,
                enabled: true
            },
            {
                id: 'file-cluster-link',
                name: 'File to ContentCluster Link',
                description: 'Every File must have exactly one ContentCluster',
                fromLayer: 'IRL',
                fromEntityType: 'File',
                toLayer: 'Idea',
                toEntityType: 'ContentCluster',
                relationshipType: 'HAS_CLUSTER',
                required: true,
                cardinality: '1:1',
                validationQuery: `
          MATCH (f:File {current: true, deleted: false})
          WHERE NOT EXISTS((f)-[:HAS_CLUSTER]->(:ContentCluster))
          RETURN f.id as entityId, 'File' as entityType,
                 'missing_cluster' as violationType,
                 'File missing required ContentCluster' as description
        `,
                repairQuery: `
          MATCH (f:File {id: $entityId})
          CREATE (cc:ContentCluster {
            id: randomUUID(),
            orgId: f.orgId,
            fileId: f.id,
            projectId: f.projectId,
            status: 'empty',
            entitiesCount: 0,
            linksCount: 0,
            createdAt: datetime(),
            updatedAt: datetime(),
            metadata: {}
          })
          CREATE (f)-[:HAS_CLUSTER]->(cc)
          RETURN 'created_missing_cluster' as repairAction
        `,
                enabled: true
            }
        ];
        defaultRules.forEach(rule => this.rules.set(rule.id, rule));
        console.log(`Initialized ${defaultRules.length} cross-layer enforcement rules`);
    }
    async createCrossLayerLink(orgId, request, commitId) {
        const relationshipId = (0, uuid_1.v4)();
        await this.validateEntitiesExist(request.fromEntityId, request.toEntityId);
        if (request.temporal) {
            const edgeFactId = await this.createTemporalRelationship(orgId, request, relationshipId, commitId);
            const event = ProvenanceEvents_1.ProvenanceEventFactory.createCrossLayerLinkCreatedEvent(orgId, 'cross-layer-enforcement-service', {
                fromEntityId: request.fromEntityId,
                fromEntityType: request.fromEntityType,
                fromLayer: request.fromLayer,
                toEntityId: request.toEntityId,
                toEntityType: request.toEntityType,
                toLayer: request.toLayer,
                relationshipType: request.relationshipType,
                edgeFactId,
                confidence: request.confidence,
                method: request.method
            }, commitId);
            console.log('Cross-layer link created:', event);
            return edgeFactId;
        }
        else {
            await this.createDirectRelationship(request, relationshipId);
            const event = ProvenanceEvents_1.ProvenanceEventFactory.createCrossLayerLinkCreatedEvent(orgId, 'cross-layer-enforcement-service', {
                fromEntityId: request.fromEntityId,
                fromEntityType: request.fromEntityType,
                fromLayer: request.fromLayer,
                toEntityId: request.toEntityId,
                toEntityType: request.toEntityType,
                toLayer: request.toLayer,
                relationshipType: request.relationshipType,
                method: request.method
            }, commitId);
            console.log('Cross-layer link created:', event);
            return relationshipId;
        }
    }
    async validateAllCrossLayerLinks(orgId) {
        const results = [];
        for (const rule of this.rules.values()) {
            if (!rule.enabled)
                continue;
            const result = await this.validateRule(orgId, rule);
            results.push(result);
        }
        const totalViolations = results.reduce((sum, r) => sum + r.violationsFound, 0);
        const totalRepaired = results.reduce((sum, r) => sum + r.violationsRepaired, 0);
        const validationEvent = {
            id: ProvenanceEvents_1.ProvenanceEventFactory['generateEventId'](),
            type: 'cross_layer.validation',
            orgId,
            timestamp: new Date().toISOString(),
            agent: 'cross-layer-enforcement-service',
            agentVersion: '1.0.0',
            payload: {
                validationType: 'consistency_check',
                entitiesValidated: results.length,
                violationsFound: totalViolations,
                violationsRepaired: totalRepaired,
                violations: results.flatMap(r => r.violations)
            }
        };
        console.log('Cross-layer validation completed:', validationEvent);
        return results;
    }
    async validateRule(orgId, rule) {
        const violations = await this.neo4jService.run(rule.validationQuery + ' AND s.org_id = $orgId', { orgId });
        const result = {
            ruleId: rule.id,
            ruleName: rule.name,
            violationsFound: violations.records.length,
            violationsRepaired: 0,
            violations: violations.records.map(record => ({
                entityId: record.get('entityId'),
                entityType: record.get('entityType'),
                violationType: record.get('violationType'),
                description: record.get('description'),
                repaired: false
            }))
        };
        if (rule.repairQuery) {
            for (const violation of result.violations) {
                try {
                    const repairResult = await this.neo4jService.run(rule.repairQuery, { entityId: violation.entityId, orgId });
                    if (repairResult.records.length > 0) {
                        violation.repaired = true;
                        violation.repairAction = repairResult.records[0].get('repairAction');
                        result.violationsRepaired++;
                    }
                }
                catch (error) {
                    console.error(`Failed to repair violation for ${violation.entityId}:`, error);
                }
            }
        }
        return result;
    }
    async createTemporalRelationship(orgId, request, relationshipId, commitId) {
        const edgeFactId = (0, uuid_1.v4)();
        const query = `
      CREATE (ef:EdgeFact {
        id: $edgeFactId,
        type: $relationshipType,
        from_id: $fromEntityId,
        to_id: $toEntityId,
        from_type: $fromEntityType,
        to_type: $toEntityType,
        valid_from: datetime($validFrom),
        valid_to: $validTo,
        created_by_commit: $commitId,
        org_id: $orgId,
        props: $properties,
        metadata: {
          fromLayer: $fromLayer,
          toLayer: $toLayer,
          method: $method,
          createdBy: $createdBy,
          confidence: $confidence
        }
      })
      RETURN ef.id as edgeFactId
    `;
        await this.neo4jService.run(query, {
            edgeFactId,
            relationshipType: request.relationshipType,
            fromEntityId: request.fromEntityId,
            toEntityId: request.toEntityId,
            fromEntityType: request.fromEntityType,
            toEntityType: request.toEntityType,
            validFrom: request.validFrom || new Date().toISOString(),
            validTo: request.validTo || null,
            commitId: commitId || null,
            orgId,
            properties: JSON.stringify(request.properties || {}),
            fromLayer: request.fromLayer,
            toLayer: request.toLayer,
            method: request.method,
            createdBy: request.createdBy,
            confidence: request.confidence || null
        });
        return edgeFactId;
    }
    async createDirectRelationship(request, relationshipId) {
        const query = `
      MATCH (from {id: $fromEntityId})
      MATCH (to {id: $toEntityId})
      CREATE (from)-[r:${request.relationshipType} {
        id: $relationshipId,
        createdAt: datetime(),
        createdBy: $createdBy,
        method: $method,
        confidence: $confidence,
        fromLayer: $fromLayer,
        toLayer: $toLayer
      }]->(to)
      RETURN r.id as relationshipId
    `;
        await this.neo4jService.run(query, {
            fromEntityId: request.fromEntityId,
            toEntityId: request.toEntityId,
            relationshipId,
            createdBy: request.createdBy,
            method: request.method,
            confidence: request.confidence || null,
            fromLayer: request.fromLayer,
            toLayer: request.toLayer,
            ...request.properties
        });
    }
    async validateEntitiesExist(fromEntityId, toEntityId) {
        const query = `
      OPTIONAL MATCH (from {id: $fromEntityId})
      OPTIONAL MATCH (to {id: $toEntityId})
      RETURN from IS NOT NULL as fromExists, to IS NOT NULL as toExists
    `;
        const result = await this.neo4jService.run(query, { fromEntityId, toEntityId });
        const record = result.records[0];
        if (!record.get('fromExists')) {
            throw new Error(`Source entity not found: ${fromEntityId}`);
        }
        if (!record.get('toExists')) {
            throw new Error(`Target entity not found: ${toEntityId}`);
        }
    }
    async getCrossLayerStatistics(orgId) {
        const queries = {
            totalFiles: `MATCH (f:File {orgId: $orgId, current: true, deleted: false}) RETURN count(f) as count`,
            filesWithClusters: `MATCH (f:File {orgId: $orgId, current: true, deleted: false})-[:HAS_CLUSTER]->(:ContentCluster) RETURN count(f) as count`,
            totalScenes: `MATCH (s:Scene {org_id: $orgId}) RETURN count(s) as count`,
            scheduledScenes: `MATCH (s:Scene {org_id: $orgId})-[:SCHEDULED_ON]->(:ShootDay) RETURN count(s) as count`,
            castCharacters: `MATCH (c:Character {org_id: $orgId})-[:PORTRAYED_BY]->(:Talent) RETURN count(c) as count`,
            crossLayerLinks: `MATCH (a)-[r]->(b) WHERE a.org_id = $orgId OR a.orgId = $orgId RETURN type(r) as relType, count(r) as count`,
            edgeFacts: `MATCH (ef:EdgeFact {org_id: $orgId}) RETURN ef.type as type, count(ef) as count`
        };
        const stats = {};
        for (const [key, query] of Object.entries(queries)) {
            try {
                const result = await this.neo4jService.run(query, { orgId });
                if (key === 'crossLayerLinks' || key === 'edgeFacts') {
                    stats[key] = result.records.map(r => ({
                        type: r.get('type') || r.get('relType'),
                        count: r.get('count').toNumber()
                    }));
                }
                else {
                    stats[key] = result.records[0]?.get('count').toNumber() || 0;
                }
            }
            catch (error) {
                console.error(`Failed to get ${key} statistics:`, error);
                stats[key] = 0;
            }
        }
        stats.clusterCoverage = stats.totalFiles > 0 ?
            (stats.filesWithClusters / stats.totalFiles * 100).toFixed(1) + '%' : '0%';
        stats.scheduleCompleteness = stats.totalScenes > 0 ?
            (stats.scheduledScenes / stats.totalScenes * 100).toFixed(1) + '%' : '0%';
        return stats;
    }
    addRule(rule) {
        this.rules.set(rule.id, rule);
        console.log(`Added cross-layer rule: ${rule.name}`);
    }
    removeRule(ruleId) {
        const removed = this.rules.delete(ruleId);
        if (removed) {
            console.log(`Removed cross-layer rule: ${ruleId}`);
        }
        return removed;
    }
    getRules() {
        return Array.from(this.rules.values());
    }
    async validateAllLinks(orgId) {
        if (!orgId) {
            throw new Error('Organization ID is required for cross-layer link validation');
        }
        return await this.validateAllCrossLayerLinks(orgId);
    }
    setRuleEnabled(ruleId, enabled) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = enabled;
            console.log(`${enabled ? 'Enabled' : 'Disabled'} cross-layer rule: ${rule.name}`);
            return true;
        }
        return false;
    }
    async repairViolations(orgId, entityIds) {
        const results = [];
        for (const rule of this.rules.values()) {
            if (!rule.enabled || !rule.repairQuery)
                continue;
            const result = {
                ruleId: rule.id,
                ruleName: rule.name,
                violationsFound: 0,
                violationsRepaired: 0,
                violations: []
            };
            for (const entityId of entityIds) {
                try {
                    const repairResult = await this.neo4jService.run(rule.repairQuery, { entityId, orgId });
                    if (repairResult.records.length > 0) {
                        result.violationsRepaired++;
                        result.violations.push({
                            entityId,
                            entityType: rule.fromEntityType,
                            violationType: 'repaired',
                            description: `Repaired ${rule.name}`,
                            repaired: true,
                            repairAction: repairResult.records[0].get('repairAction')
                        });
                    }
                }
                catch (error) {
                    console.error(`Failed to repair ${rule.name} for ${entityId}:`, error);
                    result.violations.push({
                        entityId,
                        entityType: rule.fromEntityType,
                        violationType: 'repair_failed',
                        description: `Failed to repair ${rule.name}: ${error}`,
                        repaired: false
                    });
                }
            }
            if (result.violations.length > 0) {
                results.push(result);
            }
        }
        return results;
    }
}
exports.CrossLayerEnforcementService = CrossLayerEnforcementService;
//# sourceMappingURL=CrossLayerEnforcementService.js.map