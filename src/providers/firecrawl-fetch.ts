import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { FetchProvider, NormalizedFetchParams, RawFetchResult } from './fetch-types.js';

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';

export class FirecrawlFetchAdapter implements FetchProvider {
  readonly id = 'firecrawl';

  constructor(private readonly apiKey: string) {}

  async fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult> {
    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      // Firecrawl natively returns markdown in v1. We ask for markdown regardless of caller's
      // requested format; if caller asked for text we still return the markdown body and tag
      // it as markdown (downgrading to 'text' would require post-processing for v1).
      const res = await globalThis.fetch(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('firecrawl', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        success?: boolean;
        data?: {
          markdown?: string;
          metadata?: { title?: string; sourceURL?: string; url?: string; statusCode?: number };
        };
      };

      const content = data.data?.markdown ?? '';
      const sourceUrl = data.data?.metadata?.sourceURL ?? data.data?.metadata?.url ?? url;
      return {
        url: sourceUrl,
        title: data.data?.metadata?.title,
        content,
        format: 'markdown',
        fetchedAt: new Date().toISOString(),
      };
    });
  }
}
