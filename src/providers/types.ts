import type { ProviderId } from '../config/types.js';

export interface ProviderCapability {
  search: boolean;
  fetch: boolean;
  searchOptInOnly: boolean;
}

export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability> = {
  tavily: { search: true, fetch: true, searchOptInOnly: false },
  exa: { search: true, fetch: true, searchOptInOnly: false },
  brave: { search: true, fetch: false, searchOptInOnly: false },
  jina: { search: false, fetch: true, searchOptInOnly: false },
  searxng: { search: true, fetch: false, searchOptInOnly: false },
  firecrawl: { search: true, fetch: true, searchOptInOnly: true },
};

// Default fetch channel order: Firecrawl > Jina (MVP1 defaults)
export const DEFAULT_FETCH_PRIORITY: ProviderId[] = ['firecrawl', 'jina'];
