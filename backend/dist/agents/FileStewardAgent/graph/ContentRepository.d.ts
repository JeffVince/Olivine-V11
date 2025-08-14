import { Neo4jService } from '../../../services/Neo4jService';
export declare class ContentRepository {
    private neo4j;
    constructor(neo4jService: Neo4jService);
    updateFileContent(fileId: string, extractedContent: {
        text?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
}
//# sourceMappingURL=ContentRepository.d.ts.map