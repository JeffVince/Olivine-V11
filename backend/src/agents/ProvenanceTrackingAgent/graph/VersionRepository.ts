import { Neo4jService } from '../../../services/Neo4jService'
import { Record } from 'neo4j-driver'

export class VersionRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async getExistingVersion(orgId: string, entityId: string, contentHash: string): Promise<string | null> {
    const query = `
      MATCH (v:Version {org_id: $orgId, entity_id: $entityId, content_hash: $contentHash})
      RETURN v.id as versionId
      LIMIT 1
    `
    const result = await this.neo4j.run(query, { orgId, entityId, contentHash })
    return result.records.length > 0 ? result.records[0].get('versionId') : null
  }

  async createVersion(params: {
    versionId: string
    orgId: string
    entityId: string
    entityType: string
    properties: string
    commitId: string
    createdAt: string
    contentHash: string
  }): Promise<string> {
    const query = `
      CREATE (v:Version {
        id: $versionId,
        org_id: $orgId,
        entity_id: $entityId,
        entity_type: $entityType,
        properties: $properties,
        commit_id: $commitId,
        created_at: datetime($createdAt),
        content_hash: $contentHash
      })
      RETURN v.id as versionId
    `
    await this.neo4j.run(query, params)
    return params.versionId
  }

  async createEntityVersionRelationship(entityId: string, versionId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (v:Version {id: $versionId, org_id: $orgId})
      OPTIONAL MATCH (e {id: $entityId, org_id: $orgId})
      WHERE e:File OR e:Content OR e:Project OR e:Task OR e:Resource
      CREATE (e)-[:HAS_VERSION {org_id: $orgId, created_at: datetime()}]->(v)
    `
    await this.neo4j.run(query, { entityId, versionId, orgId })
  }

  async getEntityVersionHistory(orgId: string, entityId: string): Promise<any[]> {
    const query = `
      MATCH (v:Version {org_id: $OrgId, entity_id: $EntityId})
      OPTIONAL MATCH (c:Commit {id: v.commit_id})
      RETURN v, c
      ORDER BY v.created_at DESC
    `
    const result = await this.neo4j.run(query, { OrgId: orgId, EntityId: entityId })
    return result.records.map((record: Record) => {
      const version = record.get('v').properties
      const commit = record.get('c')?.properties
      return {
        id: version.id,
        orgId: version.org_id,
        entityId: version.entity_id,
        entityType: version.entity_type,
        properties: JSON.parse(version.properties),
        commitId: version.commit_id,
        createdAt: version.created_at,
        contentHash: version.content_hash,
        commit: commit ? { id: commit.id, message: commit.message, author: commit.author, createdAt: commit.created_at } : null
      }
    })
  }
}


