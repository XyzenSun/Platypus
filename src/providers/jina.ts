import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  appendDateRangeToQuery,
  appendLanguageIfNeeded,
  buildCapabilityNote,
  filterResultsByDomains,
  limitResults,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const JINA_SEARCH_URL = 'https://s.jina.ai/search';

function buildJinaSearchUrl(baseUrl?: string): string {
  if (!baseUrl) return JINA_SEARCH_URL;
  return `${baseUrl.replace(/\/+$/, '')}/search`;
}

function mapRespondWith(hasContent: boolean): 'all' | 'no-content' {
  return hasContent ? 'all' : 'no-content';
}

function mapType(topic: ProviderSearchParams['topic']): string {
  return topic === 'news' ? 'news' : 'web';
}

export class JinaSearchAdapter extends CompiledSearchProvider {
  readonly id = 'jina';

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
      params.publishedAfter || params.publishedBefore
        ? 'publishedAfter/publishedBefore'
        : undefined,
    ].filter((value): value is string => Boolean(value));
    return buildCapabilityNote(this.id, {
      nativeFields: ['query', 'hasContent', 'perChannelMaxResults', 'topic', 'region'],
      rewrittenFields,
      ignoredFields: ['searchEffort'],
      notes: ['includeDomains/excludeDomains are enforced by adapter-side filtering.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    let query = params.query;
    query = appendLanguageIfNeeded(query, params.language);
    query = appendDateRangeToQuery(query, params.publishedAfter, params.publishedBefore);

    const url = new URL(buildJinaSearchUrl(this.baseUrl));
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(params.perChannelMaxResults));
    url.searchParams.set('respondWith', mapRespondWith(params.hasContent));
    url.searchParams.set('type', mapType(params.topic));
    if (params.region) url.searchParams.set('gl', params.region);

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('jina', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        data?: {
          url?: string;
          title?: string;
          content?: string;
          description?: string;
          publishedDate?: string;
        }[];
      };

      const normalized = (data.data ?? [])
        .filter((r) => params.hasContent || Boolean(r.url))
        .map(
          (r): RawProviderResult => ({
            url: r.url ?? '',
            title: r.title ?? r.url ?? 'Untitled',
            content: params.hasContent ? (r.content ?? r.description ?? undefined) : undefined,
            publishedDate: r.publishedDate ?? undefined,
          }),
        );

      return limitResults(
        filterResultsByDomains(normalized, params.includeDomains, params.excludeDomains),
        params.perChannelMaxResults,
      );
    });
  }
}
