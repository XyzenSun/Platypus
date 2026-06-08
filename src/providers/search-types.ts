export interface SearchResult {
  id: string;
  title: string;
  url: string;
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

export type SearchMode = 'BasicAggregation' | 'AIAggregation';
export type SearchTopic = 'common' | 'news' | 'finance';
export type SearchLanguage = 'zh_cn' | 'us_en';
export type SearchRegion = 'US' | 'CN' | 'GB' | 'DE' | 'FR' | 'JP' | 'CA';
export type SearchEffort = 'low' | 'medium' | 'high';

export interface SearchRequest {
  query: string;
  mode: SearchMode;
  channels?: string[];
  timeoutMs: number;
  hasContent: boolean;
  perChannelMaxResults: number;
  includeDomains?: string;
  excludeDomains?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  topic: SearchTopic;
  language?: SearchLanguage;
  region?: SearchRegion;
  searchEffort: SearchEffort;
  minScore?: number;
  maxRank?: number;
}

export interface ProviderSearchParams {
  query: string;
  hasContent: boolean;
  perChannelMaxResults: number;
  includeDomains?: string;
  excludeDomains?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  topic: SearchTopic;
  language?: SearchLanguage;
  region?: SearchRegion;
  searchEffort: SearchEffort;
  timeoutMs: number;
}

export interface RawProviderResult {
  url: string;
  title: string;
  content?: string;
  publishedDate?: string;
}

export interface SearchProviderCapabilityNote {
  provider: string;
  ignoredFields?: string[];
  rewrittenFields?: string[];
  nativeFields?: string[];
  notes?: string[];
}

export interface SearchExecution {
  provider: string;
  results: RawProviderResult[];
  capabilityNote?: SearchProviderCapabilityNote;
}

export interface SearchProvider {
  id: string;
  search(params: ProviderSearchParams): Promise<SearchExecution>;
}
