import { ProviderError, classifyHttpStatus } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';
import type { FetchProvider, NormalizedFetchParams, RawFetchResult } from './fetch-types.js';

const JINA_READER_BASE = 'https://r.jina.ai/';

export class JinaFetchAdapter implements FetchProvider {
  readonly id = 'jina';

  constructor(private readonly apiKey: string) {}

  async fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult> {
    return withRetry(async () => {
      const signal = AbortSignal.timeout(params.timeoutMs);
      const target = `${JINA_READER_BASE}${url}`;
      const res = await globalThis.fetch(target, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          'X-Return-Format': params.format,
          'X-Engine': 'direct',
        },
        signal,
      });

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        const text = await res.text().catch(() => '');
        throw new ProviderError('jina', category, String(res.status), text || res.statusText);
      }

      const data = (await res.json()) as {
        data?: { title?: string; content?: string; url?: string };
      };

      const content = data.data?.content ?? '';
      return {
        url: data.data?.url ?? url,
        title: data.data?.title,
        content,
        format: params.format,
        fetchedAt: new Date().toISOString(),
      };
    });
  }
}
