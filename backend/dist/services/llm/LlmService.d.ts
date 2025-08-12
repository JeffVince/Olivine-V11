export interface LlmCompletionParams {
    model: string;
    temperature?: number;
    maxTokens?: number;
}
export interface LlmMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
}
export interface LlmProvider {
    complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string>;
}
export declare class LlmService {
    private readonly provider;
    constructor(provider: LlmProvider);
    complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string>;
}
//# sourceMappingURL=LlmService.d.ts.map