import { BaseAgent, AgentStatus } from '../BaseAgent';
import { QueueService } from '../../services/queues/QueueService';
import { ScriptBreakdownResult } from './types';
export declare class ScriptBreakdownAgent extends BaseAgent {
    private contentService;
    private taxonomyService;
    private llmService;
    constructor(queueService: QueueService);
    processScript(scriptText: string, projectId: string, orgId: string, userId: string): Promise<ScriptBreakdownResult>;
    private extractScenesFromScript;
    private extractCharactersFromScript;
    private extractPropsFromScenes;
    private linkScenesAndCharacters;
    private normalizeTimeOfDay;
    private normalizeRoleType;
    private categorizeProp;
    getCapabilities(): string[];
    getStatus(): AgentStatus;
    protected onStart(): Promise<void>;
    protected onStop(): Promise<void>;
    protected onPause(): Promise<void>;
    protected onResume(): Promise<void>;
}
export * from './types';
//# sourceMappingURL=index.d.ts.map