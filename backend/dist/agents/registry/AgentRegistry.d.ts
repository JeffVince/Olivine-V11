import { BaseAgent } from '../BaseAgent';
export interface AgentDescriptor {
    name: string;
    instance: BaseAgent;
}
export declare class AgentRegistry {
    private readonly agents;
    register(descriptor: AgentDescriptor): void;
    startAll(): Promise<void>;
    stopAll(): Promise<void>;
    get(name: string): BaseAgent | undefined;
    list(): string[];
}
//# sourceMappingURL=AgentRegistry.d.ts.map