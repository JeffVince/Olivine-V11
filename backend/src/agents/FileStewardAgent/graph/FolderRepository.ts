import { Neo4jService } from '../../../services/Neo4jService'

export class FolderRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async upsertFolderNode(orgId: string, sourceId: string, path: string, name: string): Promise<string> {
    const query = `
      MERGE (f:Folder {org_id: $orgId, source_id: $sourceId, path: $path})
      ON CREATE SET 
        f.id = randomUUID(),
        f.created_at = datetime()
      SET 
        f.name = $name,
        f.updated_at = datetime(),
        f.current = true,
        f.deleted = false
      RETURN f.id as folderId
    `
    const result = await this.neo4j.run(query, { orgId, sourceId, path, name })
    return result.records[0].get('folderId')
  }
}


