import type { ProviderId } from '../config/types.js';

export interface ProviderCapability {
  search: boolean;
  fetch: boolean;
}

export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability> = {
  tavily: { search: true, fetch: true },
  exa: { search: true, fetch: true },
  brave: { search: true, fetch: false },
  jina: { search: true, fetch: true },
  searxng: { search: true, fetch: false },
  firecrawl: { search: true, fetch: true },
  gemini: { search: true, fetch: false },
  ollama: { search: true, fetch: false },
};

export const DEFAULT_FETCH_PRIORITY: ProviderId[] = ['firecrawl', 'jina'];
