import { Neo4jService } from '../../../services/Neo4jService'

export class ContentRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async updateFileContent(fileId: string, extractedContent: { text?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.extracted_text = $text,
        f.content_metadata = $metadata,
        f.extraction_status = 'completed'
      RETURN f
    `
    await this.neo4j.run(query, {
      fileId,
      text: extractedContent.text || '',
      metadata: JSON.stringify(extractedContent.metadata || {})
    })
  }
}


