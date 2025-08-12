import { BaseAgent, AgentStatus } from './BaseAgent';
import { QueueService } from '../services/queues/QueueService';
interface NoveltyDetectionRequest {
    entityId: string;
    entityType: string;
    newProperties: Record<string, any>;
    orgId: string;
    userId: string;
    context?: {
        projectId?: string;
        sourceId?: string;
        metadata?: Record<string, any>;
    };
}
interface NoveltyResult {
    isNovel: boolean;
    noveltyScore: number;
    noveltyType: 'new_entity' | 'property_change' | 'relationship_change' | 'pattern_deviation' | 'none';
    detectedChanges: Array<{
        property: string;
        oldValue?: any;
        newValue: any;
        changeType: 'added' | 'modified' | 'removed';
        significance: number;
    }>;
    reasoning: string;
    recommendations?: string[];
    alertLevel: 'none' | 'info' | 'warning' | 'critical';
}
export declare class NoveltyDetectionAgent extends BaseAgent {
    private neo4j;
    private provenance;
    private llmService;
    constructor(queueService: QueueService);
    detectNovelty(request: NoveltyDetectionRequest): Promise<NoveltyResult>;
    private handleNewEntity;
    private analyzePropertyChanges;
    private checkPatternDeviations;
    private analyzeRelationshipChanges;
    private calculateNoveltyScore;
    private determineNoveltyType;
    private determineAlertLevel;
    private generateReasoning;
    private generateRecommendations;
    private checkEntityExists;
    private getEntityTypeFrequency;
    private calculatePropertySignificance;
    private analyzeEntityPatterns;
    private checkPatternDeviation;
    getCapabilities(): string[];
    getStatus(): AgentStatus;
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
}
export {};
//# sourceMappingURL=NoveltyDetectionAgent.d.ts.map