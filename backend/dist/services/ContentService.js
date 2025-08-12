"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
const Neo4jService_1 = require("./Neo4jService");
const ProvenanceService_1 = require("./provenance/ProvenanceService");
const uuid_1 = require("uuid");
class ContentService {
    constructor() {
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.provenanceService = new ProvenanceService_1.ProvenanceService();
    }
    async createContent(input, userId) {
        const contentId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const query = `
      CREATE (c:Content {
        id: $contentId,
        org_id: $orgId,
        content_key: $contentKey,
        content_type: $contentType,
        title: $title,
        description: $description,
        format: $format,
        status: 'active',
        current: true,
        deleted: false,
        created_at: datetime($now),
        updated_at: datetime($now),
        metadata: $metadata
      })
      RETURN c
    `;
        const result = await this.neo4jService.run(query, {
            contentId,
            orgId: input.orgId,
            contentKey: input.contentKey,
            contentType: input.contentType,
            title: input.title,
            description: input.description || '',
            format: input.format,
            now,
            metadata: JSON.stringify(input.metadata || {})
        });
        if (result.records.length === 0) {
            throw new Error('Failed to create content');
        }
        if (input.references && input.references.length > 0) {
            await this.createContentReferences(contentId, input.references, input.orgId);
        }
        if (input.derivedFrom && input.derivedFrom.length > 0) {
            await this.createDerivationRelationships(contentId, input.derivedFrom, input.orgId);
        }
        const commitId = await this.provenanceService.createCommit({
            orgId: input.orgId,
            message: `Create ${input.contentType}: ${input.title}`,
            author: userId,
            authorType: 'user',
            metadata: { contentType: input.contentType }
        });
        await this.provenanceService.createAction(commitId, {
            actionType: 'CREATE_CONTENT',
            tool: 'ContentService',
            entityType: 'Content',
            entityId: contentId,
            status: 'success',
            metadata: {
                contentType: input.contentType,
                title: input.title
            }
        }, input.orgId);
        const content = result.records[0].get('c').properties;
        return this.mapToContent(content);
    }
    async updateContent(contentId, updates, userId) {
        const now = new Date().toISOString();
        const setParts = [];
        const params = {
            contentId,
            orgId: updates.orgId,
            now
        };
        if (updates.title) {
            setParts.push('c.title = $title');
            params.title = updates.title;
        }
        if (updates.description !== undefined) {
            setParts.push('c.description = $description');
            params.description = updates.description;
        }
        if (updates.format) {
            setParts.push('c.format = $format');
            params.format = updates.format;
        }
        if (updates.metadata) {
            setParts.push('c.metadata = $metadata');
            params.metadata = JSON.stringify(updates.metadata);
        }
        if (setParts.length === 0) {
            throw new Error('No updates provided');
        }
        setParts.push('c.updated_at = datetime($now)');
        const query = `
      MATCH (c:Content {id: $contentId, org_id: $orgId})
      SET ${setParts.join(', ')}
      RETURN c
    `;
        const result = await this.neo4jService.run(query, params);
        if (result.records.length === 0) {
            throw new Error('Content not found or update failed');
        }
        const commitId = await this.provenanceService.createCommit({
            orgId: updates.orgId,
            message: `Update content: ${contentId}`,
            author: userId,
            authorType: 'user',
            metadata: { updates: Object.keys(updates) }
        });
        await this.provenanceService.createAction(commitId, {
            actionType: 'UPDATE_CONTENT',
            tool: 'ContentService',
            entityType: 'Content',
            entityId: contentId,
            status: 'success',
            metadata: {
                updates: Object.keys(updates)
            }
        }, updates.orgId);
        const content = result.records[0].get('c').properties;
        return this.mapToContent(content);
    }
    async getContent(contentId, orgId) {
        const query = `
      MATCH (c:Content {id: $contentId, org_id: $orgId, current: true, deleted: false})
      RETURN c
    `;
        const result = await this.neo4jService.run(query, {
            contentId,
            orgId
        });
        if (result.records.length === 0) {
            return null;
        }
        const content = result.records[0].get('c').properties;
        return this.mapToContent(content);
    }
    async listContent(orgId, contentType, limit = 50, offset = 0) {
        const whereConditions = ['c.org_id = $orgId', 'c.current = true', 'c.deleted = false'];
        const params = { orgId, limit, offset };
        if (contentType) {
            whereConditions.push('c.content_type = $contentType');
            params.contentType = contentType;
        }
        const query = `
      MATCH (c:Content)
      WHERE ${whereConditions.join(' AND ')}
      RETURN c
      ORDER BY c.updated_at DESC
      SKIP $offset
      LIMIT $limit
    `;
        const result = await this.neo4jService.run(query, params);
        return result.records.map((record) => {
            const content = record.get('c').properties;
            return this.mapToContent(content);
        });
    }
    async deleteContent(contentId, orgId, userId) {
        const now = new Date().toISOString();
        const query = `
      MATCH (c:Content {id: $contentId, org_id: $orgId})
      SET c.deleted = true, c.updated_at = datetime($now)
      RETURN c
    `;
        const result = await this.neo4jService.run(query, {
            contentId,
            orgId,
            now
        });
        if (result.records.length > 0) {
            const commitId = await this.provenanceService.createCommit({
                orgId,
                message: `Delete content: ${contentId}`,
                author: userId,
                authorType: 'user',
                metadata: {}
            });
            await this.provenanceService.createAction(commitId, {
                actionType: 'DELETE_CONTENT',
                tool: 'ContentService',
                entityType: 'Content',
                entityId: contentId,
                status: 'success',
                metadata: {}
            }, orgId);
            return true;
        }
        return false;
    }
    async searchContent(orgId, searchText, contentType, limit = 20) {
        const typeFilter = contentType ? `AND c.content_type = "${contentType}"` : '';
        const query = `
      CALL db.index.fulltext.queryNodes("content_search", $searchText)
      YIELD node, score
      WHERE node.org_id = $orgId AND node.current = true AND node.deleted = false ${typeFilter}
      RETURN node as c, score
      ORDER BY score DESC
      LIMIT $limit
    `;
        const result = await this.neo4jService.run(query, {
            searchText,
            orgId,
            limit
        });
        return result.records.map((record) => ({
            content: this.mapToContent(record.get('c').properties),
            score: record.get('score')
        }));
    }
    async createContentReferences(contentId, references, orgId) {
        for (const refId of references) {
            const fileRefQuery = `
        MATCH (c:Content {id: $contentId, org_id: $orgId})
        MATCH (f:File {id: $refId, org_id: $orgId})
        MERGE (c)-[:REFERENCES]->(f)
      `;
            await this.neo4jService.run(fileRefQuery, { contentId, refId, orgId });
            const contentRefQuery = `
        MATCH (c1:Content {id: $contentId, org_id: $orgId})
        MATCH (c2:Content {id: $refId, org_id: $orgId})
        MERGE (c1)-[:REFERENCES]->(c2)
      `;
            await this.neo4jService.run(contentRefQuery, { contentId, refId, orgId });
        }
    }
    async createDerivationRelationships(contentId, derivedFrom, orgId) {
        for (const sourceId of derivedFrom) {
            const query = `
        MATCH (c1:Content {id: $contentId, org_id: $orgId})
        MATCH (c2:Content {id: $sourceId, org_id: $orgId})
        MERGE (c1)-[:DERIVED_FROM]->(c2)
      `;
            await this.neo4jService.run(query, { contentId, sourceId, orgId });
        }
    }
    mapToContent(props) {
        return {
            id: props.id,
            orgId: props.org_id,
            contentKey: props.content_key,
            contentType: props.content_type,
            title: props.title,
            description: props.description || undefined,
            format: props.format,
            status: props.status,
            current: props.current,
            deleted: props.deleted,
            createdAt: new Date(props.created_at),
            updatedAt: new Date(props.updated_at),
            metadata: JSON.parse(props.metadata || '{}')
        };
    }
}
exports.ContentService = ContentService;
//# sourceMappingURL=ContentService.js.map