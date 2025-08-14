"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassificationRepository = void 0;
class ClassificationRepository {
    constructor(neo4jService) {
        this.neo4j = neo4jService;
    }
    async updateFileClassification(fileId, classification) {
        const query = `
      MATCH (f:File {id: $fileId})
      SET 
        f.classification_status = $status,
        f.classification_confidence = $confidence,
        f.classification_metadata = $metadata
      RETURN f
    `;
        await this.neo4j.run(query, {
            fileId,
            status: classification.status || 'classified',
            confidence: classification.confidence || 0,
            metadata: JSON.stringify(classification.metadata || {})
        });
    }
}
exports.ClassificationRepository = ClassificationRepository;
//# sourceMappingURL=ClassificationRepository.js.map