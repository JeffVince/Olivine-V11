import { BaseAgent, AgentConfig } from './BaseAgent';
import { QueueService } from '../services/queues/QueueService';
export interface TaxonomyRule {
    id: string;
    orgId: string;
    slotKey: string;
    matchPattern: string;
    fileType?: string;
    priority: number;
    enabled: boolean;
    conditions: ClassificationCondition[];
    metadata: any;
}
export interface ClassificationCondition {
    type: 'filename' | 'path' | 'size' | 'mime_type' | 'content';
    operator: 'matches' | 'contains' | 'equals' | 'greater_than' | 'less_than';
    value: string | number;
    caseSensitive?: boolean;
}
export interface ClassificationResult {
    slotKey: string;
    confidence: number;
    ruleId?: string;
    method: 'taxonomy' | 'ml' | 'default';
    metadata?: any;
}
export declare class TaxonomyClassificationAgent extends BaseAgent {
    private classificationService;
    private postgresService;
    private neo4jService;
    private taxonomyRules;
    constructor(queueService: QueueService, config?: Partial<AgentConfig>);
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
    classifyFile(jobData: any): Promise<ClassificationResult>;
    private loadTaxonomyRules;
    private getFileData;
    private performRuleBasedClassification;
    private evaluateRule;
    private evaluateCondition;
    private applyOperator;
    private calculateConfidence;
    private performMLClassification;
    private getDefaultClassification;
    private updateFileClassification;
}
//# sourceMappingURL=TaxonomyClassificationAgent.d.ts.map