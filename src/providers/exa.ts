import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import {
  CompiledSearchProvider,
  buildCapabilityNote,
  mapLanguageCode,
} from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const EXA_SEARCH_URL = 'https://api.exa.ai/search';
const EXA_MAX_NUM_RESULTS = 100;

function buildExaSearchUrl(baseUrl?: string): string {
  if (!baseUrl) return EXA_SEARCH_URL;
  return `${baseUrl.replace(/\/+$/, '')}/search`;
}

function mapCategory(topic: ProviderSearchParams['topic']): string | undefined {
  if (topic === 'news') return 'news';
  if (topic === 'finance') return 'financial report';
  return undefined;
}

function mapSearchType(searchEffort: ProviderSearchParams['searchEffort']): string {
  if (searchEffort === 'low') return 'fast';
  if (searchEffort === 'high') return 'deep';
  return 'auto';
}

export class ExaSearchAdapter extends CompiledSearchProvider {
  readonly id = 'exa';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string,
  ) {
    super();
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
        'language',
        'region',
      ],
      notes: ['topic compiles to category and searchEffort compiles to type.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    const body: Record<string, unknown> = {
      query: params.query,
      numResults: Math.min(params.perChannelMaxResults, EXA_MAX_NUM_RESULTS),
      type: mapSearchType(params.searchEffort),
    };

    const category = mapCategory(params.topic);
    if (category) body.category = category;
    if (params.includeDomains)
      body.includeDomains = params.includeDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    if (params.excludeDomains)
      body.excludeDomains = params.excludeDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    if (params.publishedAfter) body.startPublishedDate = params.publishedAfter;
    if (params.publishedBefore) body.endPublishedDate = params.publishedBefore;
    const language = mapLanguageCode(params.language);
    if (language) body.language = language;
    if (params.region) body.userLocation = params.region;

    if (params.hasContent) {
      body.contents = {
        text: { maxCharacters: 2000 },
        highlights: { numSentences: 3 },
        summary: true,
      };
    }

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(buildExaSearchUrl(this.baseUrl), {
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
        throw new ProviderError('exa', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results: { url: string; title: string; text?: string; publishedDate?: string }[];
      };

      return data.results
        .filter((r) => params.hasContent || Boolean(r.url))
        .map((r) => ({
          url: r.url,
          title: r.title,
          content: params.hasContent ? (r.text ?? undefined) : undefined,
          publishedDate: r.publishedDate ?? undefined,
        }));
    });
  }
}
