import { LlmProvider, LlmMessage, LlmCompletionParams } from './LlmService';
export declare class OpenAiProvider implements LlmProvider {
    private readonly client;
    private readonly defaultModel;
    private readonly defaultTemperature;
    private readonly defaultMaxTokens;
    constructor(apiKey: string, defaultModel?: string, defaultTemperature?: number, defaultMaxTokens?: number);
    complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string>;
}
//# sourceMappingURL=OpenAiProvider.d.ts.map