import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  appendBraveDomainFilters,
  appendBraveTopicIfNeeded,
  buildCapabilityNote,
  mapLanguageCode,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

function buildBraveSearchUrl(baseUrl?: string): string {
  if (!baseUrl) return BRAVE_SEARCH_URL;
  return `${baseUrl.replace(/\/+$/, '')}/res/v1/web/search`;
}

function mapFreshness(publishedAfter?: string, publishedBefore?: string): string | undefined {
  if (publishedAfter && publishedBefore) return `${publishedAfter}to${publishedBefore}`;
  if (publishedAfter) return `${publishedAfter}to`;
  if (publishedBefore) return `to${publishedBefore}`;
  return undefined;
}

export class BraveSearchAdapter extends CompiledSearchProvider {
  readonly id = 'brave';

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
      params.includeDomains ? 'includeDomains' : undefined,
      params.excludeDomains ? 'excludeDomains' : undefined,
      params.topic !== 'common' ? 'topic' : undefined,
    ].filter((value): value is string => Boolean(value));
    const ignoredFields = params.searchEffort ? ['searchEffort'] : [];
    return buildCapabilityNote(this.id, {
      nativeFields: [
        'query',
        'hasContent',
        'perChannelMaxResults',
        'publishedAfter',
        'publishedBefore',
        'language',
        'region',
      ],
      rewrittenFields,
      ignoredFields,
      notes: ['hasContent compiles to extra_snippets.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    let query = params.query;
    query = appendBraveDomainFilters(query, params.includeDomains, params.excludeDomains);
    query = appendBraveTopicIfNeeded(query, params.topic);

    const url = new URL(buildBraveSearchUrl(this.baseUrl));
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(params.perChannelMaxResults));
    if (params.hasContent) url.searchParams.set('extra_snippets', 'true');
    const freshness = mapFreshness(params.publishedAfter, params.publishedBefore);
    if (freshness) url.searchParams.set('freshness', freshness);
    const language = mapLanguageCode(params.language);
    if (language) url.searchParams.set('search_lang', language);
    if (params.region) url.searchParams.set('country', params.region);

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('brave', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        web?: {
          results?: {
            url: string;
            title: string;
            description?: string;
            extra_snippets?: string[];
            page_age?: string;
          }[];
        };
      };

      return (data.web?.results ?? [])
        .filter((r) => params.hasContent || Boolean(r.url))
        .map(
          (r): RawProviderResult => ({
            url: r.url,
            title: r.title,
            content: params.hasContent
              ? [r.description, ...(r.extra_snippets ?? [])].filter(Boolean).join('\n') || undefined
              : undefined,
            publishedDate: r.page_age ?? undefined,
          }),
        );
    });
  }
}
