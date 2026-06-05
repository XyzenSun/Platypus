import type { Config, ProviderId } from '../config/types.js';
import { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import { BraveSearchAdapter } from './brave.js';
import { ExaFetchAdapter } from './exa-fetch.js';
import { ExaSearchAdapter } from './exa.js';
import type { FetchProvider } from './fetch-types.js';
import { FirecrawlFetchAdapter } from './firecrawl-fetch.js';
import { FirecrawlSearchAdapter } from './firecrawl.js';
import { GeminiSearchAdapter } from './gemini.js';
import { JinaFetchAdapter } from './jina-fetch.js';
import { JinaSearchAdapter } from './jina.js';
import type { SearchProvider } from './search-types.js';
import { SearxngSearchAdapter } from './searxng.js';
import { TavilyFetchAdapter } from './tavily-fetch.js';
import { TavilySearchAdapter } from './tavily.js';
import { PROVIDER_CAPABILITIES } from './types.js';

export interface ListResult {
  [key: string]: unknown;
  search: ProviderId[];
  fetch: ProviderId[];
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
  ];

  const configured = ALL_PROVIDERS.filter((p) => isConfigured(p, config));

  const searchProviders = configured.filter((p) => PROVIDER_CAPABILITIES[p].search);
  const fetchProviders = configured.filter((p) => PROVIDER_CAPABILITIES[p].fetch);

  return {
    search: searchProviders,
    fetch: fetchProviders,
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
  return providers;
}

export function getFetchProviders(config: Config): FetchProvider[] {
  const providers: FetchProvider[] = [];
  if (config.firecrawl?.apiKey) providers.push(new FirecrawlFetchAdapter(config.firecrawl.apiKey));
  if (config.jina?.apiKey) providers.push(new JinaFetchAdapter(config.jina.apiKey));
  if (config.tavily?.apiKey) {
    providers.push(new TavilyFetchAdapter(config.tavily.apiKey, config.tavily.baseUrl));
  }
  if (config.exa?.apiKey) {
    providers.push(new ExaFetchAdapter(config.exa.apiKey, config.exa.baseUrl));
  }
  return providers;
}
