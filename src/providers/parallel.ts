import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  appendDateRangeToQuery,
  appendLanguageIfNeeded,
  appendRegionIfNeeded,
  buildCapabilityNote,
  filterResultsByDomains,
  limitResults,
  mapLanguageCode,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const PARALLEL_SEARCH_URL = 'https://api.parallel.ai/v1/search';
const PARALLEL_MAX_RESULTS = 10;
const PARALLEL_MAX_CHARS_TOTAL = 12_000;
const PARALLEL_MAX_CHARS_PER_RESULT = 2_000;

function buildParallelSearchUrl(baseUrl?: string): string {
  if (!baseUrl) return PARALLEL_SEARCH_URL;
  return `${baseUrl.replace(/\/+$/, '')}/v1/search`;
}

function mapMode(searchEffort: ProviderSearchParams['searchEffort']): 'basic' | 'advanced' {
  return searchEffort === 'low' ? 'basic' : 'advanced';
}

function mapLocation(region?: ProviderSearchParams['region']): string | undefined {
  return region?.toLowerCase();
}

function mapTopicQuery(query: string, topic: ProviderSearchParams['topic']): string {
  if (topic === 'news') return `${query} latest news`;
  if (topic === 'finance') return `${query} finance markets earnings`;
  return query;
}

function buildSearchQueries(query: string): string[] {
  return [query];
}

export class ParallelSearchAdapter extends CompiledSearchProvider {
  readonly id = 'parallel';

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
      params.topic !== 'common' ? 'topic' : undefined,
      params.language ? 'language' : undefined,
      params.publishedAfter || params.publishedBefore
        ? 'publishedAfter/publishedBefore'
        : undefined,
    ].filter((value): value is string => Boolean(value));

    return buildCapabilityNote(this.id, {
      nativeFields: [
        'query',
        'hasContent',
        'perChannelMaxResults',
        'includeDomains',
        'excludeDomains',
        'publishedAfter',
        'region',
        'searchEffort',
        'timeoutMs',
      ],
      rewrittenFields,
      notes: [
        'publishedBefore is enforced by adapter-side filtering because the upstream source policy only exposes after_date.',
        'language compiles to client_model plus query rewrite; topic compiles to query rewrite.',
        'hasContent=false cannot disable upstream excerpts and is normalized by omitting content locally.',
      ],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    let objective = params.query;
    objective = mapTopicQuery(objective, params.topic);
    objective = appendLanguageIfNeeded(objective, params.language);
    objective = appendRegionIfNeeded(objective, params.region);
    objective = appendDateRangeToQuery(objective, params.publishedAfter, params.publishedBefore);

    const body: Record<string, unknown> = {
      objective,
      search_queries: buildSearchQueries(params.query),
      mode: mapMode(params.searchEffort),
      max_chars_total: PARALLEL_MAX_CHARS_TOTAL,
      advanced_settings: {
        max_results: Math.min(params.perChannelMaxResults, PARALLEL_MAX_RESULTS),
        excerpt_settings: {
          max_chars_per_result: params.hasContent ? PARALLEL_MAX_CHARS_PER_RESULT : 1,
        },
      },
    };

    const advancedSettings = body.advanced_settings as Record<string, unknown>;

    const sourcePolicy: Record<string, unknown> = {};
    if (params.includeDomains) {
      sourcePolicy.include_domains = params.includeDomains
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean);
    }
    if (params.excludeDomains) {
      sourcePolicy.exclude_domains = params.excludeDomains
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean);
    }
    if (params.publishedAfter) {
      sourcePolicy.after_date = params.publishedAfter;
    }
    if (Object.keys(sourcePolicy).length > 0) {
      advancedSettings.source_policy = sourcePolicy;
    }

    const location = mapLocation(params.region);
    if (location) {
      advancedSettings.location = location;
    }

    const language = mapLanguageCode(params.language);
    if (language) {
      body.client_model = `platypus-search-${language}`;
    }

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(buildParallelSearchUrl(this.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('parallel', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results?: {
          url: string;
          title?: string | null;
          publish_date?: string | null;
          excerpts?: string[];
        }[];
      };

      const normalized = (data.results ?? [])
        .filter((result) => params.hasContent || Boolean(result.url))
        .map(
          (result): RawProviderResult => ({
            url: result.url,
            title: result.title ?? result.url ?? 'Untitled',
            content: params.hasContent
              ? result.excerpts?.filter(Boolean).join('\n\n') || undefined
              : undefined,
            publishedDate: result.publish_date ?? undefined,
          }),
        );

      return limitResults(
        filterResultsByDomains(normalized, params.includeDomains, params.excludeDomains).filter(
          (result) =>
            !params.publishedBefore ||
            !result.publishedDate ||
            result.publishedDate <= params.publishedBefore,
        ),
        params.perChannelMaxResults,
      );
    });
  }
}
