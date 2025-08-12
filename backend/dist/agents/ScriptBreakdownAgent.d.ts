import { BaseAgent, AgentStatus } from './BaseAgent';
import { Scene, Character, Prop } from '../services/ContentOntologyService';
import { QueueService } from '../services/queues/QueueService';
interface ScriptBreakdownResult {
    scenes: Scene[];
    characters: Character[];
    props: Prop[];
    locations: string[];
    success: boolean;
    errors?: string[];
}
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
export {};
//# sourceMappingURL=ScriptBreakdownAgent.d.ts.map