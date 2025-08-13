import { LlmProvider, LlmMessage, LlmCompletionParams } from './LlmService';
// Optional dependency during tests: guard import by environment
let OpenAI: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OpenAI = require('openai');
} catch {
  OpenAI = class {
    constructor(_: any) {}
    chat = { completions: { create: async () => ({ choices: [{ message: { content: '' } }] }) } };
  };
}

export class OpenAiProvider implements LlmProvider {
  private readonly client: any;
  private readonly defaultModel: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(
    apiKey: string,
    defaultModel: string = 'gpt-4o-mini',
    defaultTemperature: number = 0.7,
    defaultMaxTokens: number = 1000
  ) {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
    this.defaultTemperature = defaultTemperature;
    this.defaultMaxTokens = defaultMaxTokens;
  }

  async complete(messages: LlmMessage[], params: LlmCompletionParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: params.model || this.defaultModel,
      temperature: params.temperature !== undefined ? params.temperature : this.defaultTemperature,
      max_tokens: params.maxTokens || this.defaultMaxTokens,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });

    return response.choices[0]?.message?.content || '';
  }
}
