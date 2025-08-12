import { PostgresService } from '../PostgresService'
import { LlmService } from '../llm/LlmService'
import { PromptRepository } from '../prompts/PromptRepository'

export interface ClassificationResult {
  slotKey: string
  confidence: number
  ruleId?: string | null
  method: 'taxonomy' | 'llm'
}

export class ClassificationService {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Classification service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend classification service tests
  private readonly pg: PostgresService
  private readonly llm?: LlmService
  private readonly prompts?: PromptRepository

  constructor(pg: PostgresService, llm?: LlmService, prompts?: PromptRepository) {
    this.pg = pg
    this.llm = llm
    this.prompts = prompts
  }

  async classify(orgId: string, file: { name: string; path: string; mimeType?: string; size?: number; extractedText?: string }): Promise<ClassificationResult> {
    // 1) Try taxonomy rules
    const rule = await this.matchRule(orgId, file)
    if (rule) {
      return {
        slotKey: rule.slot_key,
        confidence: rule.priority ? Math.min(1, Math.max(0.5, 1 - rule.priority * 0.05)) : 0.8,
        ruleId: rule.id,
        method: 'taxonomy',
      }
    }

    // 2) Fallback to LLM-based classification using external prompt (no hardcoded prompts)
    if (this.llm && this.prompts) {
      const prompt = await this.prompts.getPrompt('classification_prompt')
      const response = await this.llm.complete(
        prompt.buildMessages({ file }),
        prompt.params,
      )
      const parsed = prompt.parse(response)
      return {
        slotKey: parsed.slotKey,
        confidence: parsed.confidence,
        ruleId: null,
        method: 'llm',
      }
    }

    // If no LLM configured, return unclassified with low confidence
    return { slotKey: 'UNCLASSIFIED', confidence: 0, ruleId: null, method: 'taxonomy' }
  }

  private async matchRule(orgId: string, file: { name: string; path: string; mimeType?: string; size?: number; extractedText?: string }) {
    const query = `
      SELECT id, slot_key, match_pattern, priority
      FROM taxonomy_rules
      WHERE org_id = $1 AND enabled = true
      ORDER BY priority ASC
    `
    const result = await this.pg.executeQuery(query, [orgId])
    for (const r of result.rows) {
      try {
        const re = new RegExp(r.match_pattern, 'i')
        if (re.test(file.path) || re.test(file.name)) return r
      } catch {
        // ignore invalid patterns
      }
    }
    return null
  }
}


