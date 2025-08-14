import { v4 as uuidv4 } from 'uuid'
import { Neo4jService } from '../../../services/Neo4jService'
import { PostgresService } from '../../../services/PostgresService'
import { Classifier } from '../classification/Classifier'
import { FileMetadata } from '../types'

export class ClusterService {
  private neo4j: Neo4jService
  private postgres: PostgresService
  private classifier: Classifier

  constructor(neo4j: Neo4jService, postgres: PostgresService, classifier: Classifier) {
    this.neo4j = neo4j
    this.postgres = postgres
    this.classifier = classifier
  }

  async createContentCluster(orgId: string, fileId: string): Promise<string> {
    const clusterId = uuidv4()
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
    `
    await this.neo4j.run(query, { clusterId, orgId, fileId })
    await this.postgres.query(`
      INSERT INTO content_cluster (id, org_id, file_id, status, entities_count, links_count, created_at, updated_at)
      VALUES ($1, $2, $3, 'empty', 0, 0, NOW(), NOW())
    `, [clusterId, orgId, fileId])
    return clusterId
  }

  async performMultiSlotClassification(orgId: string, fileId: string, resourcePath: string, fileMetadata: FileMetadata): Promise<string[]> {
    return this.classifier.performMultiSlotClassification(orgId, fileId, resourcePath, fileMetadata)
  }
}


