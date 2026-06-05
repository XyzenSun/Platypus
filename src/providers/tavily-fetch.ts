import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { FetchProvider, NormalizedFetchParams, RawFetchResult } from './fetch-types.js';

const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';

function buildTavilyExtractUrl(baseUrl?: string): string {
  if (!baseUrl) return TAVILY_EXTRACT_URL;
  return `${baseUrl.replace(/\/+$/, '')}/extract`;
}

export class TavilyFetchAdapter implements FetchProvider {
  readonly id = 'tavily';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string,
  ) {}

  async fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult> {
    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await globalThis.fetch(buildTavilyExtractUrl(this.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          urls: [url],
          format: params.format,
          extract_depth: 'basic',
        }),
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('tavily', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results?: { url: string; raw_content?: string }[];
        failed_results?: { url: string; error?: string }[];
      };

      const first = data.results?.[0];
      if (!first) {
        const failure = data.failed_results?.[0];
        const message = failure?.error ?? 'Tavily extract returned no results';
        throw new ProviderError('tavily', 'USER_ERROR', 'NO_RESULTS', message);
      }

      return {
        url: first.url,
        content: first.raw_content ?? '',
        format: params.format,
        fetchedAt: new Date().toISOString(),
      };
    });
  }
}
