import { BaseExtractionAgent, ExtractionResult } from './BaseExtractionAgent';
import { LlmService, LlmMessage } from '../../services/llm/LlmService';
import { getLlmConfig } from '../../config/llm';

export class OpenAIAgent extends BaseExtractionAgent {
  private readonly llmService: LlmService;
  private readonly defaultModel: string;

  constructor(llmService: LlmService) {
    super('openai-extraction-agent', '1.0.0');
    this.llmService = llmService;
    
    // Get the default model from config
    const config = getLlmConfig();
    this.defaultModel = config.openai?.defaultModel || 'gpt-4o-mini';
  }

  async extract(
    fileContent: string,
    slot: string,
    context?: Record<string, any>
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();
    
    try {
      // Load the prompt template based on slot
      const prompt = await this.loadPrompt(slot);
      
      // Prepare messages for LLM
      const messages: LlmMessage[] = [
        { role: 'system', content: prompt },
        { role: 'user', content: fileContent }
      ];
      
      // Get completion from LLM
      const response = await this.llmService.complete(messages, {
        model: this.defaultModel,
        temperature: 0.3, // Lower temperature for more consistent structured output
        maxTokens: 2000
      });
      
      // Parse the response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(response);
      } catch (parseError) {
        console.error(`Failed to parse LLM response as JSON: ${response}`);
        // Return empty result with low confidence if parsing fails
        return this.createEmptyResult(traceId, startTime, 'Failed to parse LLM response');
      }
      
      // Validate and transform the response
      const result: ExtractionResult = {
        entities: parsedResponse.entities || [],
        links: parsedResponse.links || [],
        facts: parsedResponse.facts || [],
        metadata: {
          confidence: parsedResponse.metadata?.confidence || 0.5,
          processingTimeMs: Date.now() - startTime,
          model: this.defaultModel,
          trace_id: traceId
        }
      };
      
      // Add provenance to entities
      result.entities = result.entities.map(entity => ({
        ...entity,
        provenance: {
          source_parser: 'openai',
          parser_version: this.agentVersion,
          trace_id: traceId,
          raw_response: response
        }
      }));
      
      return result;
    } catch (error) {
      console.error(`Error in OpenAI extraction for slot ${slot}:`, error);
      return this.createEmptyResult(traceId, startTime, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadPrompt(slot: string): Promise<string> {
    // Load prompt from file
    if (slot === 'script') {
      // In a real implementation, this would read from the file
      // For now, we'll return the content directly
      return `You are an expert screenplay/script analyst. Your task is to extract structured information from the provided script content.

Follow these instructions precisely:
1. Identify all scenes and characters in the script
2. For each scene, extract:
   - sceneNumber: The scene number as written in the script (e.g., '1', '2A', '3b')
   - title: The scene title if explicitly stated
   - setting: The setting line (e.g., 'INT. COFFEE SHOP - DAY')
   - description: A brief description of the scene content
3. For each character, extract:
   - name: The character's name
   - description: A brief character description if available
4. Create links between scenes and characters who appear in them
5. Extract any notable facts about characters or scenes
6. Provide confidence scores (0.0 to 1.0) for each item based on how clearly the information is presented
7. Respond ONLY with a valid JSON object matching the schema provided
8. If you cannot extract certain information, omit those fields or entities rather than guessing

Schema:
{
  "entities": [
    {
      "type": "Scene",
      "properties": {
        "sceneNumber": "string",
        "title": "string",
        "setting": "string",
        "description": "string"
      },
      "confidence": number
    },
    {
      "type": "Character",
      "properties": {
        "name": "string",
        "description": "string"
      },
      "confidence": number
    }
  ],
  "links": [
    {
      "sourceType": "Scene",
      "sourceId": "string (matching scene identifier)",
      "targetType": "Character",
      "targetId": "string (matching character name)",
      "relationshipType": "APPEARS_IN",
      "properties": {
        "dialogueLines": number,
        "actionLines": number
      },
      "confidence": number
    }
  ],
  "facts": [
    {
      "subject": "string",
      "predicate": "string",
      "object": "string",
      "confidence": number,
      "context": "string"
    }
  ],
  "metadata": {
    "confidence": number,
    "processingTimeMs": number
  }
}

Now analyze the script content and respond with the JSON object.`;
    }
    
    // Default prompt for other slots
    return `Extract structured information from the document. Return a JSON object with entities, links, and facts as specified in the schema.`;
  }

  private createEmptyResult(traceId: string, startTime: number, errorMessage: string): ExtractionResult {
    return {
      entities: [],
      links: [],
      facts: [],
      metadata: {
        confidence: 0.0,
        processingTimeMs: Date.now() - startTime,
        trace_id: traceId
      }
    };
  }
}
