import { PostgresService } from '../../../services/PostgresService';
import { FileMetadata } from '../types';
import { ClassificationRepository } from '../graph/ClassificationRepository';
import { Neo4jService } from '../../../services/Neo4jService';
export declare class Classifier {
    private classificationService;
    private taxonomyService;
    private postgres;
    private neo4j;
    constructor(postgres: PostgresService, neo4j: Neo4jService);
    private createSlotEdgeFact;
    classifyAndApply(params: {
        orgId: string;
        fileId: string;
        filePath: string;
        metadata: {
            mimeType?: string;
            size?: number;
        };
        fileContent?: string;
        classificationRepo: ClassificationRepository;
    }): Promise<{
        slotKey: string;
        confidence: number;
        method: string;
        ruleId?: string | null;
    }>;
    performMultiSlotClassification(orgId: string, fileId: string, resourcePath: string, fileMetadata: FileMetadata): Promise<string[]>;
    private getApplicableTaxonomyRules;
    private calculateRuleConfidence;
    private getFallbackSlot;
}
//# sourceMappingURL=Classifier.d.ts.map