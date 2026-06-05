import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExaSearchAdapter } from '../../src/providers/exa.js';
import { ParallelSearchAdapter } from '../../src/providers/parallel.js';
import type { ProviderSearchParams } from '../../src/providers/search-types.js';
import { TavilySearchAdapter } from '../../src/providers/tavily.js';

const baseParams: ProviderSearchParams = {
  query: 'platypus',
  hasContent: false,
  perChannelMaxResults: 5,
  topic: 'common',
  searchEffort: 'medium',
  timeoutMs: 1_000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('search adapters empty-url behavior', () => {
  it('filters empty-url Exa results when hasContent=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { url: '', title: 'missing url', text: 'body' },
            { url: 'https://example.com', title: 'kept', text: 'body' },
          ],
        }),
      }),
    );

    const adapter = new ExaSearchAdapter('test-key');
    const execution = await adapter.search(baseParams);

    expect(execution.results).toEqual([
      {
        url: 'https://example.com',
        title: 'kept',
        content: undefined,
        publishedDate: undefined,
      },
    ]);
  });

  it('keeps empty-url Exa results when hasContent=true without assigning identity in adapter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ url: '', title: 'missing url', text: 'body' }],
        }),
      }),
    );

    const adapter = new ExaSearchAdapter('test-key');
    const execution = await adapter.search({ ...baseParams, hasContent: true });

    expect(execution.results).toEqual([
      {
        url: '',
        title: 'missing url',
        content: 'body',
        publishedDate: undefined,
      },
    ]);
  });

  it('sends Exa userLocation as a string when region is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ url: 'https://example.com', title: 'kept', text: 'body' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new ExaSearchAdapter('test-key');
    await adapter.search({ ...baseParams, region: 'US' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit).toBeDefined();
    const body = JSON.parse(String(requestInit.body));
    expect(body.userLocation).toBe('US');
  });

  it('filters empty-url Tavily results when hasContent=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { url: '', title: 'missing url', content: 'snippet', raw_content: 'body' },
            { url: 'https://example.com', title: 'kept', content: 'snippet', raw_content: 'body' },
          ],
        }),
      }),
    );

    const adapter = new TavilySearchAdapter('test-key');
    const execution = await adapter.search(baseParams);

    expect(execution.results).toEqual([
      {
        url: 'https://example.com',
        title: 'kept',
        content: undefined,
        publishedDate: undefined,
      },
    ]);
  });

  it('keeps empty-url Tavily results when hasContent=true without assigning identity in adapter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ url: '', title: 'missing url', content: 'snippet', raw_content: 'body' }],
        }),
      }),
    );

    const adapter = new TavilySearchAdapter('test-key');
    const execution = await adapter.search({ ...baseParams, hasContent: true });

    expect(execution.results).toEqual([
      {
        url: '',
        title: 'missing url',
        content: 'body',
        publishedDate: undefined,
      },
    ]);
  });
});

describe('parallel search adapter', () => {
  it('maps key request fields to the Parallel API payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { url: 'https://example.com/a', title: 'A', publish_date: '2024-06-01', excerpts: ['x'] },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new ParallelSearchAdapter('parallel-key');
    await adapter.search({
      ...baseParams,
      query: 'llm search',
      hasContent: true,
      perChannelMaxResults: 12,
      includeDomains: 'example.com, docs.example.com',
      excludeDomains: 'reddit.com',
      publishedAfter: '2024-01-01',
      publishedBefore: '2024-12-31',
      topic: 'news',
      language: 'us_en',
      region: 'US',
      searchEffort: 'low',
      timeoutMs: 2345,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.parallel.ai/v1/search');
    expect(requestInit).toBeDefined();
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toEqual({
      'Content-Type': 'application/json',
      'x-api-key': 'parallel-key',
    });

    const body = JSON.parse(String(requestInit.body));
    expect(body).toMatchObject({
      objective:
        'llm search latest news english information region:+US after 2024-01-01 before 2024-12-31',
      search_queries: ['llm search'],
      mode: 'basic',
      client_model: 'platypus-search-en',
      advanced_settings: {
        max_results: 10,
        location: 'us',
        source_policy: {
          include_domains: ['example.com', 'docs.example.com'],
          exclude_domains: ['reddit.com'],
          after_date: '2024-01-01',
        },
        excerpt_settings: {
          max_chars_per_result: 2000,
        },
      },
    });
  });

  it('normalizes excerpts into content and filters by domain and publishedBefore', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              url: 'https://keep.example.com/post',
              title: 'Keep',
              publish_date: '2024-05-01',
              excerpts: ['first', 'second'],
            },
            {
              url: 'https://blocked.example.net/post',
              title: 'Blocked domain',
              publish_date: '2024-05-01',
              excerpts: ['ignored'],
            },
            {
              url: 'https://keep.example.com/future',
              title: 'Too new',
              publish_date: '2025-01-01',
              excerpts: ['ignored'],
            },
          ],
        }),
      }),
    );

    const adapter = new ParallelSearchAdapter('parallel-key');
    const execution = await adapter.search({
      ...baseParams,
      hasContent: true,
      includeDomains: 'example.com',
      publishedBefore: '2024-12-31',
    });

    expect(execution.results).toEqual([
      {
        url: 'https://keep.example.com/post',
        title: 'Keep',
        content: 'first\n\nsecond',
        publishedDate: '2024-05-01',
      },
    ]);
  });
});
