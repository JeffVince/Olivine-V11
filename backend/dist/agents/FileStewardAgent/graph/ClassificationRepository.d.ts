import { Neo4jService } from '../../../services/Neo4jService';
export declare class ClassificationRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    updateFileClassification(fileId: string, classification: {
        status: string;
        confidence: number;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
}
//# sourceMappingURL=ClassificationRepository.d.ts.map