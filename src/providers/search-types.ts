export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  content?: string;
  score: number;
  rank: number;
  sources: string[];
  publishedDate?: string;
}

export interface SearchWarning {
  provider: string;
  code: string;
  message: string;
}

export interface SearchResponse {
  results: SearchResult[];
  warnings: SearchWarning[];
  error?: string;
}

export interface NormalizedSearchParams {
  query: string;
  mode: 'default' | 'high';
  channels?: string[];
  hasContent: boolean;
  numResults: number;
  includeDomains?: string;
  excludeDomains?: string;
  startDate?: string;
  endDate?: string;
  topic: string;
  searchDepth: 'fast' | 'balanced' | 'deep';
  includeImages: boolean;
  timeoutMs: number;
}

export interface RawProviderResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
}

export interface SearchProvider {
  id: string;
  search(params: NormalizedSearchParams): Promise<RawProviderResult[]>;
}
