import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { FetchProvider, NormalizedFetchParams, RawFetchResult } from './fetch-types.js';

const EXA_CONTENTS_URL = 'https://api.exa.ai/contents';

export class ExaFetchAdapter implements FetchProvider {
  readonly id = 'exa';

  constructor(private readonly apiKey: string) {}

  async fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult> {
    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const res = await globalThis.fetch(EXA_CONTENTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          ids: [url],
          text: { maxCharacters: 5000 },
        }),
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('exa', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        results?: { id: string; url: string; title?: string; text?: string }[];
        statuses?: { id: string; status: string; error?: { tag: string } }[];
      };

      const first = data.results?.[0];
      if (!first || !first.text) {
        const status = data.statuses?.[0];
        const tag = status?.error?.tag ?? 'NO_CONTENT';
        const message =
          status?.status === 'error'
            ? `Exa contents failed: ${tag}`
            : 'Exa contents returned no text';
        // QUOTA prevents retry and aggregator records as warning per fetch semantics.
        throw new ProviderError('exa', 'QUOTA', tag, message);
      }

      // Exa contents.text returns plain text; format is always 'text' regardless of caller request.
      return {
        url: first.url,
        title: first.title,
        content: first.text,
        format: 'text',
        fetchedAt: new Date().toISOString(),
      };
    });
  }
}
