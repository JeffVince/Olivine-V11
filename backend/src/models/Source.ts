import { PostgresService } from '../services/PostgresService';
import { Neo4jService } from '../services/Neo4jService';

export interface SourceMetadata {
  id: string;
  orgId: string;
  name: string;
  type: 'dropbox' | 'google_drive' | 'onedrive' | 'local';
  config: any;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceConfig {
  // Common fields
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  
  // Dropbox specific
  dropboxAccountId?: string;
  dropboxTeamMemberId?: string;
  dropboxIsTeamAccount?: boolean;
  dropboxRootNamespaceId?: string;
  dropboxHomeNamespaceId?: string;
  
  // Google Drive specific
  googleClientId?: string;
  googleClientSecret?: string;
  googleScope?: string[];
  
  // Other provider specific configs
  [key: string]: any;
}

export class SourceModel {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Source model implementation with PostgreSQL and Neo4j
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Source model Neo4j integration
  // TODO: Implementation Plan - 04-Data-Storage-Implementation.md - Source model PostgreSQL integration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend source model tests
  private postgresService: PostgresService;
  private neo4jService: Neo4jService;

  constructor() {
    this.postgresService = new PostgresService();
    this.neo4jService = new Neo4jService();
  }

  /**
   * Create a new source
   */
  async createSource(sourceData: Omit<SourceMetadata, 'id' | 'createdAt' | 'updatedAt'>): Promise<SourceMetadata> {
    const query = `
      INSERT INTO sources (orgId, name, type, config, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      sourceData.orgId,
      sourceData.name,
      sourceData.type,
      JSON.stringify(sourceData.config),
      sourceData.active
    ];

    const result = await this.postgresService.executeQuery(query, values);
    return this.mapRowToSource(result.rows[0]);
  }

  /**
   * Get a source by ID and organization
   */
  async getSource(sourceId: string, orgId: string): Promise<SourceMetadata | null> {
    const query = `
      SELECT * FROM sources 
      WHERE id = $1 AND orgId = $2
    `;
    
    const result = await this.postgresService.executeQuery(query, [sourceId, orgId]);
    return result.rows.length > 0 ? this.mapRowToSource(result.rows[0]) : null;
  }

  /**
   * Get all sources for an organization
   */
  async getSourcesByOrganization(orgId: string): Promise<SourceMetadata[]> {
    const query = `
      SELECT * FROM sources 
      WHERE orgId = $1
      ORDER BY created_at DESC
    `;
    
    const result = await this.postgresService.executeQuery(query, [orgId]);
    return result.rows.map(row => this.mapRowToSource(row));
  }

  /**
   * Update source configuration
   */
  async updateSourceConfig(sourceId: string, orgId: string, config: SourceConfig): Promise<boolean> {
    const query = `
      UPDATE sources 
      SET config = $3, updated_at = NOW()
      WHERE id = $1 AND orgId = $2
    `;
    
    const result = await this.postgresService.executeQuery(query, [
      sourceId, 
      orgId, 
      JSON.stringify(config)
    ]);
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Update source active status
   */
  async updateSourceStatus(sourceId: string, orgId: string, active: boolean): Promise<boolean> {
    const query = `
      UPDATE sources 
      SET active = $3, updated_at = NOW()
      WHERE id = $1 AND orgId = $2
    `;
    
    const result = await this.postgresService.executeQuery(query, [sourceId, orgId, active]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Delete a source
   */
  async deleteSource(sourceId: string, orgId: string): Promise<boolean> {
    const query = `
      DELETE FROM sources 
      WHERE id = $1 AND orgId = $2
    `;
    
    const result = await this.postgresService.executeQuery(query, [sourceId, orgId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Create or update source node in Neo4j knowledge graph
   */
  async syncToGraph(sourceData: SourceMetadata): Promise<void> {
    const query = `
      MERGE (s:Source {id: $sourceId, orgId: $orgId})
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
      orgId: sourceData.orgId,
      name: sourceData.name,
      type: sourceData.type,
      active: sourceData.active,
      createdAt: sourceData.createdAt.toISOString(),
      updatedAt: sourceData.updatedAt.toISOString(),
      config: JSON.stringify(sourceData.config)
    };

    await this.neo4jService.executeQuery(query, params);
  }

  /**
   * Remove source node from Neo4j knowledge graph
   */
  async removeFromGraph(sourceId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (s:Source {id: $sourceId, orgId: $orgId})
      DETACH DELETE s
    `;

    await this.neo4jService.executeQuery(query, { sourceId, orgId: orgId });
  }

  /**
   * Map database row to SourceMetadata interface
   */
  private mapRowToSource(row: any): SourceMetadata {
    return {
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      type: row.type,
      config: row.config,
      active: row.active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
