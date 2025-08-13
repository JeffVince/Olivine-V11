"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
const OpenAIAgent_1 = require("./OpenAIAgent");
const LlmService_1 = require("../../services/llm/LlmService");
const llm_1 = require("../../config/llm");
class AgentRegistry {
    constructor() {
        this.agents = new Map();
        this.llmService = new LlmService_1.LlmService((0, llm_1.createLlmProvider)());
        this.registerDefaultAgents();
    }
    registerDefaultAgents() {
        const openAiAgent = new OpenAIAgent_1.OpenAIAgent(this.llmService);
        this.registerAgent({
            slot: 'script',
            mimeType: '*',
            agent: openAiAgent,
            enabled: false,
            featureFlag: 'ai_extraction_script'
        });
    }
    registerAgent(registration) {
        const key = `${registration.slot}:${registration.mimeType}`;
        this.agents.set(key, registration);
    }
    getAgent(slot, mimeType) {
        const exactKey = `${slot}:${mimeType}`;
        const exactMatch = this.agents.get(exactKey);
        if (exactMatch && exactMatch.enabled) {
            return exactMatch.agent;
        }
        const wildcardKey = `${slot}:*`;
        const wildcardMatch = this.agents.get(wildcardKey);
        if (wildcardMatch && wildcardMatch.enabled) {
            return wildcardMatch.agent;
        }
        return null;
    }
    isAgentEnabled(slot, mimeType, orgFeatureFlags) {
        const agent = this.getAgent(slot, mimeType);
        if (!agent) {
            return false;
        }
        const registration = Array.from(this.agents.values()).find(reg => reg.agent === agent);
        if (registration?.featureFlag) {
            return orgFeatureFlags[registration.featureFlag] === true;
        }
        return true;
    }
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    updateAgentStatus(slot, mimeType, enabled) {
        const key = `${slot}:${mimeType}`;
        const registration = this.agents.get(key);
        if (registration) {
            registration.enabled = enabled;
        }
    }
}
exports.AgentRegistry = AgentRegistry;
//# sourceMappingURL=AgentRegistry.js.map