import { describe, expect, it } from 'vitest';
import { aggregateFetchBest } from '../../src/aggregator/fetch.js';
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

describe('aggregateFetchBest', () => {
  it('returns best result for single URL across multiple providers', async () => {
    const a = new StubProvider('alpha', async (url) => fakeResult(url, 'alpha'));
    const b = new StubProvider('beta', async (url) => ({
      ...fakeResult(url, 'beta'),
      content: `${'B'.repeat(5000)}`,
    }));

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [a, b]);

    expect(response.best).not.toBeNull();
    // beta has longer content → higher score
    expect(response.best?.provider).toBe('beta');
    expect(response.best?.url).toBe('https://example.com/a');
    expect(response.best?.content.length).toBe(5000);
    expect(response.failures).toHaveLength(0);
  });

  it('partial success: one provider fails, best is from the successful provider', async () => {
    const ok = new StubProvider('ok', async (url) => fakeResult(url, 'ok'));
    const bad = new StubProvider('bad', async () => {
      throw new ProviderError('bad', 'NETWORK', '503', 'service unavailable');
    });

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [ok, bad]);

    expect(response.best).not.toBeNull();
    expect(response.best?.provider).toBe('ok');
    expect(response.best?.content).toBe('ok: content for https://example.com/a');
    expect(response.failures).toHaveLength(1);
    expect(response.failures[0]?.provider).toBe('bad');
    expect(response.failures[0]?.code).toBe('503');
  });

  it('all providers fail: best is null and failures list all errors', async () => {
    const a = new StubProvider('a', async () => {
      throw new ProviderError('a', 'NETWORK', '500', 'oops');
    });
    const b = new StubProvider('b', async () => {
      throw new ProviderError('b', 'QUOTA', '402', 'payment required');
    });

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [a, b]);

    expect(response.best).toBeNull();
    expect(response.failures).toHaveLength(2);
    const codes = response.failures.map((f) => f.code).sort();
    expect(codes).toEqual(['402', '500']);
  });

  it('empty content candidates are excluded; valid candidate is selected', async () => {
    const empty = new StubProvider('empty', async (url) => ({
      ...fakeResult(url, 'empty'),
      content: '',
    }));
    const valid = new StubProvider('valid', async (url) => fakeResult(url, 'valid'));

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [empty, valid]);

    expect(response.best).not.toBeNull();
    expect(response.best?.provider).toBe('valid');
    expect(response.failures).toHaveLength(1);
    expect(response.failures[0]?.provider).toBe('empty');
  });

  it('blocked page candidates are excluded; valid candidate is selected', async () => {
    const blocked = new StubProvider('blocked', async (url) => ({
      ...fakeResult(url, 'blocked'),
      title: 'Access Denied',
      content: 'You have been blocked by the security system.',
    }));
    const valid = new StubProvider('valid', async (url) => ({
      ...fakeResult(url, 'valid'),
      content: 'Short but valid content',
    }));

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [
      blocked,
      valid,
    ]);

    expect(response.best).not.toBeNull();
    expect(response.best?.provider).toBe('valid');
    expect(response.failures).toHaveLength(1);
    expect(response.failures[0]?.provider).toBe('blocked');
    expect(response.failures[0]?.code).toBe('NO_CONTENT');
  });

  it('throws when no providers given', async () => {
    await expect(aggregateFetchBest('https://example.com/a', baseParams, [])).rejects.toThrow(
      'No fetch channels available for the given configuration.',
    );
  });

  it('non-ProviderError exceptions are recorded as failures with UNKNOWN code', async () => {
    const p = new StubProvider('p', async () => {
      throw new Error('totally generic boom');
    });

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [p]);

    expect(response.best).toBeNull();
    expect(response.failures).toHaveLength(1);
    expect(response.failures[0]?.code).toBe('UNKNOWN');
    expect(response.failures[0]?.provider).toBe('p');
    expect(response.failures[0]?.message).toContain('totally generic boom');
  });

  it('runs in parallel: total time roughly equals slowest call, not sum', async () => {
    const slow = new StubProvider('slow', async (url) => {
      await new Promise((r) => setTimeout(r, 80));
      return fakeResult(url, 'slow');
    });
    const slow2 = new StubProvider('slow2', async (url) => {
      await new Promise((r) => setTimeout(r, 80));
      return { ...fakeResult(url, 'slow2'), content: 'B'.repeat(5000) };
    });

    const start = Date.now();
    const response = await aggregateFetchBest('https://example.com/a', baseParams, [slow, slow2]);
    const elapsed = Date.now() - start;
    // Sequential would be ~160ms; parallel should be ~80-120ms. Allow generous slack.
    expect(elapsed).toBeLessThan(150);
    expect(response.best).not.toBeNull();
  });

  it('selects the candidate with the longest content as best', async () => {
    const short = new StubProvider('short', async (url) => ({
      ...fakeResult(url, 'short'),
      content: 'Short',
    }));
    const long = new StubProvider('long', async (url) => ({
      ...fakeResult(url, 'long'),
      content: 'A'.repeat(5000),
    }));

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [short, long]);

    expect(response.best?.provider).toBe('long');
  });

  it('tie-breaks by DEFAULT_FETCH_PRIORITY when content length is equal', async () => {
    const sameContent = 'X'.repeat(200);
    const jina = new StubProvider('jina', async (url) => ({
      ...fakeResult(url, 'jina'),
      content: sameContent,
    }));
    const firecrawl = new StubProvider('firecrawl', async (url) => ({
      ...fakeResult(url, 'firecrawl'),
      content: sameContent,
    }));

    const response = await aggregateFetchBest('https://example.com/a', baseParams, [
      jina,
      firecrawl,
    ]);

    // firecrawl is at index 0 in DEFAULT_FETCH_PRIORITY, jina at index 1
    expect(response.best?.provider).toBe('firecrawl');
  });
});
