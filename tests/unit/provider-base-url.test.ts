import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExaSearchAdapter } from '../../src/providers/exa.js';
import type { NormalizedFetchParams } from '../../src/providers/fetch-types.js';
import { ParallelSearchAdapter } from '../../src/providers/parallel.js';
import type { ProviderSearchParams } from '../../src/providers/search-types.js';
import { TavilyFetchAdapter } from '../../src/providers/tavily-fetch.js';

const searchParams: ProviderSearchParams = {
  query: 'claude code',
  hasContent: false,
  perChannelMaxResults: 5,
  topic: 'common',
  searchEffort: 'medium',
  timeoutMs: 1000,
};

const fetchParams: NormalizedFetchParams = {
  urls: ['https://example.com'],
  format: 'markdown',
  timeoutMs: 1000,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('provider baseUrl overrides', () => {
  it('uses default Exa search URL when baseUrl is not set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new ExaSearchAdapter('exa-key').search(searchParams);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.exa.ai/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses custom Exa search baseUrl and trims trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new ExaSearchAdapter('exa-key', 'https://proxy.example.com/exa/').search(searchParams);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.com/exa/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses custom Parallel search baseUrl and trims trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new ParallelSearchAdapter('parallel-key', 'https://proxy.example.com/parallel/').search(
      searchParams,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.com/parallel/v1/search',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses custom Tavily fetch baseUrl and trims trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ url: 'https://example.com', raw_content: 'hello' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new TavilyFetchAdapter('tavily-key', 'https://proxy.example.com/tavily/').fetch(
      'https://example.com',
      fetchParams,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://proxy.example.com/tavily/extract',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
