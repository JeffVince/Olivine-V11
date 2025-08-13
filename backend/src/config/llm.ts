import { config } from 'dotenv';
import { LlmProvider } from '../services/llm/LlmService';
import { OpenAiProvider } from '../services/llm/OpenAiProvider';
import { MockLlmProvider } from '../services/llm/MockLlmProvider';

// Load environment variables
config();

export interface LlmConfig {
  provider: 'openai' | 'mock';
  openai?: {
    apiKey: string;
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
  };
}

/**
 * Get LLM configuration from environment variables
 * @returns LlmConfig object with provider settings
 */
export function getLlmConfig(): LlmConfig {
  const provider = process.env.LLM_PROVIDER || 'mock';
  
  if (provider === 'openai') {
    return {
      provider: 'openai',
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
        defaultTemperature: parseFloat(process.env.OPENAI_DEFAULT_TEMPERATURE || '0.7'),
        defaultMaxTokens: parseInt(process.env.OPENAI_DEFAULT_MAX_TOKENS || '1000')
      }
    };
  }
  
  return {
    provider: 'mock'
  };
}

/**
 * Create LLM provider instance based on configuration
 * @returns LlmProvider instance
 */
export function createLlmProvider(): LlmProvider {
  const config = getLlmConfig();
  
  if (config.provider === 'openai' && config.openai) {
    return new OpenAiProvider(
      config.openai.apiKey,
      config.openai.defaultModel,
      config.openai.defaultTemperature,
      config.openai.defaultMaxTokens
    );
  }
  
  return new MockLlmProvider();
}
