本项目中的Query字段：
export interface NormalizedSearchParams {
  query: string;
  mode: 'default' | 'high';
  channels?: string[];
  hasContent: boolean;
  perChannelMaxResults: number;
  includeDomains?: string;
  excludeDomains?: string;
  startDate?: string;
  endDate?: string;
  topic: string;
  searchDepth: 'fast' | 'balanced' | 'deep';
  includeImages: boolean;
  timeoutMs: number;
}

topic：可选项
对应：
gernal - exa: 不传
       - tavily: topic=  general
       - jina: web
news -  exa: category=news
       - tavily: topic=news
       - jina: news