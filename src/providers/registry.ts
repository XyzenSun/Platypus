import type { Config, ProviderId } from '../config/types.js';
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
  const ALL_PROVIDERS: ProviderId[] = ['tavily', 'exa', 'brave', 'jina', 'searxng', 'firecrawl'];

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
  }
}
