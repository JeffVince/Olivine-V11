import { BaseExtractionAgent } from './BaseExtractionAgent';
import { OpenAIAgent } from './OpenAIAgent';
import { LlmService } from '../../services/llm/LlmService';
import { createLlmProvider } from '../../config/llm';

export interface AgentRegistration {
  slot: string;
  mimeType: string;
  agent: BaseExtractionAgent;
  enabled: boolean;
  featureFlag?: string;
}

export class AgentRegistry {
  private readonly agents: Map<string, AgentRegistration> = new Map();
  private readonly llmService: LlmService;

  constructor() {
    this.llmService = new LlmService(createLlmProvider());
    this.registerDefaultAgents();
  }

  private registerDefaultAgents(): void {
    // Register OpenAI agent for script slot as a starting point
    // This will be controlled by a feature flag in the parser registry
    const openAiAgent = new OpenAIAgent(this.llmService);
    this.registerAgent({
      slot: 'script',
      mimeType: '*', // Accepts all mime types for now
      agent: openAiAgent,
      enabled: false, // Disabled by default, will be enabled via feature flag
      featureFlag: 'ai_extraction_script'
    });
  }

  registerAgent(registration: AgentRegistration): void {
    const key = `${registration.slot}:${registration.mimeType}`;
    this.agents.set(key, registration);
  }

  getAgent(slot: string, mimeType: string): BaseExtractionAgent | null {
    // First try exact match
    const exactKey = `${slot}:${mimeType}`;
    const exactMatch = this.agents.get(exactKey);
    if (exactMatch && exactMatch.enabled) {
      return exactMatch.agent;
    }

    // Then try wildcard match
    const wildcardKey = `${slot}:*`;
    const wildcardMatch = this.agents.get(wildcardKey);
    if (wildcardMatch && wildcardMatch.enabled) {
      return wildcardMatch.agent;
    }

    return null;
  }

  isAgentEnabled(slot: string, mimeType: string, orgFeatureFlags: Record<string, boolean>): boolean {
    const agent = this.getAgent(slot, mimeType);
    if (!agent) {
      return false;
    }

    // Check if there's a feature flag for this agent
    const registration = Array.from(this.agents.values()).find(
      reg => reg.agent === agent
    );
    
    if (registration?.featureFlag) {
      return orgFeatureFlags[registration.featureFlag] === true;
    }

    return true;
  }

  // For testing and administration
  getAllAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  updateAgentStatus(slot: string, mimeType: string, enabled: boolean): void {
    const key = `${slot}:${mimeType}`;
    const registration = this.agents.get(key);
    if (registration) {
      registration.enabled = enabled;
    }
  }
}
