import { Neo4jService } from '../../../services/Neo4jService'

export class ClassificationRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async updateFileClassification(
    fileId: string,
    classification: { status: string; confidence: number; method?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.classification_status = $status,
        f.classification_confidence = $confidence,
        f.classification_method = $method,
        f.classification_metadata = $metadata,
        f.classified_at = datetime()
      RETURN f
    `
    await this.neo4j.run(query, {
      fileId,
      status: classification.status || 'classified',
      confidence: classification.confidence || 0,
      method: classification.method || 'default',
      metadata: JSON.stringify(classification.metadata || {})
    })
  }
}


