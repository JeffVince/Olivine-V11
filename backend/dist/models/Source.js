"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceModel = void 0;
const PostgresService_1 = require("../services/PostgresService");
const Neo4jService_1 = require("../services/Neo4jService");
class SourceModel {
    constructor() {
        this.postgresService = new PostgresService_1.PostgresService();
        this.neo4jService = new Neo4jService_1.Neo4jService();
    }
    async createSource(sourceData) {
        const query = `
      INSERT INTO sources (organization_id, name, type, config, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
        const values = [
            sourceData.organizationId,
            sourceData.name,
            sourceData.type,
            JSON.stringify(sourceData.config),
            sourceData.active
        ];
        const result = await this.postgresService.executeQuery(query, values);
        return this.mapRowToSource(result.rows[0]);
    }
    async getSource(sourceId, organizationId) {
        const query = `
      SELECT * FROM sources 
      WHERE id = $1 AND organization_id = $2
    `;
        const result = await this.postgresService.executeQuery(query, [sourceId, organizationId]);
        return result.rows.length > 0 ? this.mapRowToSource(result.rows[0]) : null;
    }
    async getSourcesByOrganization(organizationId) {
        const query = `
      SELECT * FROM sources 
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;
        const result = await this.postgresService.executeQuery(query, [organizationId]);
        return result.rows.map(row => this.mapRowToSource(row));
    }
    async updateSourceConfig(sourceId, organizationId, config) {
        const query = `
      UPDATE sources 
      SET config = $3, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
    `;
        const result = await this.postgresService.executeQuery(query, [
            sourceId,
            organizationId,
            JSON.stringify(config)
        ]);
        return (result.rowCount || 0) > 0;
    }
    async updateSourceStatus(sourceId, organizationId, active) {
        const query = `
      UPDATE sources 
      SET active = $3, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
    `;
        const result = await this.postgresService.executeQuery(query, [sourceId, organizationId, active]);
        return (result.rowCount || 0) > 0;
    }
    async deleteSource(sourceId, organizationId) {
        const query = `
      DELETE FROM sources 
      WHERE id = $1 AND organization_id = $2
    `;
        const result = await this.postgresService.executeQuery(query, [sourceId, organizationId]);
        return (result.rowCount || 0) > 0;
    }
    async syncToGraph(sourceData) {
        const query = `
      MERGE (s:Source {id: $sourceId, organizationId: $orgId})
      SET s.name = $name,
          s.type = $type,
          s.active = $active,
          s.createdAt = datetime($createdAt),
          s.updatedAt = datetime($updatedAt),
          s.config = $config
      
      // Create relationship to organization
      WITH s
      MERGE (o:Organization {id: $orgId})
      MERGE (s)-[:BELONGS_TO]->(o)
      
      RETURN s
    `;
        const params = {
            sourceId: sourceData.id,
            orgId: sourceData.organizationId,
            name: sourceData.name,
            type: sourceData.type,
            active: sourceData.active,
            createdAt: sourceData.createdAt.toISOString(),
            updatedAt: sourceData.updatedAt.toISOString(),
            config: JSON.stringify(sourceData.config)
        };
        await this.neo4jService.executeQuery(query, params);
    }
    async removeFromGraph(sourceId, organizationId) {
        const query = `
      MATCH (s:Source {id: $sourceId, organizationId: $orgId})
      DETACH DELETE s
    `;
        await this.neo4jService.executeQuery(query, { sourceId, orgId: organizationId });
    }
    mapRowToSource(row) {
        return {
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            type: row.type,
            config: row.config,
            active: row.active,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
exports.SourceModel = SourceModel;
//# sourceMappingURL=Source.js.map