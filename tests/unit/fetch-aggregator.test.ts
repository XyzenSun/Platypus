import { describe, expect, it } from 'vitest';
import { aggregateFetch } from '../../src/aggregator/fetch.js';
import { ProviderError } from '../../src/lib/errors.js';
import type {
  FetchProvider,
  NormalizedFetchParams,
  RawFetchResult,
} from '../../src/providers/fetch-types.js';

class StubProvider implements FetchProvider {
  constructor(
    public readonly id: string,
    private readonly impl: (url: string, params: NormalizedFetchParams) => Promise<RawFetchResult>,
  ) {}
  fetch(url: string, params: NormalizedFetchParams): Promise<RawFetchResult> {
    return this.impl(url, params);
  }
}

const baseParams: NormalizedFetchParams = {
  urls: ['https://example.com/a'],
  format: 'markdown',
  timeoutMs: 5000,
};

function fakeResult(url: string, provider: string): RawFetchResult {
  return {
    url,
    title: `${provider} title`,
    content: `${provider}: content for ${url}`,
    format: 'markdown',
    fetchedAt: '2026-06-04T00:00:00.000Z',
  };
}

describe('aggregateFetch', () => {
  it('returns byProvider view for single URL across providers', async () => {
    const a = new StubProvider('alpha', async (url) => fakeResult(url, 'alpha'));
    const b = new StubProvider('beta', async (url) => fakeResult(url, 'beta'));

    const response = await aggregateFetch(baseParams, [a, b]);

    expect(Object.keys(response.results)).toEqual(['https://example.com/a']);
    const bucket = response.results['https://example.com/a'];
    expect(bucket).toBeDefined();
    expect(bucket?.alpha?.content).toBe('alpha: content for https://example.com/a');
    expect(bucket?.beta?.content).toBe('beta: content for https://example.com/a');
    expect(response.warnings).toEqual([]);
  });

  it('partial success: one provider fails, others still return', async () => {
    const ok = new StubProvider('ok', async (url) => fakeResult(url, 'ok'));
    const bad = new StubProvider('bad', async () => {
      throw new ProviderError('bad', 'NETWORK', '503', 'service unavailable');
    });

    const response = await aggregateFetch(baseParams, [ok, bad]);

    expect(response.results['https://example.com/a']?.ok).toBeDefined();
    expect(response.results['https://example.com/a']?.bad).toBeUndefined();
    expect(response.warnings).toHaveLength(1);
    expect(response.warnings[0]).toMatchObject({
      provider: 'bad',
      url: 'https://example.com/a',
      code: '503',
    });
  });

  it('all providers fail for a URL: empty bucket + warnings per provider', async () => {
    const a = new StubProvider('a', async () => {
      throw new ProviderError('a', 'NETWORK', '500', 'oops');
    });
    const b = new StubProvider('b', async () => {
      throw new ProviderError('b', 'QUOTA', '402', 'payment required');
    });

    const response = await aggregateFetch(baseParams, [a, b]);

    expect(response.results['https://example.com/a']).toEqual({});
    expect(response.warnings).toHaveLength(2);
    const codes = response.warnings.map((w) => w.code).sort();
    expect(codes).toEqual(['402', '500']);
  });

  it('multiple URLs: each gets its own provider dict', async () => {
    const params: NormalizedFetchParams = {
      ...baseParams,
      urls: ['https://example.com/a', 'https://example.com/b'],
    };
    const p = new StubProvider('p', async (url) => fakeResult(url, 'p'));

    const response = await aggregateFetch(params, [p]);

    expect(Object.keys(response.results).sort()).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(response.results['https://example.com/a']?.p?.url).toBe('https://example.com/a');
    expect(response.results['https://example.com/b']?.p?.url).toBe('https://example.com/b');
  });

  it('throws when no providers given', async () => {
    await expect(aggregateFetch(baseParams, [])).rejects.toThrow(
      'No fetch channels available for the given configuration.',
    );
  });

  it('non-ProviderError exceptions are recorded as UNKNOWN warnings', async () => {
    const p = new StubProvider('p', async () => {
      throw new Error('totally generic boom');
    });

    const response = await aggregateFetch(baseParams, [p]);

    expect(response.warnings).toHaveLength(1);
    expect(response.warnings[0]?.code).toBe('UNKNOWN');
    expect(response.warnings[0]?.provider).toBe('p');
    expect(response.warnings[0]?.message).toContain('totally generic boom');
  });

  it('runs in parallel: total time roughly equals slowest call, not sum', async () => {
    const slow = new StubProvider('slow', async (url) => {
      await new Promise((r) => setTimeout(r, 80));
      return fakeResult(url, 'slow');
    });
    const slow2 = new StubProvider('slow2', async (url) => {
      await new Promise((r) => setTimeout(r, 80));
      return fakeResult(url, 'slow2');
    });

    const start = Date.now();
    await aggregateFetch(baseParams, [slow, slow2]);
    const elapsed = Date.now() - start;
    // Sequential would be ~160ms; parallel should be ~80-120ms. Allow generous slack.
    expect(elapsed).toBeLessThan(150);
  });
});
