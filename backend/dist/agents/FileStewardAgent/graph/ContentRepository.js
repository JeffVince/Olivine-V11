"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRepository = void 0;
class ContentRepository {
    constructor(neo4jService) {
        this.neo4j = neo4jService;
    }
    async updateFileContent(fileId, extractedContent) {
        const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.extracted_text = $text,
        f.content_metadata = $metadata,
        f.extraction_status = 'completed'
      RETURN f
    `;
        await this.neo4j.run(query, {
            fileId,
            text: extractedContent.text || '',
            metadata: JSON.stringify(extractedContent.metadata || {})
        });
    }
}
exports.ContentRepository = ContentRepository;
//# sourceMappingURL=ContentRepository.js.map