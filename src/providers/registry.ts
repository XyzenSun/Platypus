import type { Config, ProviderId } from '../config/types.js';
import { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import { BraveSearchAdapter } from './brave.js';
import { ExaSearchAdapter } from './exa.js';
import { FirecrawlSearchAdapter } from './firecrawl.js';
import { GeminiSearchAdapter } from './gemini.js';
import { JinaSearchAdapter } from './jina.js';
import { OllamaSearchAdapter } from './ollama.js';
import type { SearchProvider } from './search-types.js';
import { SearxngSearchAdapter } from './searxng.js';
import { TavilySearchAdapter } from './tavily.js';

export interface ListResult {
  [key: string]: unknown;
  providers: ProviderId[];
}

export function buildRegistry(config: Config): ListResult {
  const ALL_PROVIDERS: ProviderId[] = [
    'tavily',
    'exa',
    'brave',
    'jina',
    'searxng',
    'firecrawl',
    'gemini',
    'ollama',
  ];

  const configured = ALL_PROVIDERS.filter((p) => isConfigured(p, config));

  return {
    providers: configured,
  };
}

function isConfigured(provider: ProviderId, config: Config): boolean {
  switch (provider) {
    case 'tavily':
      return !!config.tavily?.apiKey;
    case 'exa':
      return !!config.exa?.apiKey;
    case 'brave':
      return !!config.brave?.apiKey;
    case 'jina':
      return !!config.jina?.apiKey;
    case 'searxng':
      return !!config.searxng?.baseUrl;
    case 'firecrawl':
      return !!config.firecrawl?.apiKey;
    case 'gemini':
      return !!config.gemini?.apiKey;
    case 'ollama':
      return !!config.ollama?.apiKey;
  }
}

export function getSearchProviders(config: Config): SearchProvider[] {
  const providers: SearchProvider[] = [];
  if (config.tavily?.apiKey) {
    providers.push(new TavilySearchAdapter(config.tavily.apiKey, config.tavily.baseUrl));
  }
  if (config.exa?.apiKey) {
    providers.push(new ExaSearchAdapter(config.exa.apiKey, config.exa.baseUrl));
  }
  if (config.brave?.apiKey) {
    providers.push(new BraveSearchAdapter(config.brave.apiKey, config.brave.baseUrl));
  }
  if (config.jina?.apiKey) {
    providers.push(new JinaSearchAdapter(config.jina.apiKey, config.jina.baseUrl));
  }
  if (config.searxng?.baseUrl) {
    providers.push(new SearxngSearchAdapter(config.searxng.baseUrl));
  }
  if (config.firecrawl?.apiKey) {
    providers.push(new FirecrawlSearchAdapter(config.firecrawl.apiKey, config.firecrawl.baseUrl));
  }
  if (config.gemini?.apiKey) {
    providers.push(
      new GeminiSearchAdapter(
        new GeminiAIClient({
          apiKey: config.gemini.apiKey,
          baseUrl: config.gemini.baseUrl,
          model: config.gemini.model,
        }),
      ),
    );
  }
  if (config.ollama?.apiKey) {
    providers.push(new OllamaSearchAdapter(config.ollama.apiKey, config.ollama.baseUrl));
  }
  return providers;
}
