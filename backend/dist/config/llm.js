"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLlmConfig = getLlmConfig;
exports.createLlmProvider = createLlmProvider;
const dotenv_1 = require("dotenv");
const OpenAiProvider_1 = require("../services/llm/OpenAiProvider");
const MockLlmProvider_1 = require("../services/llm/MockLlmProvider");
(0, dotenv_1.config)();
function getLlmConfig() {
    const provider = process.env.LLM_PROVIDER || 'mock';
    if (provider === 'openai') {
        return {
            provider: 'openai',
            openai: {
                apiKey: process.env.OPENAI_API_KEY || '',
                defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
                defaultTemperature: parseFloat(process.env.OPENAI_DEFAULT_TEMPERATURE || '0.7'),
                defaultMaxTokens: parseInt(process.env.OPENAI_DEFAULT_MAX_TOKENS || '1000')
            }
        };
    }
    return {
        provider: 'mock'
    };
}
function createLlmProvider() {
    const config = getLlmConfig();
    if (config.provider === 'openai' && config.openai) {
        return new OpenAiProvider_1.OpenAiProvider(config.openai.apiKey, config.openai.defaultModel, config.openai.defaultTemperature, config.openai.defaultMaxTokens);
    }
    return new MockLlmProvider_1.MockLlmProvider();
}
//# sourceMappingURL=llm.js.map