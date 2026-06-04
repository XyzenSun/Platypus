export type ProviderId = 'tavily' | 'exa' | 'brave' | 'jina' | 'searxng' | 'firecrawl';

export interface Config {
  tavily?: { apiKey: string };
  exa?: { apiKey: string };
  brave?: { apiKey: string };
  jina?: { apiKey: string };
  searxng?: { baseUrl: string };
  firecrawl?: { apiKey: string };
  ai?: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    format: 'openai' | 'anthropic' | 'gemini';
  };
}
