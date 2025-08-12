import { BaseAgent, AgentStatus } from './BaseAgent';
import { Classification } from '../services/TaxonomyService';
import { QueueService } from '../services/queues/QueueService';
export interface ClassificationRequest {
    fileId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    size: number;
    extractedText?: string;
    orgId: string;
    userId: string;
}
export interface ClassificationResult {
    fileId: string;
    classifications: Classification[];
    confidence: number;
    method: 'rule_based' | 'ml_based' | 'hybrid';
    reasoning?: string;
    success: boolean;
    error?: string;
}
export declare class EnhancedClassificationAgent extends BaseAgent {
    private taxonomyService;
    private llmService;
    private neo4j;
    constructor(queueService: QueueService);
    classifyFile(request: ClassificationRequest): Promise<ClassificationResult>;
    private performAIClassification;
    private performHybridClassification;
    batchClassifyFiles(requests: ClassificationRequest[]): Promise<ClassificationResult[]>;
    analyzeClassificationPerformance(orgId: string): Promise<any>;
    getCapabilities(): string[];
    getStatus(): AgentStatus;
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
}
//# sourceMappingURL=EnhancedClassificationAgent.d.ts.map