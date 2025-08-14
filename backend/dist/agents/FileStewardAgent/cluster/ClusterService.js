"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterService = void 0;
const uuid_1 = require("uuid");
class ClusterService {
    constructor(neo4j, postgres, classifier) {
        this.neo4j = neo4j;
        this.postgres = postgres;
        this.classifier = classifier;
    }
    async createContentCluster(orgId, fileId) {
        const clusterId = (0, uuid_1.v4)();
        const query = `
      MATCH (f:File {id: $fileId})
      CREATE (cc:ContentCluster {
        id: $clusterId,
        orgId: $orgId,
        fileId: $fileId,
        projectId: f.project_id,
        status: 'empty',
        entitiesCount: 0,
        linksCount: 0,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      CREATE (f)-[:HAS_CLUSTER]->(cc)
      RETURN cc.id as clusterId
    `;
        await this.neo4j.run(query, { clusterId, orgId, fileId });
        await this.postgres.query(`
      INSERT INTO content_cluster (id, org_id, file_id, status, entities_count, links_count, created_at, updated_at)
      VALUES ($1, $2, $3, 'empty', 0, 0, NOW(), NOW())
    `, [clusterId, orgId, fileId]);
        return clusterId;
    }
    async performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata) {
        return this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata);
    }
}
exports.ClusterService = ClusterService;
//# sourceMappingURL=ClusterService.js.map