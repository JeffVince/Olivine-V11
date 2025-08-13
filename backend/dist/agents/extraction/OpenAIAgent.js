"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAgent = void 0;
const BaseExtractionAgent_1 = require("./BaseExtractionAgent");
const llm_1 = require("../../config/llm");
class OpenAIAgent extends BaseExtractionAgent_1.BaseExtractionAgent {
    constructor(llmService) {
        super('openai-extraction-agent', '1.0.0');
        this.llmService = llmService;
        const config = (0, llm_1.getLlmConfig)();
        this.defaultModel = config.openai?.defaultModel || 'gpt-4o-mini';
    }
    async extract(fileContent, slot, context) {
        const startTime = Date.now();
        const traceId = this.generateTraceId();
        try {
            const prompt = await this.loadPrompt(slot);
            const messages = [
                { role: 'system', content: prompt },
                { role: 'user', content: fileContent }
            ];
            const response = await this.llmService.complete(messages, {
                model: this.defaultModel,
                temperature: 0.3,
                maxTokens: 2000
            });
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(response);
            }
            catch (parseError) {
                console.error(`Failed to parse LLM response as JSON: ${response}`);
                return this.createEmptyResult(traceId, startTime, 'Failed to parse LLM response');
            }
            const result = {
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
        }
        catch (error) {
            console.error(`Error in OpenAI extraction for slot ${slot}:`, error);
            return this.createEmptyResult(traceId, startTime, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async loadPrompt(slot) {
        if (slot === 'script') {
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
        return `Extract structured information from the document. Return a JSON object with entities, links, and facts as specified in the schema.`;
    }
    createEmptyResult(traceId, startTime, errorMessage) {
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
exports.OpenAIAgent = OpenAIAgent;
//# sourceMappingURL=OpenAIAgent.js.map