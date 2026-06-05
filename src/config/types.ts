export type ProviderId = 'tavily' | 'exa' | 'brave' | 'jina' | 'searxng' | 'firecrawl' | 'gemini';

export interface Config {
  tavily?: { apiKey: string; baseUrl?: string };
  exa?: { apiKey: string; baseUrl?: string };
  brave?: { apiKey: string };
  jina?: { apiKey: string };
  searxng?: { baseUrl: string };
  firecrawl?: { apiKey: string };
  gemini?: { apiKey: string; baseUrl?: string; model?: string };
  ai?: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    format: 'openai' | 'anthropic' | 'gemini';
  };
}
