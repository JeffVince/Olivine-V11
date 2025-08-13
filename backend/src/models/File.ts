import { PostgresService } from '../services/PostgresService';
import { Neo4jService } from '../services/Neo4jService';

export interface FileMetadata {
  id: string;
  organizationId: string;
  sourceId: string;
  path: string;
  name: string;
  extension?: string;
  mimeType?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
  modifiedAt?: Date;
  deletedAt?: Date;
  versionId?: string;
  metadata?: any;
  classificationStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: string;
}

export interface FileClassification {
  type: string;
  confidence: number;
  categories: string[];
  tags: string[];
}

export interface FileContent {
  text?: string;
  metadata?: any;
  extractedAt: Date;
}

export class FileModel {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - File model implementation with PostgreSQL and Neo4j
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - File model Neo4j integration
  // TODO: Implementation Plan - 04-Data-Storage-Implementation.md - File model PostgreSQL integration
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend file model tests
  private postgresService: PostgresService;
  private neo4jService: Neo4jService;

  constructor() {
    this.postgresService = new PostgresService();
    this.neo4jService = new Neo4jService();
  }

  /**
   * Create or update a file record in PostgreSQL
   */
  async upsertFile(fileData: Partial<FileMetadata>): Promise<FileMetadata> {
    const query = `
      INSERT INTO files (
        id, organization_id, source_id, path, name, extension, mime_type, size,
        created_at, updated_at, modified_at, version_id, metadata, classification_status
      ) VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8,
        COALESCE($9, NOW()), NOW(), $10, $11, $12, COALESCE($13, 'pending')
      )
      ON CONFLICT (organization_id, source_id, path)
      DO UPDATE SET
        name = EXCLUDED.name,
        extension = EXCLUDED.extension,
        mime_type = EXCLUDED.mime_type,
        size = EXCLUDED.size,
        updated_at = NOW(),
        modified_at = EXCLUDED.modified_at,
        version_id = EXCLUDED.version_id,
        metadata = EXCLUDED.metadata,
        classification_status = COALESCE(EXCLUDED.classification_status, files.classification_status)
      RETURNING *
    `;

    const values = [
      fileData.id,
      fileData.organizationId,
      fileData.sourceId,
      fileData.path,
      fileData.name,
      fileData.extension,
      fileData.mimeType,
      fileData.size,
      fileData.createdAt,
      fileData.modifiedAt,
      fileData.versionId,
      fileData.metadata ? JSON.stringify(fileData.metadata) : null,
      fileData.classificationStatus
    ];

    const result = await this.postgresService.executeQuery(query, values);
    return this.mapRowToFile(result.rows[0]);
  }

  /**
   * Get a file by ID and organization
   */
  async getFile(fileId: string, organizationId: string): Promise<FileMetadata | null> {
    const query = `
      SELECT * FROM files 
      WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
    `;
    
    const result = await this.postgresService.executeQuery(query, [fileId, organizationId]);
    return result.rows.length > 0 ? this.mapRowToFile(result.rows[0]) : null;
  }

  /**
   * Get files by source and organization
   */
  async getFilesBySource(sourceId: string, organizationId: string, limit = 100): Promise<FileMetadata[]> {
    const query = `
      SELECT * FROM files 
      WHERE source_id = $1 AND organization_id = $2 AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT $3
    `;
    
    const result = await this.postgresService.executeQuery(query, [sourceId, organizationId, limit]);
    return result.rows.map(row => this.mapRowToFile(row));
  }

  /**
   * Mark a file as deleted (soft delete)
   */
  async deleteFile(fileId: string, organizationId: string): Promise<boolean> {
    const query = `
      UPDATE files 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
    `;
    
    const result = await this.postgresService.executeQuery(query, [fileId, organizationId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Update file classification status and results
   */
  async updateClassification(
    fileId: string, 
    organizationId: string, 
    classification: FileClassification,
    status: FileMetadata['classificationStatus'] = 'completed'
  ): Promise<boolean> {
    const query = `
      UPDATE files 
      SET 
        classification_status = $3,
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
        updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
    `;
    
    const classificationData = {
      classification: {
        ...classification,
        classifiedAt: new Date().toISOString()
      }
    };
    
    const result = await this.postgresService.executeQuery(query, [
      fileId, 
      organizationId, 
      status,
      JSON.stringify(classificationData)
    ]);
    
    return (result.rowCount || 0) > 0;
  }

  /**
   * Update extracted text content
   */
  async updateExtractedContent(
    fileId: string, 
    organizationId: string, 
    extractedText: string
  ): Promise<boolean> {
    const query = `
      UPDATE files 
      SET 
        extracted_text = $3,
        updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
    `;
    
    const result = await this.postgresService.executeQuery(query, [fileId, organizationId, extractedText]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Create or update file node in Neo4j knowledge graph
   */
  async syncToGraph(fileData: FileMetadata): Promise<void> {
    const query = `
      MERGE (f:File {id: $fileId, organizationId: $orgId})
      SET f.path = $path,
          f.name = $name,
          f.extension = $extension,
          f.mimeType = $mimeType,
          f.size = $size,
          f.createdAt = datetime($createdAt),
          f.updatedAt = datetime($updatedAt),
          f.modifiedAt = datetime($modifiedAt),
          f.classificationStatus = $classificationStatus,
          f.metadata = $metadata
      
      // Create relationship to source
      WITH f
      MATCH (s:Source {id: $sourceId, organizationId: $orgId})
      MERGE (f)-[:STORED_IN]->(s)
      
      RETURN f
    `;

    const params = {
      fileId: fileData.id,
      orgId: fileData.organizationId,
      sourceId: fileData.sourceId,
      path: fileData.path,
      name: fileData.name,
      extension: fileData.extension,
      mimeType: fileData.mimeType,
      size: fileData.size,
      createdAt: fileData.createdAt.toISOString(),
      updatedAt: fileData.updatedAt.toISOString(),
      modifiedAt: fileData.modifiedAt?.toISOString(),
      classificationStatus: fileData.classificationStatus,
      metadata: fileData.metadata ? JSON.stringify(fileData.metadata) : null
    };

    await this.neo4jService.executeQuery(query, params);
  }

  /**
   * Remove file node from Neo4j knowledge graph
   */
  async removeFromGraph(fileId: string, organizationId: string): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId, organizationId: $orgId})
      DETACH DELETE f
    `;

    await this.neo4jService.executeQuery(query, { fileId, orgId: organizationId });
  }

  /**
   * Map database row to FileMetadata interface
   */
  private mapRowToFile(row: any): FileMetadata {
    return {
      id: row.id,
      organizationId: row.organization_id,
      sourceId: row.source_id,
      path: row.path,
      name: row.name,
      extension: row.extension,
      mimeType: row.mime_type,
      size: row.size,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      modifiedAt: row.modified_at ? new Date(row.modified_at) : undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      versionId: row.version_id,
      metadata: row.metadata,
      classificationStatus: row.classification_status,
      extractedText: row.extracted_text
    };
  }
}
