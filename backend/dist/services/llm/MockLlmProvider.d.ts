import { LlmProvider, LlmMessage, LlmCompletionParams } from './LlmService';
export declare class MockLlmProvider implements LlmProvider {
    complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string>;
}
//# sourceMappingURL=MockLlmProvider.d.ts.map