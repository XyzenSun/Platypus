import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import { CompiledSearchProvider, buildCapabilityNote } from './search-provider-utils.js';
import type { ProviderSearchParams, RawProviderResult } from './search-types.js';

const OLLAMA_SEARCH_URL = 'https://ollama.com/api/web_search';

function buildOllamaSearchUrl(baseUrl?: string): string {
  if (!baseUrl) return OLLAMA_SEARCH_URL;
  return `${baseUrl.replace(/\/+$/, '')}/api/web_search`;
}

export class OllamaSearchAdapter extends CompiledSearchProvider {
  readonly id = 'ollama';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string,
  ) {
    super();
  }

  protected buildCapabilityNote(
    params: ProviderSearchParams,
  ): ReturnType<typeof buildCapabilityNote> {
    const ignoredFields = [
      params.includeDomains ? 'includeDomains' : undefined,
      params.excludeDomains ? 'excludeDomains' : undefined,
      params.publishedAfter ? 'publishedAfter' : undefined,
      params.publishedBefore ? 'publishedBefore' : undefined,
      params.topic !== 'common' ? 'topic' : undefined,
      params.language ? 'language' : undefined,
      params.region ? 'region' : undefined,
      params.searchEffort !== 'medium' ? 'searchEffort' : undefined,
    ].filter((value): value is string => Boolean(value));

    return buildCapabilityNote(this.id, {
      nativeFields: ['query', 'perChannelMaxResults', 'hasContent'],
      ignoredFields,
      notes: ['hasContent only controls content passthrough and empty-url filtering.'],
    });
  }

  protected async execute(params: ProviderSearchParams): Promise<RawProviderResult[]> {
    const body = {
      query: params.query,
      max_results: Math.min(params.perChannelMaxResults, 10),
    };

    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await fetch(buildOllamaSearchUrl(this.baseUrl), {
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
        throw new ProviderError('ollama', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results?: {
          title: string;
          url: string;
          content?: string;
        }[];
      };

      return (data.results ?? [])
        .filter((result) => params.hasContent || Boolean(result.url))
        .map(
          (result): RawProviderResult => ({
            url: result.url,
            title: result.title,
            content: params.hasContent ? (result.content ?? undefined) : undefined,
          }),
        );
    });
  }
}
