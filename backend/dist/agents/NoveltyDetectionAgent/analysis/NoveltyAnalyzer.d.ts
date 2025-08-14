import { Neo4jService } from '../../../services/Neo4jService';
import { LlmService } from '../../../services/llm/LlmService';
import { NoveltyDetectionRequest, NoveltyResult } from '../types';
export declare class NoveltyAnalyzer {
    private neo4j;
    private llmService;
    constructor(neo4j: Neo4jService, llmService: LlmService);
    checkEntityExists(entityId: string, orgId: string): Promise<boolean>;
    getEntityTypeFrequency(entityType: string, orgId: string, projectId?: string): Promise<number>;
    getEntityHistory(entityId: string, entityType: string, orgId: string): Promise<any[]>;
    analyzePropertyChanges(entityId: string, newProperties: Record<string, any>, entityHistory: any[], orgId: string): Promise<Array<{
        property: string;
        oldValue?: any;
        newValue: any;
        changeType: 'added' | 'modified' | 'removed';
        significance: number;
    }>>;
    private calculatePropertySignificance;
    checkPatternDeviations(entityType: string, newProperties: Record<string, any>, orgId: string): Promise<Array<{
        pattern: string;
        expected: any;
        actual: any;
        deviation_score: number;
    }>>;
    analyzeRelationshipChanges(entityId: string, orgId: string): Promise<any[]>;
    calculateNoveltyScore(propertyChanges: any[], patternDeviations: any[], relationshipChanges: any[]): number;
    determineNoveltyType(propertyChanges: any[], patternDeviations: any[], relationshipChanges: any[]): NoveltyResult['noveltyType'];
    generateReasoning(request: NoveltyDetectionRequest, propertyChanges: any[], patternDeviations: any[]): Promise<string>;
}
//# sourceMappingURL=NoveltyAnalyzer.d.ts.map