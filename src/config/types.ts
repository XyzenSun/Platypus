export type ProviderId = 'tavily' | 'exa' | 'brave' | 'jina' | 'searxng' | 'firecrawl' | 'gemini';

export interface SearchPostProcessConfig {
  providerWeights: Partial<Record<ProviderId, number>>;
  domainBlacklistUrl: string;
  domainBlacklist: ReadonlySet<string>;
}

export interface Config {
  tavily?: { apiKey: string; baseUrl?: string };
  exa?: { apiKey: string; baseUrl?: string };
  brave?: { apiKey: string; baseUrl?: string };
  jina?: { apiKey: string; baseUrl?: string };
  searxng?: { baseUrl: string };
  firecrawl?: { apiKey: string; baseUrl?: string };
  gemini?: { apiKey: string; baseUrl?: string; model?: string };
  ai?: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    format: 'openai' | 'anthropic' | 'gemini';
  };
  searchPostProcess: SearchPostProcessConfig;
}
