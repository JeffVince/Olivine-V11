export interface PromptDefinition {
    buildMessages: (context: any) => {
        role: 'system' | 'user' | 'assistant' | 'tool';
        content: string;
    }[];
    params: {
        model: string;
        temperature?: number;
        maxTokens?: number;
    };
    parse: (raw: string) => {
        slotKey: string;
        confidence: number;
    };
}
export declare class PromptRepository {
    getPrompt(key: 'classification_prompt'): Promise<PromptDefinition>;
}
//# sourceMappingURL=PromptRepository.d.ts.map