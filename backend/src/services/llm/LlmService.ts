export interface LlmCompletionParams {
  model: string
  temperature?: number
  maxTokens?: number
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface LlmProvider {
  complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string>
}

export class LlmService {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - LLM service implementation for AI classification
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend LLM service tests
  private readonly provider: LlmProvider

  constructor(provider: LlmProvider) {
    this.provider = provider
  }

  async complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string> {
    return this.provider.complete(messages, params)
  }
}


