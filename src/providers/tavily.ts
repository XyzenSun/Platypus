import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  appendLanguageIfNeeded,
  appendRegionIfNeeded,
  buildCapabilityNote,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

function buildTavilySearchUrl(baseUrl?: string): string {
  if (!baseUrl) return TAVILY_SEARCH_URL;
  return `${baseUrl.replace(/\/+$/, '')}/search`;
}

function mapTopic(topic: ProviderSearchParams['topic']): string {
  if (topic === 'news') return 'news';
  if (topic === 'finance') return 'finance';
  return 'general';
}

function mapDepth(searchEffort: ProviderSearchParams['searchEffort']): string {
  if (searchEffort === 'low') return 'fast';
  if (searchEffort === 'high') return 'advanced';
  return 'basic';
}

export class TavilySearchAdapter extends CompiledSearchProvider {
  readonly id = 'tavily';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string,
  ) {
    super();
  }

  protected buildCapabilityNote(
    params: ProviderSearchParams,
  ): ReturnType<typeof buildCapabilityNote> {
    const rewrittenFields = [
      params.language ? 'language' : undefined,
      params.region ? 'region' : undefined,
    ].filter((value): value is string => Boolean(value));
    return buildCapabilityNote(this.id, {
      nativeFields: [
        'query',
        'hasContent',
        'perChannelMaxResults',
        'includeDomains',
        'excludeDomains',
        'publishedAfter',
        'publishedBefore',
        'topic',
      ],
      rewrittenFields,
      notes: ['searchEffort compiles to search_depth.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    let query = params.query;
    query = appendLanguageIfNeeded(query, params.language);
    query = appendRegionIfNeeded(query, params.region);

    const body: Record<string, unknown> = {
      query,
      max_results: Math.min(params.perChannelMaxResults, 20),
      search_depth: mapDepth(params.searchEffort),
      topic: mapTopic(params.topic),
    };

    if (params.hasContent) body.include_raw_content = true;
    if (params.includeDomains)
      body.include_domains = params.includeDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    if (params.excludeDomains)
      body.exclude_domains = params.excludeDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    if (params.publishedAfter) body.start_date = params.publishedAfter;
    if (params.publishedBefore) body.end_date = params.publishedBefore;

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(buildTavilySearchUrl(this.baseUrl), {
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
        throw new ProviderError('tavily', category, String(res.status), text || res.statusText);
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

      return data.results
        .filter((r) => params.hasContent || Boolean(r.url))
        .map((r) => ({
          url: r.url,
          title: r.title,
          content: params.hasContent ? (r.raw_content ?? r.content ?? undefined) : undefined,
          publishedDate: r.published_date ?? undefined,
        }));
    });
  }
}
