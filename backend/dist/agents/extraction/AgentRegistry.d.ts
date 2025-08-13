import { BaseExtractionAgent } from './BaseExtractionAgent';
export interface AgentRegistration {
    slot: string;
    mimeType: string;
    agent: BaseExtractionAgent;
    enabled: boolean;
    featureFlag?: string;
}
export declare class AgentRegistry {
    private readonly agents;
    private readonly llmService;
    constructor();
    private registerDefaultAgents;
    registerAgent(registration: AgentRegistration): void;
    getAgent(slot: string, mimeType: string): BaseExtractionAgent | null;
    isAgentEnabled(slot: string, mimeType: string, orgFeatureFlags: Record<string, boolean>): boolean;
    getAllAgents(): AgentRegistration[];
    updateAgentStatus(slot: string, mimeType: string, enabled: boolean): void;
}
//# sourceMappingURL=AgentRegistry.d.ts.map