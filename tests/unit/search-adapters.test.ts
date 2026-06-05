import { describe, expect, it, vi } from 'vitest';
import { ExaSearchAdapter } from '../../src/providers/exa.js';
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
