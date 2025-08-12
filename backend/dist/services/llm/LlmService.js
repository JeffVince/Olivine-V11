"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmService = void 0;
class LlmService {
    constructor(provider) {
        this.provider = provider;
    }
    async complete(messages, params) {
        return this.provider.complete(messages, params);
    }
}
exports.LlmService = LlmService;
//# sourceMappingURL=LlmService.js.map