import type { Config } from './types.js';

export function loadConfig(): Config {
  const config: Config = {};

  if (process.env.TAVILY_API_KEY) {
    config.tavily = {
      apiKey: process.env.TAVILY_API_KEY,
      baseUrl: process.env.TAVILY_BASE_URL,
    };
  }
  if (process.env.EXA_API_KEY) {
    config.exa = {
      apiKey: process.env.EXA_API_KEY,
      baseUrl: process.env.EXA_BASE_URL,
    };
  }
  if (process.env.BRAVE_API_KEY) {
    config.brave = {
      apiKey: process.env.BRAVE_API_KEY,
      baseUrl: process.env.BRAVE_BASE_URL,
    };
  }
  if (process.env.JINA_API_KEY) {
    config.jina = {
      apiKey: process.env.JINA_API_KEY,
      baseUrl: process.env.JINA_BASE_URL,
    };
  }
  if (process.env.SEARXNG_BASE_URL) config.searxng = { baseUrl: process.env.SEARXNG_BASE_URL };
  if (process.env.FIRECRAWL_API_KEY) {
    config.firecrawl = {
      apiKey: process.env.FIRECRAWL_API_KEY,
      baseUrl: process.env.FIRECRAWL_BASE_URL,
    };
  }
  if (process.env.GEMINI_API_KEY) {
    config.gemini = {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: process.env.GEMINI_BASE_URL,
      model: process.env.GEMINI_MODEL,
    };
  }
  if (process.env.AI_API_KEY) {
    const format = process.env.AI_FORMAT as 'openai' | 'anthropic' | 'gemini' | undefined;
    config.ai = {
      apiKey: process.env.AI_API_KEY,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      format: format ?? 'openai',
    };
  }

  return config;
}
