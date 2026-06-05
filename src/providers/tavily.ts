import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { NormalizedSearchParams, RawProviderResult, SearchProvider } from './search-types.js';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

const TOPIC_MAP: Record<string, string> = {
  general: 'general',
  news: 'news',
  finance: 'finance',
};

const DEPTH_MAP: Record<string, string> = {
  fast: 'fast',
  balanced: 'basic',
  deep: 'advanced',
};

export class TavilySearchAdapter implements SearchProvider {
  readonly id = 'tavily';

  constructor(private readonly apiKey: string) {}

  async search(params: NormalizedSearchParams): Promise<RawProviderResult[]> {
    const body: Record<string, unknown> = {
      query: params.query,
      max_results: Math.min(params.perChannelMaxResults, 20),
      search_depth: DEPTH_MAP[params.searchDepth] ?? 'basic',
      include_images: params.includeImages,
    };

    if (params.hasContent) body.include_raw_content = 'markdown';

    const topic = TOPIC_MAP[params.topic];
    if (topic) body.topic = topic;

    if (params.includeDomains) {
      body.include_domains = params.includeDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    }
    if (params.excludeDomains) {
      body.exclude_domains = params.excludeDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    }
    if (params.startDate) body.start_date = params.startDate;
    if (params.endDate) body.end_date = params.endDate;

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        const err = new ProviderError(
          'tavily',
          category,
          String(res.status),
          text || res.statusText,
        );
        throw err;
      }

      const data = (await res.json()) as {
        results: {
          url: string;
          title: string;
          content: string;
          raw_content?: string;
          published_date?: string;
        }[];
      };

      return data.results.map((r) => ({
        url: r.url,
        title: r.title ?? '',
        snippet: r.content ?? '',
        content: params.hasContent ? (r.raw_content ?? undefined) : undefined,
        publishedDate: r.published_date ?? undefined,
      }));
    });
  }
}
