export interface ExtractionResult {
  entities: Array<{
    type: string;
    properties: Record<string, any>;
    confidence: number;
    provenance: {
      source_parser: string;
      parser_version: string;
      trace_id: string;
      raw_response?: string;
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  }>;
  links: Array<{
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    relationshipType: string;
    properties: Record<string, any>;
    confidence: number;
  }>;
  facts: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
    context?: string;
  }>;
  metadata: {
    confidence: number;
    processingTimeMs: number;
    model?: string;
    trace_id: string;
  };
}

export abstract class BaseExtractionAgent {
  protected readonly agentId: string;
  protected readonly agentVersion: string;

  constructor(agentId: string, agentVersion: string) {
    this.agentId = agentId;
    this.agentVersion = agentVersion;
  }

  abstract extract(
    fileContent: string,
    slot: string,
    context?: Record<string, any>
  ): Promise<ExtractionResult>;

  protected generateTraceId(): string {
    return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
