export interface PromptDefinition {
  buildMessages: (context: any) => { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[]
  params: { model: string; temperature?: number; maxTokens?: number }
  parse: (raw: string) => { slotKey: string; confidence: number }
}

export class PromptRepository {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Prompt repository implementation for LLM classification
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend prompt repository tests
  async getPrompt(key: 'classification_prompt'): Promise<PromptDefinition> {
    // Load from DB or file; do not hardcode prompts. Placeholder interface only.
    throw new Error('Prompt repository not configured')
  }
}


