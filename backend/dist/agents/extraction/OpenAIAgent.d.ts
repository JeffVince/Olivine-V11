import { BaseExtractionAgent, ExtractionResult } from './BaseExtractionAgent';
import { LlmService } from '../../services/llm/LlmService';
export declare class OpenAIAgent extends BaseExtractionAgent {
    private readonly llmService;
    private readonly defaultModel;
    constructor(llmService: LlmService);
    extract(fileContent: string, slot: string, context?: Record<string, any>): Promise<ExtractionResult>;
    private loadPrompt;
    private createEmptyResult;
}
//# sourceMappingURL=OpenAIAgent.d.ts.map