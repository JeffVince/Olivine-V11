import { PostgresService } from '../PostgresService';
import { LlmService } from '../llm/LlmService';
import { PromptRepository } from '../prompts/PromptRepository';
export interface ClassificationResult {
    slotKey: string;
    confidence: number;
    ruleId?: string | null;
    method: 'taxonomy' | 'llm';
}
export declare class ClassificationService {
    private readonly pg;
    private readonly llm?;
    private readonly prompts?;
    constructor(pg: PostgresService, llm?: LlmService, prompts?: PromptRepository);
    classify(orgId: string, file: {
        name: string;
        path: string;
        mimeType?: string;
        size?: number;
        extractedText?: string;
    }): Promise<ClassificationResult>;
    private matchRule;
}
//# sourceMappingURL=ClassificationService.d.ts.map