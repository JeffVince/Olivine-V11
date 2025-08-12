import { LlmProvider, LlmMessage, LlmCompletionParams } from './LlmService';

export class MockLlmProvider implements LlmProvider {
  async complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string> {
    // Return a mock response for testing
    return JSON.stringify({
      "classification": "unknown",
      "confidence": 0.0,
      "reasoning": "Mock response for testing purposes."
    });
  }
}
