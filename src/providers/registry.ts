import type { Config, ProviderId } from '../config/types.js';
import { GeminiAIClient } from '../lib/ai-clients/gemini.js';
import { ExaFetchAdapter } from './exa-fetch.js';
import { ExaSearchAdapter } from './exa.js';
import type { FetchProvider } from './fetch-types.js';
import { FirecrawlFetchAdapter } from './firecrawl-fetch.js';
import { GeminiSearchAdapter } from './gemini.js';
import { JinaFetchAdapter } from './jina-fetch.js';
import type { SearchProvider } from './search-types.js';
import { TavilyFetchAdapter } from './tavily-fetch.js';
import { TavilySearchAdapter } from './tavily.js';
import { DEFAULT_FETCH_PRIORITY, PROVIDER_CAPABILITIES } from './types.js';

export interface ListResult {
  [key: string]: unknown;
  search: ProviderId[];
  fetch: ProviderId[];
  defaultSearchChannels: ProviderId[];
  defaultFetchChannels: ProviderId[];
  optInOnly: ProviderId[];
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

  const optInOnly = searchProviders.filter((p) => PROVIDER_CAPABILITIES[p].searchOptInOnly);
  const defaultSearchChannels = searchProviders.filter(
    (p) => !PROVIDER_CAPABILITIES[p].searchOptInOnly,
  );

  // Default fetch: priority order (firecrawl > jina), then others
  const defaultFetchChannels = [
    ...DEFAULT_FETCH_PRIORITY.filter((p) => fetchProviders.includes(p)),
    ...fetchProviders.filter((p) => !DEFAULT_FETCH_PRIORITY.includes(p)),
  ];

  return {
    search: searchProviders,
    fetch: fetchProviders,
    defaultSearchChannels,
    defaultFetchChannels,
    optInOnly,
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
  if (config.tavily?.apiKey) providers.push(new TavilySearchAdapter(config.tavily.apiKey));
  if (config.exa?.apiKey) providers.push(new ExaSearchAdapter(config.exa.apiKey));
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
  if (config.tavily?.apiKey) providers.push(new TavilyFetchAdapter(config.tavily.apiKey));
  if (config.exa?.apiKey) providers.push(new ExaFetchAdapter(config.exa.apiKey));
  return providers;
}
