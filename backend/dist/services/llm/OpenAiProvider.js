"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiProvider = void 0;
let OpenAI;
try {
    OpenAI = require('openai');
}
catch {
    OpenAI = class {
        constructor(_) {
            this.chat = { completions: { create: async () => ({ choices: [{ message: { content: '' } }] }) } };
        }
    };
}
class OpenAiProvider {
    constructor(apiKey, defaultModel = 'gpt-4o-mini', defaultTemperature = 0.7, defaultMaxTokens = 1000) {
        this.client = new OpenAI({ apiKey });
        this.defaultModel = defaultModel;
        this.defaultTemperature = defaultTemperature;
        this.defaultMaxTokens = defaultMaxTokens;
    }
    async complete(messages, params) {
        const response = await this.client.chat.completions.create({
            model: params.model || this.defaultModel,
            temperature: params.temperature !== undefined ? params.temperature : this.defaultTemperature,
            max_tokens: params.maxTokens || this.defaultMaxTokens,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        });
        return response.choices[0]?.message?.content || '';
    }
}
exports.OpenAiProvider = OpenAiProvider;
//# sourceMappingURL=OpenAiProvider.js.map