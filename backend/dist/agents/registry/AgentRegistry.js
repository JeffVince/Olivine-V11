"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
class AgentRegistry {
    constructor() {
        this.agents = new Map();
    }
    register(descriptor) {
        this.agents.set(descriptor.name, descriptor.instance);
    }
    async startAll() {
        for (const [, agent] of this.agents)
            await agent.start();
    }
    async stopAll() {
        for (const [, agent] of this.agents)
            await agent.stop();
    }
    get(name) {
        return this.agents.get(name);
    }
    list() {
        return Array.from(this.agents.keys());
    }
}
exports.AgentRegistry = AgentRegistry;
//# sourceMappingURL=AgentRegistry.js.map