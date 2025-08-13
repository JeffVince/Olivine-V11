"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseExtractionAgent = void 0;
class BaseExtractionAgent {
    constructor(agentId, agentVersion) {
        this.agentId = agentId;
        this.agentVersion = agentVersion;
    }
    generateTraceId() {
        return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}
exports.BaseExtractionAgent = BaseExtractionAgent;
//# sourceMappingURL=BaseExtractionAgent.js.map