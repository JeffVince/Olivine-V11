import { LlmProvider } from '../services/llm/LlmService';
export interface LlmConfig {
    provider: 'openai' | 'mock';
    openai?: {
        apiKey: string;
        defaultModel: string;
        defaultTemperature: number;
        defaultMaxTokens: number;
    };
}
export declare function getLlmConfig(): LlmConfig;
export declare function createLlmProvider(): LlmProvider;
//# sourceMappingURL=llm.d.ts.map