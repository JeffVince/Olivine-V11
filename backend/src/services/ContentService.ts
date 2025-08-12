import { Neo4jService } from './Neo4jService';
import { ProvenanceService } from './provenance/ProvenanceService';
import { v4 as uuidv4 } from 'uuid';

export interface ContentInput {
  orgId: string;
  contentKey: string;
  contentType: 'note' | 'next_step' | 'summary' | 'insight' | 'action_item';
  title: string;
  description?: string;
  format: 'text' | 'markdown' | 'html';
  metadata?: Record<string, any>;
  references?: string[]; // File IDs or other content IDs
  derivedFrom?: string[]; // Content IDs this is derived from
}

export interface Content {
  id: string;
  orgId: string;
  contentKey: string;
  contentType: string;
  title: string;
  description?: string;
  format: string;
  status: string;
  current: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export class ContentService {
  private neo4jService: Neo4jService;
  private provenanceService: ProvenanceService;

  constructor() {
    this.neo4jService = new Neo4jService();
    this.provenanceService = new ProvenanceService();
  }

  /**
   * Create new structured content (notes, next steps, etc.)
   */
  async createContent(input: ContentInput, userId: string): Promise<Content> {
    const contentId = uuidv4();
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

    // Create references if provided
    if (input.references && input.references.length > 0) {
      await this.createContentReferences(contentId, input.references, input.orgId);
    }

    // Create derivation relationships if provided
    if (input.derivedFrom && input.derivedFrom.length > 0) {
      await this.createDerivationRelationships(contentId, input.derivedFrom, input.orgId);
    }

    // Record provenance for content creation
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

  /**
   * Update existing content
   */
  async updateContent(contentId: string, updates: Partial<ContentInput>, userId: string): Promise<Content> {
    const now = new Date().toISOString();
    
    const setParts = [];
    const params: Record<string, any> = {
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

    // Record provenance for content update
    const commitId = await this.provenanceService.createCommit({
      orgId: updates.orgId!,
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
    }, updates.orgId!);

    const content = result.records[0].get('c').properties;
    return this.mapToContent(content);
  }

  /**
   * Get content by ID
   */
  async getContent(contentId: string, orgId: string): Promise<Content | null> {
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

  /**
   * List content by type and organization
   */
  async listContent(
    orgId: string, 
    contentType?: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<Content[]> {
    const whereConditions = ['c.org_id = $orgId', 'c.current = true', 'c.deleted = false'];
    const params: Record<string, any> = { orgId, limit, offset };

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

    return result.records.map((record: any) => {
      const content = record.get('c').properties;
      return this.mapToContent(content);
    });
  }

  /**
   * Delete content (soft delete)
   */
  async deleteContent(contentId: string, orgId: string, userId: string): Promise<boolean> {
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
      // Record provenance for content deletion
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

  /**
   * Search content by text
   */
  async searchContent(
    orgId: string, 
    searchText: string, 
    contentType?: string,
    limit: number = 20
  ): Promise<{ content: Content; score: number }[]> {
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

    return result.records.map((record: any) => ({
      content: this.mapToContent(record.get('c').properties),
      score: record.get('score')
    }));
  }

  /**
   * Create references between content and files/other content
   */
  private async createContentReferences(contentId: string, references: string[], orgId: string): Promise<void> {
    for (const refId of references) {
      // Try to create reference to File first
      const fileRefQuery = `
        MATCH (c:Content {id: $contentId, org_id: $orgId})
        MATCH (f:File {id: $refId, org_id: $orgId})
        MERGE (c)-[:REFERENCES]->(f)
      `;

      await this.neo4jService.run(fileRefQuery, { contentId, refId, orgId });

      // If no file found, try Content
      const contentRefQuery = `
        MATCH (c1:Content {id: $contentId, org_id: $orgId})
        MATCH (c2:Content {id: $refId, org_id: $orgId})
        MERGE (c1)-[:REFERENCES]->(c2)
      `;

      await this.neo4jService.run(contentRefQuery, { contentId, refId, orgId });
    }
  }

  /**
   * Create derivation relationships between content
   */
  private async createDerivationRelationships(contentId: string, derivedFrom: string[], orgId: string): Promise<void> {
    for (const sourceId of derivedFrom) {
      const query = `
        MATCH (c1:Content {id: $contentId, org_id: $orgId})
        MATCH (c2:Content {id: $sourceId, org_id: $orgId})
        MERGE (c1)-[:DERIVED_FROM]->(c2)
      `;

      await this.neo4jService.run(query, { contentId, sourceId, orgId });
    }
  }

  /**
   * Map Neo4j node properties to Content interface
   */
  private mapToContent(props: any): Content {
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
