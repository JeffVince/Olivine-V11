import { BaseAgent, AgentConfig } from '../BaseAgent';
import { QueueService } from '../../services/queues/QueueService';
import { ClassificationResult } from './types';
export declare class TaxonomyClassificationAgent extends BaseAgent {
    private classificationService;
    private postgresService;
    private neo4jService;
    private taxonomyService;
    private taxonomyRules;
    private ruleEngine;
    private classificationRepo;
    constructor(queueService: QueueService, config?: Partial<AgentConfig>);
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
    classifyFile(jobData: any): Promise<ClassificationResult>;
    private loadTaxonomyRules;
    private getFileData;
    private performMLClassification;
}
export * from './types';
//# sourceMappingURL=index.d.ts.map