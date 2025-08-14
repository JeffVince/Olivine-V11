"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossLayerLinkService = void 0;
class CrossLayerLinkService {
    constructor(neo4j) {
        this.neo4j = neo4j;
    }
    async createInitialCrossLayerLinks(orgId, fileId, slots) {
        let linksCreated = 0;
        if (slots.includes('SCRIPT_PRIMARY')) {
            const scenes = await this.getProjectScenes(orgId, fileId);
            for (const scene of scenes) {
                await this.createCrossLayerLink(fileId, scene.id, 'SCRIPT_FOR', orgId);
                linksCreated++;
            }
        }
        if (slots.includes('BUDGET_MASTER')) {
            const pos = await this.getProjectPurchaseOrders(orgId, fileId);
            for (const po of pos) {
                await this.createCrossLayerLink(fileId, po.id, 'BUDGET_FOR', orgId);
                linksCreated++;
            }
        }
        return linksCreated;
    }
    async getProjectScenes(orgId, fileId) {
        const query = `
      MATCH (f:File {id: $fileId})-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(s:Scene)
      WHERE s.org_id = $orgId
      RETURN s.id as id, s.number as number, s.title as title
      LIMIT 10
    `;
        const result = await this.neo4j.run(query, { fileId, orgId });
        return result.records.map((r) => ({ id: r.get('id'), number: r.get('number'), title: r.get('title') }));
    }
    async getProjectPurchaseOrders(orgId, fileId) {
        const query = `
      MATCH (f:File {id: $fileId})-[:BELONGS_TO]->(p:Project)
      MATCH (p)<-[:BELONGS_TO]-(po:PurchaseOrder)
      WHERE po.org_id = $orgId
      RETURN po.id as id, po.number as number, po.vendor as vendor
      LIMIT 5
    `;
        const result = await this.neo4j.run(query, { fileId, orgId });
        return result.records.map((r) => ({ id: r.get('id'), number: r.get('number'), vendor: r.get('vendor') }));
    }
    async createCrossLayerLink(fromEntityId, toEntityId, relationshipType, orgId) {
        const query = `
      MATCH (from {id: $fromEntityId}), (to {id: $toEntityId})
      CREATE (from)-[r:${relationshipType} {
        orgId: $orgId,
        createdAt: datetime(),
        method: 'automatic',
        createdBy: 'file-steward-agent'
      }]->(to)
      RETURN r
    `;
        await this.neo4j.run(query, { fromEntityId, toEntityId, orgId });
    }
}
exports.CrossLayerLinkService = CrossLayerLinkService;
//# sourceMappingURL=CrossLayerLinkService.js.map