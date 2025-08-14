import { BaseAgent, AgentStatus } from '../BaseAgent';
import { QueueService } from '../../services/queues/QueueService';
import { NoveltyDetectionRequest, NoveltyResult } from './types';
export declare class NoveltyDetectionAgent extends BaseAgent {
    private neo4j;
    private provenance;
    private llmService;
    private analyzer;
    constructor(queueService: QueueService);
    detectNovelty(request: NoveltyDetectionRequest): Promise<NoveltyResult>;
    private handleNewEntity;
    private determineAlertLevel;
    private generateRecommendations;
    getCapabilities(): string[];
    getStatus(): AgentStatus;
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
}
export * from './types';
export * from './analysis/NoveltyAnalyzer';
//# sourceMappingURL=index.d.ts.map