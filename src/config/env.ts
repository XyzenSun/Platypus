import type { Config } from './types.js';

export function loadConfig(): Config {
  const config: Config = {};

  if (process.env.TAVILY_API_KEY) config.tavily = { apiKey: process.env.TAVILY_API_KEY };
  if (process.env.EXA_API_KEY) config.exa = { apiKey: process.env.EXA_API_KEY };
  if (process.env.BRAVE_API_KEY) config.brave = { apiKey: process.env.BRAVE_API_KEY };
  if (process.env.JINA_API_KEY) config.jina = { apiKey: process.env.JINA_API_KEY };
  if (process.env.SEARXNG_BASE_URL) config.searxng = { baseUrl: process.env.SEARXNG_BASE_URL };
  if (process.env.FIRECRAWL_API_KEY) config.firecrawl = { apiKey: process.env.FIRECRAWL_API_KEY };
  if (process.env.AI_API_KEY) {
    config.ai = {
      apiKey: process.env.AI_API_KEY,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
    };
  }

  return config;
}
