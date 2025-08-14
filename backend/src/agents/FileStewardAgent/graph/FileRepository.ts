import { Neo4jService } from '../../../services/Neo4jService'

export class FileRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async upsertFileNode(params: {
    orgId: string
    sourceId: string
    resourcePath: string
    dbId: string
    name: string
    size: number
    mimeType: string
    checksum?: string | null
    modified: string
    metadataJson: string
  }): Promise<string> {
    const query = `
      MERGE (f:File {org_id: $orgId, source_id: $sourceId, path: $path})
      ON CREATE SET 
        f.id = randomUUID(),
        f.created_at = datetime(),
        f.db_id = $dbId
      SET 
        f.name = $name,
        f.size = $size,
        f.mime_type = $mimeType,
        f.checksum = $checksum,
        f.updated_at = datetime(),
        f.modified = datetime($modified),
        f.metadata = $metadataJson,
        f.current = true,
        f.deleted = false
      RETURN f.id as fileId
    `
    const result = await this.neo4j.run(query, {
      orgId: params.orgId,
      sourceId: params.sourceId,
      path: params.resourcePath,
      dbId: params.dbId,
      name: params.name,
      size: params.size,
      mimeType: params.mimeType,
      checksum: params.checksum ?? null,
      modified: params.modified,
      metadataJson: params.metadataJson
    })
    return result.records[0].get('fileId')
  }

  async getFileNode(orgId: string, sourceId: string, path: string): Promise<{ id: string; properties: any } | null> {
    const query = `
      MATCH (f:File {org_id: $orgId, source_id: $sourceId, path: $path, current: true, deleted: false})
      RETURN f
    `
    const result = await this.neo4j.run(query, { orgId, sourceId, path })
    if (result.records.length === 0) return null
    const fileNode = result.records[0].get('f')
    return { id: fileNode.properties.id, properties: fileNode.properties }
  }

  async updateFileNode(fileId: string, params: {
    name: string
    size: number
    mimeType: string
    checksum?: string | null
    modified: string
    metadataJson: string
  }): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.name = $name,
        f.size = $size,
        f.mime_type = $mimeType,
        f.checksum = $checksum,
        f.updated_at = datetime(),
        f.modified = datetime($modified),
        f.metadata = $metadataJson
      RETURN f
    `
    await this.neo4j.run(query, {
      fileId,
      name: params.name,
      size: params.size,
      mimeType: params.mimeType,
      checksum: params.checksum ?? null,
      modified: params.modified,
      metadataJson: params.metadataJson
    })
  }

  async softDeleteFileNode(fileId: string): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET f.deleted = true, f.current = false, f.end_date = datetime()
      RETURN f
    `
    await this.neo4j.run(query, { fileId })
  }
}


