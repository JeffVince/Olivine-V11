"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLlmProvider = void 0;
class MockLlmProvider {
    async complete(messages, params) {
        return JSON.stringify({
            "classification": "unknown",
            "confidence": 0.0,
            "reasoning": "Mock response for testing purposes."
        });
    }
}
exports.MockLlmProvider = MockLlmProvider;
//# sourceMappingURL=MockLlmProvider.js.map