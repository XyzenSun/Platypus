import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  buildCapabilityNote,
  mapLanguageCode,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const DEFAULT_FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev';

function buildFirecrawlSearchUrl(baseUrl?: string): string {
  return `${(baseUrl ?? DEFAULT_FIRECRAWL_BASE_URL).replace(/\/$/, '')}/v1/search`;
}

function mapSources(topic: ProviderSearchParams['topic']): string[] {
  return topic === 'news' ? ['news'] : ['web'];
}

function buildTbs(publishedAfter?: string, publishedBefore?: string): string | undefined {
  if (!publishedAfter && !publishedBefore) return undefined;
  if (publishedAfter && publishedBefore)
    return `cdr:1,cd_min:${publishedAfter},cd_max:${publishedBefore}`;
  if (publishedAfter) return `cdr:1,cd_min:${publishedAfter}`;
  return `cdr:1,cd_max:${publishedBefore}`;
}

export class FirecrawlSearchAdapter extends CompiledSearchProvider {
  readonly id = 'firecrawl';

  private readonly searchUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl?: string,
  ) {
    super();
    this.searchUrl = buildFirecrawlSearchUrl(baseUrl);
  }

  protected buildCapabilityNote(): ReturnType<typeof buildCapabilityNote> {
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
        'language',
        'region',
      ],
      ignoredFields: ['searchEffort'],
      notes: ['hasContent compiles to scrapeOptions.formats.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    const body: Record<string, unknown> = {
      q: params.query,
      limit: params.perChannelMaxResults,
      includeDomains: params.includeDomains
        ?.split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      excludeDomains: params.excludeDomains
        ?.split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      sources: mapSources(params.topic),
    };

    const tbs = buildTbs(params.publishedAfter, params.publishedBefore);
    if (tbs) body.tbs = tbs;
    if (params.region) body.country = params.region;
    if (params.hasContent) {
      body.scrapeOptions = {
        formats: ['markdown', 'summary', 'html'],
        location: {
          languages: mapLanguageCode(params.language)
            ? [mapLanguageCode(params.language)]
            : undefined,
        },
      };
    } else if (params.language) {
      body.scrapeOptions = {
        location: {
          languages: [mapLanguageCode(params.language)],
        },
      };
    }

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(this.searchUrl, {
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
        throw new ProviderError('firecrawl', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        data?: {
          url?: string;
          title?: string;
          markdown?: string;
          summary?: string;
          description?: string;
          metadata?: { publishedTime?: string };
        }[];
      };

      return (data.data ?? [])
        .filter((r) => params.hasContent || Boolean(r.url))
        .map(
          (r): RawProviderResult => ({
            url: r.url ?? '',
            title: r.title ?? r.url ?? 'Untitled',
            content: params.hasContent
              ? (r.markdown ?? r.summary ?? r.description ?? undefined)
              : undefined,
            publishedDate: r.metadata?.publishedTime ?? undefined,
          }),
        );
    });
  }
}
