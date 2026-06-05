import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  appendSearxngDateIfNeeded,
  appendSearxngTopicIfNeeded,
  buildCapabilityNote,
  filterResultsByDomains,
  limitResults,
  mapLanguageCode,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

function buildSearxngSearchUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/search`;
}

export class SearxngSearchAdapter extends CompiledSearchProvider {
  readonly id = 'searxng';

  constructor(private readonly baseUrl: string) {
    super();
  }

  protected buildCapabilityNote(
    params: ProviderSearchParams,
  ): ReturnType<typeof buildCapabilityNote> {
    const rewrittenFields = [
      params.publishedAfter || params.publishedBefore
        ? 'publishedAfter/publishedBefore'
        : undefined,
      params.topic !== 'common' ? 'topic' : undefined,
    ].filter((value): value is string => Boolean(value));
    const ignoredFields = [
      params.hasContent ? 'hasContent' : undefined,
      params.region ? 'region' : undefined,
      'searchEffort',
    ].filter((value): value is string => Boolean(value));
    return buildCapabilityNote(this.id, {
      nativeFields: ['query', 'language'],
      rewrittenFields,
      ignoredFields,
      notes: [
        'includeDomains/excludeDomains and perChannelMaxResults are enforced after normalization.',
      ],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    let query = params.query;
    query = appendSearxngTopicIfNeeded(query, params.topic);
    query = appendSearxngDateIfNeeded(query, params.publishedAfter, params.publishedBefore);

    const url = new URL(buildSearxngSearchUrl(this.baseUrl));
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    const language = mapLanguageCode(params.language);
    if (language) url.searchParams.set('language', language);

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(url, { signal });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('searxng', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results?: {
          url?: string;
          title?: string;
          content?: string;
          publishedDate?: string;
          published_date?: string;
        }[];
      };

      const normalized = (data.results ?? []).map(
        (r): RawProviderResult => ({
          url: r.url ?? '',
          title: r.title ?? r.url ?? 'Untitled',
          content: params.hasContent ? (r.content ?? undefined) : undefined,
          publishedDate: r.publishedDate ?? r.published_date ?? undefined,
        }),
      );

      return limitResults(
        filterResultsByDomains(normalized, params.includeDomains, params.excludeDomains),
        params.perChannelMaxResults,
      );
    });
  }
}
